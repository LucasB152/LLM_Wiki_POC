import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { WikiService } from '../application/wiki.service';
import { IngestSourceDto } from './dto/ingest-source.dto';
import { QueryWikiDto } from './dto/query-wiki.dto';
import { RenameConversationDto } from './dto/rename-conversation.dto';

@Controller('wiki')
export class WikiController {
  constructor(private readonly wikiService: WikiService) {}

  /**
   * Ingests a source already uploaded to raw/ (via POST /files/raw/upload):
   * the AI creates / updates the wiki pages, the index and the log.
   */
  @Post('ingest/:name')
  ingest(@Param('name') name: string, @Body() dto: IngestSourceDto) {
    return this.wikiService.ingest(name, dto);
  }

  /**
   * Asks a question: the AI answers only from the wiki pages. Pass
   * `conversationId` to continue a conversation, otherwise one is created.
   */
  @Post('query')
  query(@Body() dto: QueryWikiDto) {
    return this.wikiService.query(dto);
  }

  /** Lists the conversations, most recently active first. */
  @Get('conversations')
  findConversations() {
    return this.wikiService.findConversations();
  }

  /** Returns a conversation with all its messages. */
  @Get('conversations/:id')
  findConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.wikiService.findConversation(id);
  }

  /** Returns the messages of a conversation, oldest first. */
  @Get('conversations/:id/messages')
  findMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.wikiService.findMessages(id);
  }

  /** Changes the title of a conversation. */
  @Patch('conversations/:id')
  renameConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { title }: RenameConversationDto,
  ) {
    return this.wikiService.renameConversation(id, title);
  }

  /** Deletes a conversation and its messages. */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.wikiService.deleteConversation(id);
  }
}
