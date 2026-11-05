# LLM Wiki API

NestJS API of the LLM Wiki project: it ingests raw sources into a wiki written by an AI, answers questions from that wiki, and stores the conversations and the API keys in PostgreSQL. For what the project does and how to run it with Docker Compose, see the [project README](../README.md).

## How it works

### Wiki folder

The wiki is a folder of files, set by `FILES_DIR`:

```
data/
  AGENTS.md     wiki schema: conventions and workflows the AI must follow
  raw/          raw sources, immutable: the AI reads them but never modifies them
  wiki/         markdown pages written and maintained by the AI
    index.md    catalog of every page, grouped by category
    log.md      append-only log of every operation
```

`AGENTS.md`, `index.md` and `log.md` are created on startup if they are missing. `AGENTS.md` is given to the AI on every operation: edit it (through the API or by hand) to change how the AI organizes the wiki.

### AI operations

Both operations use tool calling, through the Vercel AI SDK:

1. **Ingest:** the AI gets `list_pages`, `read_page`, `read_source` and `write_page`. It reads the existing pages, creates or updates the relevant ones and rewrites `index.md`. The API then appends an entry to `log.md`. It cannot write to `raw/` or `log.md`.
2. **Query:** the AI only gets **read-only** tools. It answers from the wiki pages only and cites them. The question and the answer are saved in a conversation, and the previous messages of that conversation are sent to the AI as context.

### Supported AI providers

| Provider | `provider` value |
|---|---|
| Google Gemini | `GEMINI` |
| OpenAI | `OPENAI` |
| Anthropic | `ANTHROPIC` |

You choose the provider **and** the model on every AI request. `GET /llm/models/:provider` lists the models available with your key.

### Data storage

| Data | Where |
|---|---|
| Wiki schema, raw sources, wiki pages | Files in `FILES_DIR` |
| Conversations and their messages | PostgreSQL, tables `conversation` and `message` |
| AI providers and API keys | PostgreSQL, tables `provider` and `api_key`. Keys are **encrypted** (AES-256-GCM) with `API_KEY_ENCRYPTION_KEY` and never returned in plain text. |

The database is accessed with Prisma 7: schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`. The Prisma client is generated into `src/generated/prisma`, which is not versioned.

## Getting started

### Docker

The [`Dockerfile`](Dockerfile) builds the API image. When the container starts, [`docker/entrypoint.sh`](docker/entrypoint.sh) applies the pending migrations, then starts the API. [`docker/seed.sh`](docker/seed.sh) saves an API key and ingests sources through the API; Docker Compose runs it once at startup. See the [project README](../README.md#running-with-docker-compose) to run everything.

### Running locally

```bash
cp ../.env.example ../.env     # then fill in API_KEY_ENCRYPTION_KEY
docker compose -f ../docker-compose.yml up -d db   # PostgreSQL only
pnpm install
pnpm exec prisma migrate deploy --config prisma7.config.ts
pnpm exec prisma generate --config prisma7.config.ts
pnpm run start:dev
```

To browse the database: `npx prisma studio --config prisma7.config.ts`.

### Configuration

Variables can be set in the environment or in the `.env` file at the root of the repository (see [`../.env.example`](../.env.example)). This file is loaded at startup, by the Prisma CLI and by the e2e tests, and never overrides variables that are already set. In Docker, the `api` service gets its variables from `docker-compose.yml` instead: `DATABASE_URL` points to the `db` container and `FILES_DIR` to `/app/data`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `FILES_DIR` | `data` | Folder holding `AGENTS.md`, `raw/` and `wiki/` |
| `DATABASE_URL` | *(required)* | PostgreSQL connection string, e.g. `postgresql://wiki:wiki@localhost:5432/llmwiki` |
| `API_KEY_ENCRYPTION_KEY` | *(required)* | 32 random bytes in base64 (`openssl rand -base64 32`). Encrypts the API keys in the database. |
| `CORS_ORIGINS` | *(all origins)* | Origins allowed to call the API, comma-separated, e.g. `http://localhost:5173` |

The API refuses to start if `DATABASE_URL` or `API_KEY_ENCRYPTION_KEY` is missing, or if the database cannot be reached.

## API reference

The API listens on `http://localhost:3000` by default. All bodies are JSON unless stated otherwise. Unknown fields are rejected (`400`).

### All routes

