import { Module } from '@nestjs/common';
import { WikiService } from './application/wiki.service';
import { WikiController } from './api/wiki.controller';
import { LlmModule } from '../llm';
import { FilesModule } from '../files';

@Module({
  imports: [LlmModule, FilesModule],
  controllers: [WikiController],
  providers: [WikiService],
})
export class WikiModule {}
