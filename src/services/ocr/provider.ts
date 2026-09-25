/**
 * Kept as an interface, like `Classifier` and `LLMProvider`, so the `ocr` stage's decision
 * logic (which images to process, keep-vs-discard, batching) is unit testable against a fake
 * without loading real trained-data models — see `pipeline/stages/ocr.test.ts`.
 */
export interface OcrProvider {
  recognize(imagePath: string): Promise<string>;
  /** Releases underlying resources (the tesseract worker). Call once per stage run. */
  dispose(): Promise<void>;
}
