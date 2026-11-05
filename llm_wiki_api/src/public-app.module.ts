import { Module } from '@nestjs/common';
import { LlmModule } from './modules/llm';
import { FilesModule } from './modules/files';
import { WikiModule } from './modules/wiki';
import { PrismaModule } from './modules/prisma';

/** Root module of the public app: controllers reached by the frontend. */
@Module({
  imports: [PrismaModule, LlmModule, FilesModule, WikiModule],
})
export class PublicAppModule {}
