import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './llm/llm.module';
import { FilesModule } from './files/files.module';
import { WikiModule } from './wiki/wiki.module';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [LlmModule, FilesModule, WikiModule],
})
export class AppModule {}
