import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
} from '@nestjs/common';
import { ApiKeyService } from '../application/api-key.service';
import { ModelService } from '../application/model.service';
import { AiProvider } from '../domain/ai-provider.enum';
import { ModelInfo, ModelListResponse } from './dto/model-info.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface GeminiModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

interface OpenAiModel {
  id: string;
}

interface AnthropicModel {
  id: string;
  display_name?: string;
}

@Controller('llm')
export class LlmController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly modelService: ModelService,
  ) {}

  // ---- API keys -----------------------------------------------------------

  /** Checks a provider's key (format + real call) and saves it. */
  @Post('api-key')
  createApiKey(@Body() createApiKeyDto: CreateApiKeyDto) {
    return this.apiKeyService.create(createApiKeyDto);
  }

  @Get('api-key')
  findAllApiKeys() {
    return this.apiKeyService.findAll();
  }

  @Get('api-key/:provider')
  findApiKey(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ) {
    return this.apiKeyService.findOne(provider);
  }

  @Delete('api-key/:provider')
  removeApiKey(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ) {
    return this.apiKeyService.remove(provider);
  }

  // ---- Models -------------------------------------------------------------

  /** Lists the models available with the provider's stored key, in a common format. */
  @Get('models/:provider')
  async listModels(
    @Param('provider', new ParseEnumPipe(AiProvider)) provider: AiProvider,
  ): Promise<ModelListResponse> {
    const raw = await this.modelService.listModels(provider);
    const models = this.formatModels(provider, raw).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return { provider, count: models.length, models };
  }

  private formatModels(provider: AiProvider, raw: unknown): ModelInfo[] {
    switch (provider) {
      case AiProvider.GEMINI: {
        const list = (raw as { models?: GeminiModel[] }).models ?? [];
        return (
          list
            // Keep only models that can be used for text generation.
            .filter(
              (m) =>
                m.supportedGenerationMethods?.includes('generateContent') ??
                true,
            )
            .map((m) => {
              const id = m.name.replace(/^models\//, '');
              return { id, name: m.displayName ?? id };
            })
        );
      }
      case AiProvider.OPENAI: {
        const list = (raw as { data?: OpenAiModel[] }).data ?? [];
        return list.map((m) => ({ id: m.id, name: m.id }));
      }
      case AiProvider.ANTHROPIC: {
        const list = (raw as { data?: AnthropicModel[] }).data ?? [];
        return list.map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
      }
    }
  }
}
