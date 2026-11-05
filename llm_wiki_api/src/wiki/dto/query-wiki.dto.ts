import { IsNotEmpty, IsString } from 'class-validator';
import { IngestSourceDto } from './ingest-source.dto';

export class QueryWikiDto extends IngestSourceDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}
