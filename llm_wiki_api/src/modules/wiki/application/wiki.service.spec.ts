import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV4 } from 'ai/test';

type LanguageModelV4GenerateResult = Awaited<
  ReturnType<MockLanguageModelV4['doGenerate']>
>;
import { WikiService } from './wiki.service';
import { FilesService } from '../../files';
import {
  AiProvider,
  ConversationRepository,
  ModelService,
  type NewMessage,
} from '../../llm';

/** In-memory stand-in for the database-backed ConversationRepository. */
class FakeConversationRepository {
  conversations = new Map<
    string,
    { id: string; title: string; messages: (NewMessage & { id: string })[] }
  >();
  private nextId = 0;

  createConversation(title: string) {
    const conversation = { id: `conv-${++this.nextId}`, title, messages: [] };
    this.conversations.set(conversation.id, conversation);
    return Promise.resolve(conversation);
  }

  findConversation(id: string) {
    const conversation = this.conversations.get(id);
    if (!conversation) throw new Error(`unknown conversation ${id}`);
    return Promise.resolve(conversation);
  }

  async addMessage(conversationId: string, message: NewMessage) {
    const created = { id: `msg-${++this.nextId}`, ...message };
    (await this.findConversation(conversationId)).messages.push(created);
    return created;
  }
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

let callId = 0;
const toolCall = (
  toolName: string,
  input: object,
): LanguageModelV4GenerateResult => ({
  content: [
    {
      type: 'tool-call',
      toolCallId: `call-${++callId}`,
      toolName,
      input: JSON.stringify(input),
    },
  ],
  finishReason: { unified: 'tool-calls', raw: undefined },
  usage,
  warnings: [],
});

const finalText = (text: string): LanguageModelV4GenerateResult => ({
  content: [{ type: 'text', text }],
  finishReason: { unified: 'stop', raw: undefined },
  usage,
  warnings: [],
});

describe('WikiService', () => {
  let dir: string;
  let filesService: FilesService;
  let conversations: FakeConversationRepository;
  let languageModel: MockLanguageModelV4;

  const serviceWith = (responses: LanguageModelV4GenerateResult[]) => {
    languageModel = new MockLanguageModelV4({ doGenerate: responses });
    const modelService = {
      getModel: () => Promise.resolve(languageModel),
    } as unknown as ModelService;
    return new WikiService(
      filesService,
      modelService,
      conversations as unknown as ConversationRepository,
    );
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wiki-'));
    process.env.FILES_DIR = dir;
    conversations = new FakeConversationRepository();
    filesService = new FilesService();
    await filesService.onModuleInit();
    await filesService.addRaw(
      'source.md',
      Buffer.from('# Le modèle OSI a 7 couches.'),
    );
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('ingest: écrit les pages demandées par l’IA et journalise', async () => {
    const service = serviceWith([
      toolCall('write_page', {
        name: 'modele-osi.md',
        content: '# Modèle OSI',
      }),
      toolCall('write_page', {
        name: 'index.md',
        content: '# Index\n- [OSI](modele-osi.md)',
      }),
      finalText('Page modele-osi créée.'),
    ]);

    const result = await service.ingest('source.md', {
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
    });
    expect(result.pagesCreated).toEqual(['modele-osi.md']);
    expect(result.pagesUpdated).toEqual(['index.md']);
    expect(result.summary).toBe('Page modele-osi créée.');
    expect(await readFile(join(dir, 'wiki', 'modele-osi.md'), 'utf8')).toBe(
      '# Modèle OSI',
    );
    const log = await readFile(join(dir, 'wiki', 'log.md'), 'utf8');
    expect(log).toContain('ingest | source.md');
    expect(log).toContain('pages créées : modele-osi.md');
  });

  it('ingest: refuse les écritures dans log.md ou avec un nom invalide', async () => {
    const service = serviceWith([
      toolCall('write_page', { name: 'log.md', content: 'pirate' }),
      toolCall('write_page', { name: '../raw/source.md', content: 'pirate' }),
      finalText('fini'),
    ]);

    const result = await service.ingest('source.md', {
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
    });

    expect(result.pagesCreated).toEqual([]);
    expect(await readFile(join(dir, 'raw', 'source.md'), 'utf8')).toContain(
      '7 couches',
    );
    expect(await readFile(join(dir, 'wiki', 'log.md'), 'utf8')).not.toContain(
      'pirate',
    );
  });

  it('query: répond et liste les pages consultées', async () => {
    await filesService.writeWikiPage(
      'modele-osi.md',
      '# Modèle OSI\n7 couches.',
    );
    const service = serviceWith([
      toolCall('read_page', { name: 'modele-osi.md' }),
      finalText('Le modèle OSI a 7 couches ([Modèle OSI](modele-osi.md)).'),
    ]);

    const result = await service.query({
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
      question: 'Combien de couches ?',
    });

    expect(result.answer).toContain('7 couches');
    expect(result.sources.pages).toEqual(['modele-osi.md']);

    // A new conversation holds the question and the answer.
    const conversation = conversations.conversations.get(result.conversationId);
    expect(conversation?.title).toBe('Combien de couches ?');
    expect(conversation?.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Combien de couches ?'],
      ['llm', result.answer],
    ]);
    expect(conversation?.messages[1]).toMatchObject({
      providerName: AiProvider.ANTHROPIC,
      model: 'mock',
      source: { pages: ['modele-osi.md'], raw: [] },
    });
  });

  it('query: poursuit une conversation en donnant l’historique à l’IA', async () => {
    const { id } = await conversations.createConversation('OSI');
    await conversations.addMessage(id, { role: 'user', content: 'Question 1' });
    await conversations.addMessage(id, { role: 'llm', content: 'Réponse 1' });
    const service = serviceWith([finalText('Réponse 2')]);

    const result = await service.query({
      provider: AiProvider.ANTHROPIC,
      model: 'mock',
      question: 'Question 2',
      conversationId: id,
    });

    expect(result.conversationId).toBe(id);
    const prompt = languageModel.doGenerateCalls[0].prompt;
    expect(prompt.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(JSON.stringify(prompt[2])).toContain('Réponse 1');
    expect(JSON.stringify(prompt[3])).toContain('Question 2');
    expect(conversations.conversations.get(id)?.messages).toHaveLength(4);
  });
});
