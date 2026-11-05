import { Body, Controller, Param, Post } from '@nestjs/common';
import { WikiService } from './wiki.service';
import { IngestSourceDto } from './dto/ingest-source.dto';
import { QueryWikiDto } from './dto/query-wiki.dto';

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

  /** Asks a question: the AI answers only from the wiki pages. */
  @Post('query')
  query(@Body() dto: QueryWikiDto) {
    return this.wikiService.query(dto);
  }
}
