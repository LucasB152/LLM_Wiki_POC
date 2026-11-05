import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { WikiArea } from './files.constants';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ---- Schema (AGENTS.md) -------------------------------------------------

  @Get('schema')
  readSchema() {
    return this.filesService.readSchema();
  }

  @Put('schema')
  writeSchema(@Body() { content }: UpdateFileDto) {
    return this.filesService.writeSchema(content);
  }

  // ---- raw/: raw sources, immutable (no updates) --------------------------

  @Get('raw')
  listRaw() {
    return this.filesService.findAll(WikiArea.RAW);
  }

  @Get('raw/:name')
  readRaw(@Param('name') name: string) {
    return this.filesService.findOne(WikiArea.RAW, name);
  }

  /**
   * Adds a source (multipart/form-data).
   * Fields: `file` (the file) and `name` (optional, defaults to the original name).
   */
  @Post('raw/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadRaw(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body() { name }: UploadFileDto,
  ) {
    return this.filesService.addRaw(name ?? file.originalname, file.buffer);
  }

  @Delete('raw/:name')
  removeRaw(@Param('name') name: string) {
    return this.filesService.remove(WikiArea.RAW, name);
  }

  // ---- wiki/: pages maintained by the LLM ---------------------------------

  @Get('wiki')
  listWiki() {
    return this.filesService.findAll(WikiArea.WIKI);
  }

  @Get('wiki/:name')
  readWiki(@Param('name') name: string) {
    return this.filesService.findOne(WikiArea.WIKI, name);
  }

  /** Creates or replaces a wiki page (JSON: `{ "content": "..." }`). */
  @Put('wiki/:name')
  writeWiki(@Param('name') name: string, @Body() { content }: UpdateFileDto) {
    return this.filesService.writeWikiPage(name, content);
  }

  @Delete('wiki/:name')
  removeWiki(@Param('name') name: string) {
    return this.filesService.remove(WikiArea.WIKI, name);
  }
}