| Method | URL | Description |
|---|---|---|
| `POST` | `/llm/api-key` | Save or replace a provider's API key |
| `GET` | `/llm/api-key` | List the stored keys (masked) |
| `GET` | `/llm/api-key/:provider` | Get one provider's key (masked) |
| `DELETE` | `/llm/api-key/:provider` | Delete a provider's key |
| `GET` | `/llm/models/:provider` | List the models available with the stored key |
| `POST` | `/wiki/ingest/:name` | Ingest a raw source into the wiki |
| `POST` | `/wiki/query` | Ask a question, in a new or an existing conversation |
| `GET` | `/wiki/conversations` | List the conversations |
| `GET` | `/wiki/conversations/:id` | Get a conversation with its messages |
| `GET` | `/wiki/conversations/:id/messages` | Get the messages of a conversation |
| `PATCH` | `/wiki/conversations/:id` | Rename a conversation |
| `DELETE` | `/wiki/conversations/:id` | Delete a conversation and its messages |
| `GET` | `/files/schema` | Read `AGENTS.md` |
| `PUT` | `/files/schema` | Replace `AGENTS.md` |
| `GET` | `/files/raw` | List the raw sources |
| `GET` | `/files/raw/:name` | Read a raw source |
| `POST` | `/files/raw/upload` | Upload a raw source |
| `DELETE` | `/files/raw/:name` | Delete a raw source |
| `GET` | `/files/wiki` | List the wiki pages |
| `GET` | `/files/wiki/:name` | Read a wiki page |
| `PUT` | `/files/wiki/:name` | Create or replace a wiki page by hand |
| `DELETE` | `/files/wiki/:name` | Delete a wiki page |

The sections below describe each group in detail.

### LLM: API keys and models

| Method | URL | Body | Description |
|---|---|---|---|
| `POST` | `/llm/api-key` | `{ "provider", "key" }` | Checks the key, then saves it encrypted, replacing the previous one. Returns it masked. |
| `GET` | `/llm/api-key` | | Lists the configured providers, with masked keys. |
| `GET` | `/llm/api-key/:provider` | | Returns one provider's masked key. |
| `DELETE` | `/llm/api-key/:provider` | | Deletes a provider's key. |
| `GET` | `/llm/models/:provider` | | Lists the models available with the stored key. |

There is one key per provider. Keys are kept in the database, so they survive restarts.

Before a key is saved, it goes through two checks:

1. **Format:** the key must match the provider's usual prefix (`sk-...` for OpenAI, `sk-ant-...` for Anthropic). Google issues several key formats (`AIza...`, `AQ....`), so Gemini keys are only checked for length and allowed characters. Leading and trailing spaces are removed.
2. **Live check:** the API makes a real (free) call to the provider's model listing endpoint with that key.

| Outcome | Response | Key stored? |
|---|---|---|
| Format OK and the provider accepts the key | `201` `{ "provider", "key": "AIza****wxyz", "verified": true }` | Yes, replacing the previous one |
| Wrong format | `400` with a hint about the expected format | No |
| The provider rejects the key (HTTP 400, 401 or 403) | `400` | No, the previous key is kept |
| The provider cannot be reached, times out (10 s) or returns another error (quota, outage...) | `502` | No, the previous key is kept |

Example response of `GET /llm/models/GEMINI`:

```json
{
  "provider": "GEMINI",
  "count": 2,
  "models": [
    { "id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash" },
    { "id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash-Lite" }
  ]
}
```

The `id` is the value to send in the `model` field of the wiki routes. `name` is meant for display.

### Wiki: AI operations

| Method | URL | Body | Description |
|---|---|---|---|
| `POST` | `/wiki/ingest/:name` | `{ "provider", "model" }` | Ingests `raw/:name`: the AI creates / updates pages, rewrites `index.md`, and the API logs the operation. |
| `POST` | `/wiki/query` | `{ "provider", "model", "question", "conversationId"? }` | Answers a question using only the wiki, and saves the question and the answer in a conversation. |

Example response of `POST /wiki/ingest/:name`:

```json
{
  "source": "my-source.md",
  "provider": "GEMINI",
  "model": "gemini-3.5-flash-lite",
  "summary": "Short summary written by the AI.",
  "pagesCreated": ["network-layer.md"],
  "pagesUpdated": ["index.md"],
  "steps": 6,
  "usage": { "inputTokens": 12000, "outputTokens": 3000, "totalTokens": 15000 }
}
```

For `POST /wiki/query`:

- **Without `conversationId`:** a new conversation is created. Its title is the question, cut to 100 characters.
- **With `conversationId`:** the question is added to that conversation, and the AI gets its previous messages as context. `404` if the conversation does not exist; the AI is not called in that case.
- The question and the answer are saved only once the AI has answered. If the call to the provider fails, nothing is saved.

Example response of `POST /wiki/query`:

```json
{
  "conversationId": "3f1c2a9e-8b7d-4c1e-9f0a-2d5b6c7e8f90",
  "messageId": "a4e5f6b7-1c2d-4e3f-8a9b-0c1d2e3f4a5b",
  "question": "What does the network layer do?",
  "provider": "GEMINI",
  "model": "gemini-3.5-flash-lite",
  "answer": "The network layer routes packets... ([Network layer](network-layer.md))",
  "sources": { "pages": ["network-layer.md"], "raw": [] },
  "steps": 3,
  "usage": { "inputTokens": 4000, "outputTokens": 500, "totalTokens": 4500 }
}
```

`sources` lists what the AI actually read: wiki pages and, if it double-checked a detail, raw sources. `messageId` is the id of the saved answer.

Wiki operations that write are queued and run one at a time, so two concurrent ingestions cannot overwrite each other's changes to `index.md`.

### Wiki: conversations

