# LLM Wiki POC

An AI builds and maintains a **wiki** from your own documents, then answers questions using **only** that wiki.

You never write the wiki yourself:

1. **Add sources.** Drop raw documents (Markdown or text) into the project.
2. **Ingest.** The AI reads each source and writes structured, interlinked wiki pages, plus an index and a log.
3. **Ask.** Ask questions. The AI answers from the wiki pages only and cites the pages it used. If the wiki does not contain the answer, it says so. Questions and answers are saved as conversations, so you can ask follow-up questions.

The AI can be **Google Gemini**, **OpenAI** or **Anthropic**: you bring your own API key and choose the model.

> **Status:** proof of concept. There is no authentication and no frontend yet: the project is used through its HTTP API.

## Repository layout

```
.
├── docker-compose.yml   starts the whole project (database, API, initial ingestion)
├── .env.example         configuration template, to copy to .env
└── llm_wiki_api/        NestJS API, see its README for details and the full list of routes
    └── data/raw/        sample sources: computer networking, one file per OSI layer
```

| Component | Technology |
|---|---|
| API | NestJS (TypeScript), Vercel AI SDK |
| Database | PostgreSQL 17 with Prisma 7: conversations, messages, API keys (encrypted) |
| Wiki | Markdown files written by the AI |

## Running with Docker Compose

### 1. Requirements

- Docker with Docker Compose.
- An API key for Gemini, OpenAI or Anthropic. You can start without one, but then nothing gets ingested.
- Ports **3000** (API) and **5432** (PostgreSQL) must be free.

### 2. Configure

Copy the configuration template:

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `API_KEY_ENCRYPTION_KEY` | Yes | Encrypts the API keys stored in the database. Generate it with `openssl rand -base64 32`. |
| `LLM_PROVIDER` | Yes | `GEMINI`, `OPENAI` or `ANTHROPIC` |
| `LLM_API_KEY` | Yes | Your key for that provider |
| `LLM_MODEL` | Yes | Model used for the initial ingestion, e.g. `gemini-3.5-flash-lite` |
| `SEED_SOURCES` | No | Sources to ingest at startup, separated by spaces. Default: the first three files of `llm_wiki_api/data/raw/`. |
| `CORS_ORIGINS` | No | Origins allowed to call the API, e.g. `http://localhost:5173`. Default: all origins. |

`.env` is not versioned: never commit it.

### 3. Start

```bash
docker compose up -d --build
```

Three services start, in this order:

| Service | Role |
|---|---|
| `db` | PostgreSQL database |
| `api` | Applies the database migrations, then serves the API on **http://localhost:3000** |
| `seed` | Saves your API key, asks the AI to ingest the sample sources, then stops |

The ingestion takes about a minute per source. To follow it:

```bash
docker compose logs -f seed
```

It is finished when the last line lists the wiki pages, for example `[seed] Wiki pages: ["couche-physique.md", ...]`.

### 4. Try it

Ask a question about the ingested sources:

```bash
curl -X POST http://localhost:3000/wiki/query \
  -H 'Content-Type: application/json' \
  -d '{"provider": "GEMINI", "model": "gemini-3.5-flash-lite", "question": "Quel est le rôle de la couche physique ?"}'
```

The response contains the answer, the wiki pages used and a `conversationId`. Send that `conversationId` with your next question to continue the conversation.

Other useful routes:

| Route | What it shows |
|---|---|
| `GET /files/wiki` | Wiki pages written by the AI |
| `GET /files/wiki/index.md` | Index of the wiki |
| `GET /files/raw` | Available sources |
| `GET /wiki/conversations` | Saved conversations |

The [API README](llm_wiki_api/README.md#api-reference) describes every route.

### 5. Stop

| Command | Effect |
|---|---|
| `docker compose stop` | Stops the containers. The data is kept, and `docker compose start` restarts them. |
| `docker compose down` | Deletes the containers. **All data is lost.** |

The project uses no Docker volume. The wiki pages live in the `api` container and the database in the `db` container, so both are lost when the containers are recreated. On the next `docker compose up`, the seed saves your key and ingests the sources again.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `set API_KEY_ENCRYPTION_KEY in .env` when starting | `.env` is missing or the variable is empty. Fill it in (see step 2). |
| `port is already allocated` | Port 3000 or 5432 is used by something else, for example the API or a database started locally. Stop it, then run `docker compose up -d` again. |
| Seed logs: `No ... API key (set LLM_API_KEY): ingestion skipped.` | `LLM_API_KEY` is empty in `.env`. |
| Seed logs: `LLM_MODEL is not set` | `LLM_MODEL` is empty in `.env`. |
| Seed logs: `Key refused` | The key does not match the provider (wrong format, or rejected by the provider). Check `LLM_PROVIDER` and `LLM_API_KEY`. |
| Seed logs: `failed: ... 502` | The provider refused the request: unknown model, quota exceeded... The message gives the reason. |

After changing `.env`, run `docker compose up -d` again: Compose recreates the containers that use the changed variables.

## Development

To work on the API without Docker (hot reload, tests...), see [Running locally](llm_wiki_api/README.md#running-locally) in the API README. Locally, the API reads the same `.env` file at the root of the repository.
