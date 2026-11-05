import { Module } from '@nestjs/common';
import { WikiService } from './wiki.service';
import { WikiController } from './wiki.controller';
import { LlmModule } from '../llm/llm.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [LlmModule, FilesModule],
  controllers: [WikiController],
  providers: [WikiService],
})
export class WikiModule {}
