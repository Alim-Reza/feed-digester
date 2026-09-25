import type { DigestConfig } from '../../config/schema';
import type { Logger } from '../../logging';
import { createLLMProvider } from '../../llm';
import { createLayaClassifier } from './layaClassifier';
import { createGemmaClassifier } from './gemmaClassifier';
import type { Classifier } from './types';

/** Wires up the active `Classifier` per `config.classification.active` (ADR 0003). */
export function createClassifier(config: DigestConfig, logger: Logger): Classifier {
  if (config.classification.active === 'gemma4') {
    return createGemmaClassifier({
      llm: createLLMProvider(config, logger),
      categories: config.categories,
      relevanceWeights: config.classification.relevanceWeights,
    });
  }
  return createLayaClassifier({ categories: config.categories });
}

export type { Classifier, ClassificationInput, ClassificationResult } from './types';
