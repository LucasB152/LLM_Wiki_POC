import { Module } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { ApiKeyService } from './api-key.service';
import { ModelService } from './model.service';

/** Everything related to AI providers: API keys and model access. */
@Module({
  controllers: [LlmController],
  providers: [ApiKeyService, ModelService],
  exports: [ModelService],
})
export class LlmModule {}
