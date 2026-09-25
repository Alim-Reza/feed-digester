export type ClassificationInput = {
  authorName: string;
  authorHeadline: string | null;
  content: string;
  ocrText: string | null;
  /** Detected language (filter stage), used by the Laya implementation to pick a checkpoint. */
  language: string | null;
};

export type ClassificationResult = {
  /** categoryId -> confidence, 0..1. Multi-label — spec's own example scores several at once. */
  categories: Record<string, number>;
  /** Highest-scoring configured category. */
  primaryCategory: string;
  /** Overall "worth reading" score, 0..1 — independent of category confidence. */
  relevance: number;
};

/**
 * Swappable like `LLMProvider`/`OcrProvider`/`CollectorDriver` (ADR 0003): the `classify` stage
 * depends on this, never on Laya or gemma4 directly, so the bake-off is a config change.
 */
export interface Classifier {
  readonly name: string;
  readonly model: string;
  classifyBatch(inputs: ClassificationInput[]): Promise<ClassificationResult[]>;
  /** Releases any loaded model. Call once at the end of the `classify` stage (CLAUDE.md's memory-budget rule). */
  release(): Promise<void>;
}
