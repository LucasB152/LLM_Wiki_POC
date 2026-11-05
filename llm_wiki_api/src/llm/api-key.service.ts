import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiProvider } from './ai-provider.enum';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { fetchProviderModels, ProviderHttpError } from './provider-api';

/**
 * Expected key format per provider. Deliberately loose (prefix + charset +
 * minimum length): the live check against the provider is the real test.
 */
const KEY_FORMATS: Record<AiProvider, { pattern: RegExp; hint: string }> = {
  // Google issues several key formats ("AIza...", "AQ...." with dots...), so
  // no prefix is required: only the charset and length, and no OpenAI /
  // Anthropic key by mistake.
  [AiProvider.GEMINI]: {
    pattern: /^(?!sk-)[A-Za-z0-9._-]{30,}$/,
    hint: 'a Google AI Studio key is at least 30 characters long and made of letters, digits, ".", "-" and "_"',
  },
  [AiProvider.OPENAI]: {
    pattern: /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/,
    hint: 'an OpenAI key starts with "sk-" (e.g. "sk-proj-...")',
  },
  [AiProvider.ANTHROPIC]: {
    pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    hint: 'an Anthropic key starts with "sk-ant-"',
  },
};

/**
 * HTTP statuses meaning "this key is wrong" (Gemini answers 400
 * API_KEY_INVALID, OpenAI and Anthropic answer 401).
 */
const INVALID_KEY_STATUSES = new Set([400, 401, 403]);

/**
 * In-memory storage of API keys (one key per provider).
 * Temporary: keys are lost when the server restarts.
 * To be replaced by a database (encrypted keys) later.
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly apiKeys = new Map<AiProvider, string>();

  /**
   * Checks the key (format, then a real call to the provider) and saves it,
   * replacing any previous key. Nothing is stored if a check fails.
   *
   * @throws BadRequestException if the format is wrong or the provider rejects the key
   * @throws BadGatewayException if the provider could not be reached to verify it
   */
  async create({ provider, key }: CreateApiKeyDto) {
    const apiKey = key.trim();
    this.checkFormat(provider, apiKey);
    await this.checkWithProvider(provider, apiKey);

    this.apiKeys.set(provider, apiKey);
    return { provider, key: this.mask(apiKey), verified: true };
  }

  /** Lists configured providers, with masked keys. */
  findAll() {
    return [...this.apiKeys.entries()].map(([provider, key]) => ({
      provider,
      key: this.mask(key),
    }));
  }

  findOne(provider: AiProvider) {
    return { provider, key: this.mask(this.getKey(provider)) };
  }

  remove(provider: AiProvider) {
    if (!this.apiKeys.delete(provider)) {
      throw new NotFoundException(`No API key stored for ${provider}`);
    }
    return { provider, deleted: true };
  }

  /** Returns the plain-text key — internal use only (ModelService). */
  getKey(provider: AiProvider): string {
    const key = this.apiKeys.get(provider);
    if (!key) {
      throw new NotFoundException(
        `No API key stored for ${provider}. Send it first with POST /llm/api-key`,
      );
    }
    return key;
  }

  /** Rejects keys that obviously do not belong to the provider. */
  private checkFormat(provider: AiProvider, apiKey: string) {
    const { pattern, hint } = KEY_FORMATS[provider];
    if (!pattern.test(apiKey)) {
      throw new BadRequestException(
        `Invalid ${provider} API key format: ${hint}.`,
      );
    }
  }

  /** Makes a real (free) call to the provider to make sure the key works. */
  private async checkWithProvider(provider: AiProvider, apiKey: string) {
    try {
      await fetchProviderModels(provider, apiKey);
    } catch (error) {
      if (
        error instanceof ProviderHttpError &&
        INVALID_KEY_STATUSES.has(error.status)
      ) {
        throw new BadRequestException(
          `${provider} rejected the API key (HTTP ${error.status}).`,
        );
      }
      // Quota, provider outage, network error, timeout...: the key may be
      // fine, but we cannot tell, so it is not stored.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider} API key check failed: ${message}`);
      throw new BadGatewayException(
        `Could not verify the ${provider} API key: ${message}`,
      );
    }
  }

  private mask(key: string): string {
    return key.length <= 8 ? '****' : `${key.slice(0, 4)}****${key.slice(-4)}`;
  }
}
