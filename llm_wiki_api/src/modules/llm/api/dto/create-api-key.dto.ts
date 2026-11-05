import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AiProvider } from '../../domain/ai-provider.enum';

export class CreateApiKeyDto {
  /** Real keys go up to ~170 characters (e.g. OpenAI "sk-proj-..."). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  key: string;

  @IsEnum(AiProvider)
  @IsNotEmpty()
  @MaxLength(100)
  provider: AiProvider;
}
