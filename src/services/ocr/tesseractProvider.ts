import { createWorker } from 'tesseract.js';
import type { OcrProvider } from './provider';

/**
 * Real, tesseract.js-backed OCR — English and Bangla (`eng`+`ben`, grill C5), run locally, no
 * network calls per image (only the one-time trained-data download tesseract.js itself
 * manages). Not unit tested directly, same as `collector/driver.ts`'s Playwright driver; the
 * `ocr` stage's decision logic is tested against a fake `OcrProvider` instead.
 */
export async function createTesseractOcrProvider(): Promise<OcrProvider> {
  const worker = await createWorker(['eng', 'ben']);
  return {
    async recognize(imagePath) {
      const {
        data: { text },
      } = await worker.recognize(imagePath);
      return text;
    },
    dispose: async () => {
      await worker.terminate();
    },
  };
}
