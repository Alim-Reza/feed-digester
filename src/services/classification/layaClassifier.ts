import { Laya } from '@receptron/laya';
import type { Question, NoulAnswer, ScoreAnswer } from '@receptron/laya';
import type { CategoryConfig } from '../../config/schema';
import { pickPrimaryCategory } from './shared';
import type { Classifier, ClassificationInput, ClassificationResult } from './types';

const RELEVANCE_LEVELS = ['not relevant', 'somewhat relevant', 'relevant', 'highly relevant'];

function buildState(input: ClassificationInput): unknown {
  return {
    author: input.authorName,
    headline: input.authorHeadline ?? undefined,
    content: input.content,
    imageText: input.ocrText ?? undefined,
  };
}

function buildQuestions(categories: readonly CategoryConfig[]): Record<string, Question> {
  const questions: Record<string, Question> = {};
  for (const cat of categories) {
    questions[cat.id] = {
      type: 'noul',
      instructions: `Is this LinkedIn post relevant to the category "${cat.label}"? ${cat.description}`,
    };
  }
  questions.relevance = {
    type: 'score',
    instructions: 'Overall, how relevant and worth reading is this post?',
    criteria: RELEVANCE_LEVELS,
  };
  return questions;
}

/**
 * Real, ONNX-backed `Classifier` (`@receptron/laya`). Not unit tested directly — like the
 * tesseract/Ollama providers, it needs real trained weights (~1.7GB per checkpoint) downloaded
 * and real inference; the threshold/status logic that wraps it is tested at the `classify` stage
 * level against a fake `Classifier` instead.
 *
 * Multi-label output comes from one `noul` (calibrated P(true)) question per configured category
 * rather than a single `choice`, since spec's own example scores multiple categories on the same
 * post — `choice` would force mutual exclusivity.
 *
 * Loads the English checkpoint by default and the multilingual one only the first time a
 * non-English post shows up (grill: "English + multilingual checkpoints") — most runs never
 * touch the multilingual download at all.
 */
export function createLayaClassifier(opts: { categories: readonly CategoryConfig[] }): Classifier {
  const { categories } = opts;
  const questions = buildQuestions(categories);
  const instances: { en: Promise<Laya> | null; multi: Promise<Laya> | null } = {
    en: null,
    multi: null,
  };

  function getInstance(language: string | null): Promise<Laya> {
    if (language && language !== 'en') {
      instances.multi ??= Laya.load({ subfolder: 'multilingual' });
      return instances.multi;
    }
    instances.en ??= Laya.load();
    return instances.en;
  }

  return {
    name: 'laya',
    model: 'laya-modernbert',

    async classifyBatch(inputs) {
      const results: ClassificationResult[] = [];
      for (const input of inputs) {
        const laya = await getInstance(input.language);
        const result = await laya.systemOne(buildState(input), questions);
        const categoryScores: Record<string, number> = {};
        for (const cat of categories) {
          categoryScores[cat.id] = (result.answers[cat.id] as NoulAnswer).noul;
        }
        const relevanceAnswer = result.answers.relevance as ScoreAnswer;
        results.push({
          categories: categoryScores,
          primaryCategory: pickPrimaryCategory(categoryScores, categories),
          relevance: relevanceAnswer.score / (RELEVANCE_LEVELS.length - 1),
        });
      }
      return results;
    },

    async release() {
      for (const key of ['en', 'multi'] as const) {
        const pending = instances[key];
        if (pending) {
          const laya = await pending;
          await laya.close();
          instances[key] = null;
        }
      }
    },
  };
}
