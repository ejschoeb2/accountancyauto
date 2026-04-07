/**
 * TipTap document structure types.
 * Re-exported from database.ts for a dedicated import path.
 * Use these types wherever TipTap JSON bodies are handled to avoid `any`.
 */
export type { TipTapDocument, TipTapNode } from './database';

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}
