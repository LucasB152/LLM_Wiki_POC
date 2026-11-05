# LLM Wiki API

A NestJS API that lets an AI build and maintain a **wiki** from your own documents, then answer questions using **only** that wiki.

> **Status:** proof of concept. API keys are kept in memory and there is no database or authentication yet.

## How it works

The idea follows the "LLM Wiki" pattern. You never edit the wiki by hand: you drop raw documents in, and an AI turns them into a structured, interlinked set of markdown pages.

```
data/
  AGENTS.md     wiki schema: conventions and workflows the AI must follow
  raw/          raw sources, immutable: the AI reads them but never modifies them
  wiki/         markdown pages written and maintained by the AI
    index.md    catalog of every page, grouped by category
    log.md      append-only log of every operation
```

The two main operations:

1. **Ingest:** you upload a source to `raw/` and ask the AI to ingest it. Using tool calling (`list_pages`, `read_page`, `read_source`, `write_page`), the AI reads the existing pages, creates or updates the relevant ones and rewrites `index.md`. The API then appends an entry to `log.md`.
2. **Query:** you ask a question. The AI only gets **read-only** tools. It reads the relevant pages and answers from the wiki content only, citing the pages it used. If the wiki does not contain the answer, it says so instead of falling back on its general knowledge. It has no internet access.

`AGENTS.md`, `index.md` and `log.md` are created automatically on first startup if they are missing. You can edit `AGENTS.md` (through the API or by hand) to change how the AI organizes the wiki.

### Sample content

The project ships with **AI-generated source documents about computer networking**, already present in `data/raw/`. They let you try ingestion and questions right away, without bringing your own documents.

### Supported AI providers

| Provider | `provider` value |
|---|---|
| Google Gemini | `GEMINI` |
| OpenAI | `OPENAI` |
| Anthropic | `ANTHROPIC` |

You choose the provider **and** the model on every AI request. `GET /llm/models/:provider` lists the models available with your key.

The API listens on `http://localhost:3000` by default.

### Configuration

Variables can be set in the environment or in a `.env` file at the root of the project. The `.env` file is loaded at startup and never overrides variables that are already set.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `FILES_DIR` | `data` | Folder holding `AGENTS.md`, `raw/` and `wiki/` |

## API reference

All bodies are JSON unless stated otherwise. Unknown fields are rejected (`400`).

### LLM: API keys and models

| Method | URL | Body | Description |
|---|---|---|---|
| `POST` | `/llm/api-key` | `{ "provider", "key" }` | Checks the key, then saves or replaces it. Returns it masked. |
| `GET` | `/llm/api-key` | | Lists configured providers, with masked keys. |
| `GET` | `/llm/api-key/:provider` | | Returns one provider's masked key. |
| `DELETE` | `/llm/api-key/:provider` | | Deletes a provider's key. |
| `GET` | `/llm/models/:provider` | | Lists the models available with the stored key. |

Before a key is saved, it goes through two checks:

1. **Format:** the key must match the provider's usual prefix (`sk-...` for OpenAI, `sk-ant-...` for Anthropic). Google issues several key formats (`AIza...`, `AQ....`), so Gemini keys are only checked for length and allowed characters. Leading and trailing spaces are removed.
2. **Live check:** the API makes a real (free) call to the provider's model listing endpoint with that key.

| Outcome | Response | Key stored? |
|---|---|---|
| Format OK and the provider accepts the key | `201` `{ "provider", "key": "sk-a****wxyz", "verified": true }` | Yes, replacing the previous one |
| Wrong format | `400` with a hint about the expected format | No |
| The provider rejects the key (HTTP 400, 401 or 403) | `400` | No, the previous key is kept |
| The provider cannot be reached, times out (10 s) or returns another error (quota, outage...) | `502` | No, the previous key is kept |

Example response of `GET /llm/models/ANTHROPIC`:

```json
{
  "provider": "ANTHROPIC",
  "count": 2,
  "models": [
    { "id": "claude-haiku-5-5", "name": "Claude Haiku 5.5" },
    { "id": "claude-sonnet-5-5", "name": "Claude Sonnet 5.5" }
  ]
}
```

The `id` is the value to send in the `model` field of the wiki routes; `name` is meant for display.

### Wiki: AI operations

| Method | URL | Body | Description |
|---|---|---|---|
| `POST` | `/wiki/ingest/:name` | `{ "provider", "model" }` | Ingests `raw/:name`: the AI creates / updates pages, rewrites `index.md`, and the API logs the operation. |
| `POST` | `/wiki/query` | `{ "provider", "model", "question" }` | Answers a question using only the wiki. |

Example response of `POST /wiki/ingest/:name`:

```json
{
  "source": "my-source.md",
  "provider": "ANTHROPIC",
  "model": "claude-sonnet-5-5",
  "summary": "Short summary written by the AI.",
  "pagesCreated": ["network-layer.md"],
  "pagesUpdated": ["index.md"],
  "steps": 6,
  "usage": { "inputTokens": 12000, "outputTokens": 3000, "totalTokens": 15000 }
}
```

Example response of `POST /wiki/query`:

```json
{
  "question": "What does the network layer do?",
  "provider": "ANTHROPIC",
  "model": "claude-sonnet-5-5",
  "answer": "The network layer routes packets... ([Network layer](network-layer.md))",
  "sources": { "pages": ["network-layer.md"], "raw": [] },
  "steps": 3,
  "usage": { "inputTokens": 4000, "outputTokens": 500, "totalTokens": 4500 }
}
```

`sources` lists what the AI actually read: wiki pages and, if it double-checked a detail, raw sources.

Wiki operations that write are queued and run one at a time, so two concurrent ingestions cannot overwrite each other's changes to `index.md`.

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
| `400` | Invalid body, unknown provider, invalid file name, or API key with a wrong format / rejected by the provider |
| `404` | Missing file, or no API key stored for the provider |
| `409` | A raw source with that name already exists |
| `502` | The AI provider returned an error or could not be reached (unknown model, quota, outage...) |

## Project structure

```
src/
  main.ts           bootstrap: .env loading, global validation
  app.module.ts     root module
  llm/              AI providers
    api-key.service.ts   API keys: format + live check, in-memory storage
    model.service.ts     model listing and provider clients for the AI SDK
    provider-api.ts      HTTP calls to the providers, shared by both services
  files/            read / write access to data/ (schema, raw/, wiki/)
  wiki/             ingestion and query: tool-calling loop, tools and prompts
data/               the wiki itself (see "How it works")
```

## Tests and code quality

```bash
pnpm run test        # unit tests (the AI is mocked: no API key needed)
pnpm run test:cov    # coverage
pnpm run lint        # oxlint
pnpm run format      # prettier
```

## Roadmap

Sections will be added here as the project grows, for example:

- **Database:** persistent (encrypted) storage of API keys and data.
- **Docker Compose:** running the API and its services with a single command.
