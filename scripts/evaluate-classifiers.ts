/**
 * ADR 0003's bake-off: scores both classifiers against the ground-truth labels collected in
 * `/posts` (grill E5 — label ~150 posts) and prints precision/recall/F1 per category plus a
 * relevance correlation for each. Run manually (`pnpm evaluate:classifiers`) once labels exist
 * — this touches a real Laya model (~1.7GB download) and a real Ollama instance, so it never
 * runs as part of the automated test suite (the same reasoning as `pnpm login`/`pnpm collect:fixtures`).
 */
import { loadConfig } from '../src/config';
import { loadSettingsOverrides } from '../src/config/settingsOverrides';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { createRepositories } from '../src/db/repositories';
import { createLogger } from '../src/logging';
import { createLLMProvider } from '../src/llm';
import { createLayaClassifier } from '../src/services/classification/layaClassifier';
import { createGemmaClassifier } from '../src/services/classification/gemmaClassifier';
import { computeCategoryMetrics, pearsonCorrelation } from '../src/services/classification/evaluate';
import type { Classifier, ClassificationInput } from '../src/services/classification/types';

type Labeled = {
  input: ClassificationInput;
  trueCategories: Set<string>;
  trueRelevance: number;
};

async function evaluateClassifier(
  name: string,
  classifier: Classifier,
  labeled: readonly Labeled[],
  categoryIds: readonly string[],
  threshold: number,
): Promise<void> {
  const results = await classifier.classifyBatch(labeled.map((l) => l.input));
  const examples = labeled.map((l, i) => ({
    trueCategories: l.trueCategories,
    trueRelevance: l.trueRelevance,
    predicted: results[i]!,
  }));
  const metrics = computeCategoryMetrics(examples, categoryIds, threshold);
  const correlation = pearsonCorrelation(
    examples.map((e) => e.predicted.relevance),
    examples.map((e) => e.trueRelevance),
  );

  console.log(`\n=== ${name} ===`);
  console.table(
    metrics.map((m) => ({
      category: m.category,
      precision: m.precision.toFixed(2),
      recall: m.recall.toFixed(2),
      f1: m.f1.toFixed(2),
      support: m.support,
    })),
  );
  console.log(`Relevance correlation (predicted vs. labeled): ${correlation.toFixed(3)}`);
}

async function main(): Promise<void> {
  const baseConfig = loadConfig();
  const db = createDb(baseConfig.dataDir);
  runMigrations(db);
  const repos = createRepositories(db);
  const config = loadConfig(loadSettingsOverrides(repos));
  const logger = createLogger(config, 'evaluate-classifiers');

  const labelRows = repos.feedback.listByKind('label');
  if (labelRows.length === 0) {
    console.log('No labels found yet — label posts in /posts first (grill E5, ADR 0003).');
    return;
  }

  const labeled: Labeled[] = [];
  for (const row of labelRows) {
    const post = repos.posts.get(row.postId);
    if (!post) continue;
    const value = row.value as { categories: string[]; relevance: number };
    labeled.push({
      input: {
        authorName: post.authorName,
        authorHeadline: post.authorHeadline,
        content: post.content,
        ocrText: post.ocrText,
        language: post.language,
      },
      trueCategories: new Set(value.categories),
      trueRelevance: value.relevance,
    });
  }

  console.log(`Evaluating both classifiers against ${labeled.length} labeled posts...`);
  const categoryIds = config.categories.map((c) => c.id);

  const laya = createLayaClassifier({ categories: config.categories });
  try {
    await evaluateClassifier('laya', laya, labeled, categoryIds, config.thresholds.relevance);
  } finally {
    await laya.release();
  }

  const gemma = createGemmaClassifier({
    llm: createLLMProvider(config, logger),
    categories: config.categories,
    relevanceWeights: config.classification.relevanceWeights,
  });
  try {
    await evaluateClassifier('gemma4', gemma, labeled, categoryIds, config.thresholds.relevance);
  } finally {
    await gemma.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
