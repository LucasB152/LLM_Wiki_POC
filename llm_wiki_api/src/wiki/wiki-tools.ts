import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { FilesService } from '../files/files.service';
import { LOG_FILE, WikiArea } from '../files/files.constants';

/** What the AI read / wrote during a run, reported in the response. */
export interface WikiActivity {
  pagesRead: Set<string>;
  sourcesRead: Set<string>;
  pagesCreated: Set<string>;
  pagesUpdated: Set<string>;
}

export const newActivity = (): WikiActivity => ({
  pagesRead: new Set(),
  sourcesRead: new Set(),
  pagesCreated: new Set(),
  pagesUpdated: new Set(),
});

/** Page name allowed for writing: lowercase, hyphens, .md extension. */
const PAGE_NAME = /^[a-z0-9][a-z0-9-]*\.md$/;

/**
 * Errors are returned to the AI as a result (instead of being thrown)
 * so it can fix its call (unknown page name, etc.).
 */
async function safely<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Read tools, shared by ingestion and queries. */
function readTools(filesService: FilesService, activity: WikiActivity) {
  return {
    list_pages: tool({
      description:
        'Liste les noms de toutes les pages du wiki (dossier wiki/).',
      inputSchema: z.object({}),
      execute: () => safely(() => filesService.findAll(WikiArea.WIKI)),
    }),
    read_page: tool({
      description: "Lit le contenu markdown complet d'une page du wiki.",
      inputSchema: z.object({
        name: z.string().describe('Nom du fichier, ex. "couche-reseau.md"'),
      }),
      execute: ({ name }) =>
        safely(async () => {
          const { content } = await filesService.findOne(WikiArea.WIKI, name);
          activity.pagesRead.add(name);
          return { name, content };
        }),
    }),
    list_sources: tool({
      description: 'Liste les noms des sources brutes (dossier raw/).',
      inputSchema: z.object({}),
      execute: () => safely(() => filesService.findAll(WikiArea.RAW)),
    }),
    read_source: tool({
      description: 'Lit une source brute de raw/ (lecture seule).',
      inputSchema: z.object({ name: z.string() }),
      execute: ({ name }) =>
        safely(async () => {
          const { content } = await filesService.findOne(WikiArea.RAW, name);
          activity.sourcesRead.add(name);
          return { name, content };
        }),
    }),
  };
}

/** Tools for a query: read-only. */
export function createQueryTools(
  filesService: FilesService,
  activity: WikiActivity,
): ToolSet {
  return readTools(filesService, activity);
}

/** Tools for ingestion: read + write wiki pages. */
export function createIngestTools(
  filesService: FilesService,
  activity: WikiActivity,
): ToolSet {
  return {
    ...readTools(filesService, activity),
    write_page: tool({
      description:
        'Crée ou remplace entièrement une page du wiki (y compris index.md). ' +
        'Le contenu fourni remplace tout le fichier : pour modifier une page existante, ' +
        "lis-la d'abord puis renvoie la version complète mise à jour.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            'Minuscules et tirets, extension .md, ex. "couche-reseau.md"',
          ),
        content: z.string().describe('Contenu markdown complet de la page'),
      }),
      execute: ({ name, content }) =>
        safely(async () => {
          if (name === LOG_FILE) {
            throw new Error(
              `${LOG_FILE} est géré automatiquement, ne l'écris pas.`,
            );
          }
          if (!PAGE_NAME.test(name)) {
            throw new Error(
              `Nom invalide "${name}" : minuscules, chiffres et tirets uniquement, extension .md.`,
            );
          }
          const { created } = await filesService.writeWikiPage(name, content);
          if (created) activity.pagesCreated.add(name);
          else if (!activity.pagesCreated.has(name))
            activity.pagesUpdated.add(name);
          return { name, status: created ? 'created' : 'updated' };
        }),
    }),
  };
}
