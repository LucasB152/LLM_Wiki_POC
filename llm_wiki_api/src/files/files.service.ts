import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  FILE_NAME_PATTERN,
  INDEX_FILE,
  LOG_FILE,
  SCHEMA_FILE,
  WikiArea,
} from './files.constants';
import { DEFAULT_INDEX, DEFAULT_LOG, DEFAULT_SCHEMA } from './wiki-templates';

/**
 * Access to the LLM Wiki folder:
 *
 *   <FILES_DIR>/
 *     AGENTS.md     wiki schema
 *     raw/          raw sources (immutable)
 *     wiki/         generated pages (including index.md and log.md)
 */
@Injectable()
export class FilesService implements OnModuleInit {
  private readonly rootDir = resolve(process.env.FILES_DIR ?? 'data');

  /** Creates the folder tree and default files if they are missing. */
  async onModuleInit() {
    for (const area of Object.values(WikiArea)) {
      await mkdir(this.dirOf(area), { recursive: true });
    }
    await this.writeIfMissing(join(this.rootDir, SCHEMA_FILE), DEFAULT_SCHEMA);
    await this.writeIfMissing(
      this.pathOf(WikiArea.WIKI, INDEX_FILE),
      DEFAULT_INDEX,
    );
    await this.writeIfMissing(
      this.pathOf(WikiArea.WIKI, LOG_FILE),
      DEFAULT_LOG,
    );
  }

  /** Lists the file names of an area. */
  async findAll(area: WikiArea): Promise<string[]> {
    const entries = await readdir(this.dirOf(area), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && FILE_NAME_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  async findOne(area: WikiArea, name: string) {
    const content = await this.readOrNotFound(this.pathOf(area, name), name);
    return { area, name, content };
  }

  /** Adds a raw source (409 if it already exists: raw/ is immutable). */
  async addRaw(name: string, data: Buffer) {
    try {
      await writeFile(this.pathOf(WikiArea.RAW, name), data, { flag: 'wx' });
    } catch (error) {
      if (this.hasCode(error, 'EEXIST')) {
        throw new ConflictException(`Raw source "${name}" already exists`);
      }
      throw error;
    }
    return { area: WikiArea.RAW, name, size: data.length };
  }

  /** Creates or replaces a wiki page. */
  async writeWikiPage(name: string, content: string) {
    const path = this.pathOf(WikiArea.WIKI, name);
    let created = true;
    try {
      await writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (!this.hasCode(error, 'EEXIST')) throw error;
      await writeFile(path, content, 'utf8');
      created = false;
    }
    return { area: WikiArea.WIKI, name, created };
  }

  /** Appends an entry to wiki/log.md (append-only log). */
  async appendLog(entry: string) {
    await appendFile(
      this.pathOf(WikiArea.WIKI, LOG_FILE),
      `\n${entry.trim()}\n`,
      'utf8',
    );
  }

  /** Deletes a file from an area (404 if it does not exist). */
  async remove(area: WikiArea, name: string) {
    try {
      await unlink(this.pathOf(area, name));
    } catch (error) {
      if (
        this.hasCode(error, 'ENOENT') ||
        this.hasCode(error, 'EISDIR') ||
        this.hasCode(error, 'EPERM')
      ) {
        throw new NotFoundException(`File "${area}/${name}" not found`);
      }
      throw error;
    }
    return { area, name, deleted: true };
  }

  async readSchema() {
    const content = await this.readOrNotFound(
      join(this.rootDir, SCHEMA_FILE),
      SCHEMA_FILE,
    );
    return { name: SCHEMA_FILE, content };
  }

  async writeSchema(content: string) {
    await writeFile(join(this.rootDir, SCHEMA_FILE), content, 'utf8');
    return { name: SCHEMA_FILE, content };
  }

  private dirOf(area: WikiArea): string {
    return join(this.rootDir, area);
  }

  /** Resolves the path, rejecting any name that would escape the area. */
  private pathOf(area: WikiArea, name: string): string {
    if (!FILE_NAME_PATTERN.test(name)) {
      throw new BadRequestException(`Invalid file name "${name}"`);
    }
    return join(this.dirOf(area), name);
  }

  private async readOrNotFound(path: string, label: string): Promise<string> {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (this.hasCode(error, 'ENOENT') || this.hasCode(error, 'EISDIR')) {
        throw new NotFoundException(`File "${label}" not found`);
      }
      throw error;
    }
  }

  private async writeIfMissing(path: string, content: string) {
    try {
      await writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (!this.hasCode(error, 'EEXIST')) throw error;
    }
  }

  /** No `instanceof Error`: unreliable across realms (e.g. under Jest). */
  private hasCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as NodeJS.ErrnoException).code === code
    );
  }
}
