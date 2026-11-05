import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PublicAppModule } from '../src/public-app.module';
import { PrismaService } from '../src/modules/prisma';

/**
 * Same as main.ts: DATABASE_URL comes from the .env at the root of the
 * repository when not already set.
 * process.loadEnvFile() cannot be used: Jest gives each test file its own
 * copy of process.env, which loadEnvFile does not write to.
 */
function loadDotEnv() {
  let content: string;
  try {
    content = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
  } catch {
    return; // No .env file: keep the environment as is.
  }
  for (const [key, value] of Object.entries(parseEnv(content))) {
    process.env[key] ??= value;
  }
}

/**
 * API tests of the public app, on a temporary wiki folder.
 * No AI provider is called: only routes that do not need a valid key.
 */
describe('Public app (e2e)', () => {
  let app: INestApplication<App>;
  let filesDir: string;

  beforeAll(async () => {
    loadDotEnv();
    filesDir = await mkdtemp(join(tmpdir(), 'wiki-e2e-'));
    process.env.FILES_DIR = filesDir;

    const moduleRef = await Test.createTestingModule({
      imports: [PublicAppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same validation as in main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(filesDir, { recursive: true, force: true });
  });

  it('creates the default wiki pages on startup', () =>
    request(app.getHttpServer())
      .get('/files/wiki')
      .expect(200)
      .expect(['index.md', 'log.md']));

  it('uploads a raw source, then refuses to overwrite it', async () => {
    const upload = () =>
      request(app.getHttpServer())
        .post('/files/raw/upload')
        .attach('file', Buffer.from('# OSI model'), 'osi.md');

    await upload().expect(201);
    await upload().expect(409);
    await request(app.getHttpServer())
      .get('/files/raw/osi.md')
      .expect(200)
      .expect({ area: 'raw', name: 'osi.md', content: '# OSI model' });
  });

  /** Keys stored in the database (they survive restarts, so may exist). */
  const storedKeys = async () =>
    (await request(app.getHttpServer()).get('/llm/api-key').expect(200))
      .body as { provider: string; key: string }[];

  it('rejects an API key with a wrong format without storing it', async () => {
    const before = await storedKeys();
    await request(app.getHttpServer())
      .post('/llm/api-key')
      .send({ provider: 'ANTHROPIC', key: 'sk-proj-notananthropickey123456' })
      .expect(400);
    expect(await storedKeys()).toEqual(before);
  });

  it('returns 404 when asking the wiki without a stored API key', async () => {
    const configured = new Set((await storedKeys()).map((k) => k.provider));
    const provider = ['OPENAI', 'ANTHROPIC', 'GEMINI'].find(
      (p) => !configured.has(p),
    );
    if (!provider) return; // Every provider has a key: nothing to check.
    await request(app.getHttpServer())
      .post('/wiki/query')
      .send({ provider, model: 'any-model', question: 'What is OSI?' })
      .expect(404);
  });

  it('validates the request body', () =>
    request(app.getHttpServer())
      .post('/wiki/query')
      .send({ provider: 'UNKNOWN', question: '' })
      .expect(400));

  describe('conversations', () => {
    const unknownId = '00000000-0000-4000-8000-000000000000';

    it('lists the conversations', () =>
      request(app.getHttpServer())
        .get('/wiki/conversations')
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true)));

    it('returns 400 for an id that is not a UUID', () =>
      request(app.getHttpServer())
        .get('/wiki/conversations/not-a-uuid')
        .expect(400));

    it('returns 404 for an unknown conversation', async () => {
      await request(app.getHttpServer())
        .get(`/wiki/conversations/${unknownId}`)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/wiki/conversations/${unknownId}`)
        .expect(404);
    });

    it('renames a conversation and lists its messages', async () => {
      const prisma = app.get(PrismaService);
      const { id } = await prisma.conversation.create({
        data: {
          title: 'e2e',
          messages: { create: { role: 'user', content: 'Hello' } },
        },
      });
      try {
        await request(app.getHttpServer())
          .patch(`/wiki/conversations/${id}`)
          .send({ title: '  Renamed  ' })
          .expect(200)
          .expect((res) => expect(res.body.title).toBe('Renamed'));
        await request(app.getHttpServer())
          .patch(`/wiki/conversations/${id}`)
          .send({ title: '' })
          .expect(400);
        await request(app.getHttpServer())
          .get(`/wiki/conversations/${id}/messages`)
          .expect(200)
          .expect((res) =>
            expect(res.body.map((m: { content: string }) => m.content)).toEqual(
              ['Hello'],
            ),
          );
      } finally {
        await prisma.conversation.delete({ where: { id } });
      }
    });

    it('returns 404 when renaming or reading the messages of an unknown conversation', async () => {
      await request(app.getHttpServer())
        .patch(`/wiki/conversations/${unknownId}`)
        .send({ title: 'x' })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/wiki/conversations/${unknownId}/messages`)
        .expect(404);
    });

    it('returns 404 when continuing an unknown conversation', () =>
      request(app.getHttpServer())
        .post('/wiki/query')
        .send({
          provider: 'OPENAI',
          model: 'gpt-x',
          question: 'What is OSI?',
          conversationId: unknownId,
        })
        .expect(404)
        .expect((res) => expect(res.body.message).toContain('Conversation')));
  });
});
