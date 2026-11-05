import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { generateText, isStepCount, type ToolSet } from 'ai';
import { FilesService } from '../files/files.service';
import { INDEX_FILE, WikiArea } from '../files/files.constants';
import { ModelService } from '../llm/model.service';
import { AiProvider } from '../llm/ai-provider.enum';
import { IngestSourceDto } from './dto/ingest-source.dto';
import { QueryWikiDto } from './dto/query-wiki.dto';
import { createIngestTools, createQueryTools, newActivity } from './wiki-tools';
import { ingestInstructions, queryInstructions } from './wiki.prompts';

/** Maximum number of AI ↔ tools round trips per operation. */
const MAX_STEPS = { ingest: 40, query: 15 };

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

  /** Answers a question using only the wiki content. */
  async query({ provider, model, question }: QueryWikiDto) {
    const activity = newActivity();

    const result = await this.run(provider, model, {
      instructions: queryInstructions(await this.schema()),
      prompt: `Index du wiki (wiki/${INDEX_FILE}) :\n\n${await this.index()}\n\nQuestion : ${question}`,
      tools: createQueryTools(this.filesService, activity),
      maxSteps: MAX_STEPS.query,
    });

    const pages = [...activity.pagesRead];
    await this.exclusive(() =>
      this.filesService.appendLog(
        [
          `## [${this.today()}] query | ${question.replace(/\s+/g, ' ').slice(0, 120)}`,
          `- pages consultées : ${pages.join(', ') || 'aucune'}`,
        ].join('\n'),
      ),
    );

    return {
      question,
      provider,
      model,
      answer: result.text,
      sources: { pages, raw: [...activity.sourcesRead] },
      steps: result.steps.length,
      usage: result.totalUsage,
    };
  }

  /** Runs the tool-calling loop and maps provider errors to 502. */
  private async run(
    provider: AiProvider,
    model: string,
    opts: {
      instructions: string;
      prompt: string;
      tools: ToolSet;
      maxSteps: number;
    },
  ) {
    // Outside the try: a missing key must stay a 404, not a 502.
    const languageModel = this.modelService.getModel(provider, model);
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

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}
