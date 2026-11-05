import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { type LanguageModel } from 'ai';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AiProvider } from './ai-provider.enum';
import { ApiKeyService } from './api-key.service';
import { fetchProviderModels } from './provider-api';

@Injectable()
export class ModelService {
  private readonly logger = new Logger(ModelService.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  /** Fetches the raw list of models available with the provider's stored key. */
  async listModels(provider: AiProvider): Promise<unknown> {
    const apiKey = this.apiKeyService.getKey(provider);
    try {
      return await fetchProviderModels(provider, apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider} list models failed: ${message}`);
      throw new BadGatewayException(
        `${provider} list models failed: ${message}`,
      );
    }
  }

  /** Builds the provider client with the stored key (throws 404 if missing). */
  getModel(provider: AiProvider, modelId: string): LanguageModel {
    const apiKey = this.apiKeyService.getKey(provider);
    switch (provider) {
      case AiProvider.GEMINI:
        return createGoogle({ apiKey })(modelId);
      case AiProvider.OPENAI:
        return createOpenAI({ apiKey })(modelId);
      case AiProvider.ANTHROPIC:
        return createAnthropic({ apiKey })(modelId);
    }
  }
}
