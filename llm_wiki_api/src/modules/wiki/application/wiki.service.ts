import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { generateText, isStepCount, type ModelMessage, type ToolSet } from 'ai';
import { IngestSourceDto } from '../api/dto/ingest-source.dto';
import { QueryWikiDto } from '../api/dto/query-wiki.dto';
import { createIngestTools, createQueryTools, newActivity } from './wiki-tools';
import { ingestInstructions, queryInstructions } from '../domain/wiki.prompts';
import { FilesService, INDEX_FILE, WikiArea } from '../../files';
import {
  AiProvider,
  ConversationRepository,
  MessageRole,
  ModelService,
} from '../../llm';

/** Maximum number of AI ↔ tools round trips per operation. */
const MAX_STEPS = { ingest: 40, query: 15 };

/** Maximum length of a conversation title derived from its first question. */
const TITLE_MAX_LENGTH = 100;

@Injectable()
export class WikiService {
  private readonly logger = new Logger(WikiService.name);

  /**
   * Queue of operations that write to the wiki: two concurrent ingestions
   * would each overwrite index.md on their own.
   */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filesService: FilesService,
    private readonly modelService: ModelService,
    private readonly conversations: ConversationRepository,
  ) {}

  /** Ingests a source from raw/: the AI creates/updates the wiki pages. */
  async ingest(sourceName: string, { provider, model }: IngestSourceDto) {
    // Check the source before queuing (immediate 404 if missing).
    const source = await this.filesService.findOne(WikiArea.RAW, sourceName);

    return this.exclusive(async () => {
      const activity = newActivity();
      activity.sourcesRead.add(sourceName);

      const result = await this.run(provider, model, {
        instructions: ingestInstructions(await this.schema()),
        prompt:
          `Source à ingérer : raw/${sourceName}\n\n` +
          `<source name="${sourceName}">\n${source.content}\n</source>\n\n` +
          `Index actuel (wiki/${INDEX_FILE}) :\n\n${await this.index()}`,
        tools: createIngestTools(this.filesService, activity),
        maxSteps: MAX_STEPS.ingest,
      });

      const pagesCreated = [...activity.pagesCreated];
      const pagesUpdated = [...activity.pagesUpdated];
      await this.filesService.appendLog(
        [
          `## [${this.today()}] ingest | ${sourceName}`,
          `- pages créées : ${pagesCreated.join(', ') || 'aucune'}`,
          `- pages modifiées : ${pagesUpdated.join(', ') || 'aucune'}`,
        ].join('\n'),
      );

      return {
        source: sourceName,
        provider,
        model,
        summary: result.text,
        pagesCreated,
        pagesUpdated,
        steps: result.steps.length,
        usage: result.totalUsage,
      };
    });
  }

  /**
   * Answers a question using only the wiki content. The question and the
   * answer are saved in a conversation (created if `conversationId` is
   * omitted), whose previous messages are given to the AI as context.
   */
  async query({ provider, model, question, conversationId }: QueryWikiDto) {
    // Load the history first: immediate 404 if the conversation is unknown.
    const history = conversationId
      ? (await this.conversations.findConversation(conversationId)).messages
      : [];
    const activity = newActivity();

    const result = await this.run(provider, model, {
      instructions: queryInstructions(await this.schema()),
      prompt: [
        ...history.map((message): ModelMessage =>
          message.role === MessageRole.user
            ? { role: 'user', content: message.content }
            : { role: 'assistant', content: message.content },
        ),
        {
          role: 'user',
          content: `Index du wiki (wiki/${INDEX_FILE}) :\n\n${await this.index()}\n\nQuestion : ${question}`,
        },
      ],
      tools: createQueryTools(this.filesService, activity),
      maxSteps: MAX_STEPS.query,
    });

    const sources = {
      pages: [...activity.pagesRead],
      raw: [...activity.sourcesRead],
    };

    // Saved only once the AI has answered: a failed call leaves no trace.
    const id =
      conversationId ??
      (await this.conversations.createConversation(this.title(question))).id;
    await this.conversations.addMessage(id, {
      role: MessageRole.user,
      content: question,
    });
    const answer = await this.conversations.addMessage(id, {
      role: MessageRole.llm,
      content: result.text,
      providerName: provider,
      model,
      usage: result.totalUsage,
      source: sources,
    });

    await this.exclusive(() =>
      this.filesService.appendLog(
        [
          `## [${this.today()}] query | ${question.replace(/\s+/g, ' ').slice(0, 120)}`,
          `- pages consultées : ${sources.pages.join(', ') || 'aucune'}`,
        ].join('\n'),
      ),
    );

    return {
      conversationId: id,
      messageId: answer.id,
      question,
      provider,
      model,
      answer: result.text,
      sources,
      steps: result.steps.length,
      usage: result.totalUsage,
    };
  }

  /** Lists the conversations, most recently active first. */
  findConversations() {
    return this.conversations.findConversations();
  }

  /** Returns a conversation with its messages. */
  findConversation(id: string) {
    return this.conversations.findConversation(id);
  }

  /** Messages of a conversation, oldest first. */
  findMessages(id: string) {
    return this.conversations.findMessages(id);
  }

  /** Changes the title of a conversation. */
  renameConversation(id: string, title: string) {
    return this.conversations.renameConversation(id, title.trim());
  }

  /** Deletes a conversation and its messages. */
  deleteConversation(id: string) {
    return this.conversations.deleteConversation(id);
  }

  /** Runs the tool-calling loop and maps provider errors to 502. */
  private async run(
    provider: AiProvider,
    model: string,
    opts: {
      instructions: string;
      prompt: string | ModelMessage[];
      tools: ToolSet;
      maxSteps: number;
    },
  ) {
    // Outside the try: a missing key must stay a 404, not a 502.
    const languageModel = await this.modelService.getModel(provider, model);
    try {
      const result = await generateText({
        model: languageModel,
        instructions: opts.instructions,
        prompt: opts.prompt,
        tools: opts.tools,
        stopWhen: isStepCount(opts.maxSteps),
      });
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider} wiki request failed: ${message}`);
      throw new BadGatewayException(`${provider} request failed: ${message}`);
    }
  }

  /** Runs `task` after the write operations already in progress. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(task, task);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  private async schema() {
    return (await this.filesService.readSchema()).content;
  }

  private async index() {
    return (await this.filesService.findOne(WikiArea.WIKI, INDEX_FILE)).content;
  }

  /** Conversation title: the first question on a single line, truncated. */
  private title(question: string) {
    const line = question.replace(/\s+/g, ' ').trim();
    return line.length > TITLE_MAX_LENGTH
      ? `${line.slice(0, TITLE_MAX_LENGTH - 1)}…`
      : line;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}
