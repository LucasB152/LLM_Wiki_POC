import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AiProvider } from '../../llm/ai-provider.enum';

export class IngestSourceDto {
  @IsEnum(AiProvider)
  provider: AiProvider;

  /** ID of the model to use (see GET /llm/models/:provider). */
  @IsString()
  @IsNotEmpty()
  model: string;
}
