import { Module } from '@nestjs/common';
import { LlmController } from './api/llm.controller';
import { ApiKeyService } from './application/api-key.service';
import { ModelService } from './application/model.service';
import { ConversationRepository } from './infrastructure/conversation.repository';
import { ApiKeyCipher } from './infrastructure/api-key.cipher';
import { ApiKeyRepository } from './infrastructure/api-key.repository';

/** Everything related to AI providers: API keys, model access and conversations. */
@Module({
  controllers: [LlmController],
  providers: [
    ApiKeyService,
    ModelService,
    ApiKeyCipher,
    ApiKeyRepository,
    ConversationRepository,
  ],
  exports: [ModelService, ConversationRepository],
})
export class LlmModule {}
