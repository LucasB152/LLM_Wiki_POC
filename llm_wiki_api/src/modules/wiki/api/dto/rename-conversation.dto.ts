import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}
