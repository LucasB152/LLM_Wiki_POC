import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IngestSourceDto } from './ingest-source.dto';

export class QueryWikiDto extends IngestSourceDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  /** Conversation to continue. Omitted: a new conversation is created. */
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
