import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FILE_NAME_PATTERN } from '../files.constants';

/** Text fields of the multipart form (the file itself is handled by multer). */
export class UploadFileDto {
  /** Name to save the file under; defaults to the uploaded file's name. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(FILE_NAME_PATTERN, {
    message:
      'name must only contain letters, digits, ".", "-", "_" and must not start with "."',
  })
  name?: string;
}