| Method | URL | Body | Description |
|---|---|---|---|
| `GET` | `/wiki/conversations` | | Lists the conversations, most recently active first, without their messages. |
| `GET` | `/wiki/conversations/:id` | | Returns a conversation with all its messages, oldest first. |
| `GET` | `/wiki/conversations/:id/messages` | | Returns only the messages of a conversation, oldest first. |
| `PATCH` | `/wiki/conversations/:id` | `{ "title" }` | Renames a conversation. The title is required, at most 200 characters, and leading and trailing spaces are removed. |
| `DELETE` | `/wiki/conversations/:id` | | Deletes a conversation and its messages. Returns `204`. |

`:id` must be a UUID (`400` otherwise). An unknown id returns `404`. A conversation's `modifiedAt` is updated each time a message is added.

Example response of `GET /wiki/conversations/:id`:

```json
{
  "id": "3f1c2a9e-8b7d-4c1e-9f0a-2d5b6c7e8f90",
  "title": "What does the network layer do?",
  "createdAt": "2026-11-05T13:20:00.000Z",
  "modifiedAt": "2026-11-05T13:21:30.000Z",
  "messages": [
    {
      "id": "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
      "conversationId": "3f1c2a9e-8b7d-4c1e-9f0a-2d5b6c7e8f90",
      "providerId": null,
      "model": null,
      "createdAt": "2026-11-05T13:21:29.000Z",
      "content": "What does the network layer do?",
      "usage": null,
      "role": "user",
      "source": null
    },
    {
      "id": "a4e5f6b7-1c2d-4e3f-8a9b-0c1d2e3f4a5b",
      "conversationId": "3f1c2a9e-8b7d-4c1e-9f0a-2d5b6c7e8f90",
      "providerId": "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
      "model": "gemini-3.5-flash-lite",
      "createdAt": "2026-11-05T13:21:30.000Z",
      "content": "The network layer routes packets... ([Network layer](network-layer.md))",
      "usage": { "inputTokens": 4000, "outputTokens": 500, "totalTokens": 4500 },
      "role": "llm",
      "source": { "pages": ["network-layer.md"], "raw": [] }
    }
  ]
}
```

`role` is `user` for a question and `llm` for an answer. `providerId`, `model`, `usage` and `source` are only filled in for answers.

### Files: direct access to the wiki folder

| Method | URL | Body | Description |
|---|---|---|---|
| `GET` | `/files/schema` | | Reads `AGENTS.md`. |
| `PUT` | `/files/schema` | `{ "content" }` | Replaces `AGENTS.md`. |
| `GET` | `/files/raw` | | Lists raw sources. |
| `GET` | `/files/raw/:name` | | Reads a raw source. |
| `POST` | `/files/raw/upload` | multipart: `file`, optional `name` | Uploads a raw source (max 5 MB). `409` if the name already exists. |
| `DELETE` | `/files/raw/:name` | | Deletes a raw source. |
| `GET` | `/files/wiki` | | Lists wiki pages. |
| `GET` | `/files/wiki/:name` | | Reads a wiki page. |
| `PUT` | `/files/wiki/:name` | `{ "content" }` | Creates or replaces a wiki page by hand. |
| `DELETE` | `/files/wiki/:name` | | Deletes a wiki page. |

Upload example:

```bash
curl -X POST $BASE_URL/files/raw/upload \
  -F 'file=@./my-notes.md' \
  -F 'name=my-notes.md'
```

File names may only contain letters, digits, `.`, `-` and `_`, and must not start with `.`. Sources are read as UTF-8 text, so stick to text formats such as `.md` or `.txt`.

### Error codes

| Code | Meaning |
|---|---|
| `400` | Invalid body, unknown provider, invalid file name, id that is not a UUID, or API key with a wrong format / rejected by the provider |
| `404` | Missing file, unknown conversation, or no API key stored for the provider |
| `409` | A raw source with that name already exists |
| `502` | The AI provider returned an error or could not be reached (unknown model, quota, outage...) |

## Project structure

```
src/
  main.ts                  bootstrap: loading of ../.env, CORS, global validation
  public-app.module.ts     root module of the public app (controllers used by the frontend)
  generated/prisma/        Prisma client, generated by `prisma generate` (not versioned)
  modules/
    prisma/                PrismaService, shared by the whole app (global module)
    llm/                   AI providers: API keys (checked, encrypted, stored), models, conversation storage
    files/                 read / write access to data/ (schema, raw/, wiki/)
    wiki/                  ingestion, questions and conversations: tool-calling loop, tools and prompts
prisma/                    database schema and migrations
docker/                    container entrypoint and seed script
test/                      API tests (e2e)
data/                      the wiki folder (see "Wiki folder"); data/wiki/ is not versioned
```

Each module follows the same layout (a folder only exists when it has content):

```
modules/<name>/
  index.ts           the ONLY entry point other modules may import
  <name>.module.ts   NestJS module
  api/               controllers + DTOs (HTTP only)
  application/       services: business rules
  domain/            types and rules without framework code
  infrastructure/    external access: database repositories, encryption, HTTP calls to the AI providers
```