import { AiProvider } from '../domain/ai-provider.enum';

/** Error raised when a provider answers with a non-2xx HTTP status. */
export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Timeout of the calls to the providers' model listing endpoints. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Builds the provider's "list models" request, authenticated with `apiKey`. */
function modelsRequest(
  provider: AiProvider,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case AiProvider.GEMINI:
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
        headers: { 'x-goog-api-key': apiKey },
      };
    case AiProvider.OPENAI:
      return {
        url: 'https://api.openai.com/v1/models',
        headers: { Authorization: `Bearer ${apiKey}` },
      };
    case AiProvider.ANTHROPIC:
      return {
        url: 'https://api.anthropic.com/v1/models?limit=1000',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      };
  }
}

/**
 * Calls the provider's "list models" endpoint and returns the raw JSON.
 * Shared by ApiKeyService (to check a key works) and ModelService.
 *
 * @throws ProviderHttpError on a non-2xx response; other errors (network,
 * timeout) are rethrown as is.
 */
export async function fetchProviderModels(
  provider: AiProvider,
  apiKey: string,
): Promise<unknown> {
  const { url, headers } = modelsRequest(provider, apiKey);
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ProviderHttpError(
      response.status,
      `HTTP ${response.status}: ${await response.text()}`,
    );
  }
  return response.json();
}
