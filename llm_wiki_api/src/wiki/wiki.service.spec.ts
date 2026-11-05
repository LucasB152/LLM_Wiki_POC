import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV4 } from 'ai/test';

type LanguageModelV4GenerateResult = Awaited<
  ReturnType<MockLanguageModelV4['doGenerate']>
>;
import { FilesService } from '../files/files.service';
import { ModelService } from '../llm/model.service';
import { AiProvider } from '../llm/ai-provider.enum';
import { WikiService } from './wiki.service';

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

  const serviceWith = (responses: LanguageModelV4GenerateResult[]) => {
    const languageModel = new MockLanguageModelV4({ doGenerate: responses });
    const modelService = {
      getModel: () => languageModel,
    } as unknown as ModelService;
    return new WikiService(filesService, modelService);
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wiki-'));
    process.env.FILES_DIR = dir;
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
  });
});
