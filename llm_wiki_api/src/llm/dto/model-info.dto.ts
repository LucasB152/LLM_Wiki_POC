import { AiProvider } from '../ai-provider.enum';

/** Normalized model, identical whatever the provider. */
export interface ModelInfo {
  /** ID to send back in the `model` field of the wiki routes. */
  id: string;
  /** Human-readable name to display. */
  name: string;
}

export interface ModelListResponse {
  provider: AiProvider;
  count: number;
  models: ModelInfo[];
}
