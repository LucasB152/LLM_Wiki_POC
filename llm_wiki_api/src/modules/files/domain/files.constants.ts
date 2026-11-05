/** Plain file name: no "/", no ".." and no hidden file. */
export const FILE_NAME_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/**
 * The two content areas of an LLM Wiki:
 * - `raw`:  raw sources, immutable (the LLM reads them, never modifies them);
 * - `wiki`: markdown pages written and maintained by the LLM.
 */
export enum WikiArea {
  RAW = 'raw',
  WIKI = 'wiki',
}

/** Schema file, at the root: conventions the LLM must follow. */
export const SCHEMA_FILE = 'AGENTS.md';

/** Special wiki pages, created on startup if missing. */
export const INDEX_FILE = 'index.md';
export const LOG_FILE = 'log.md';
