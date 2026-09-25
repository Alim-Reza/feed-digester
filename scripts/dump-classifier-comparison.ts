/**
 * Runs both classifiers (Laya and gemma4) over every collected post with content and writes a
 * side-by-side JSON comparison — for feeding to an external judge model instead of ADR 0003's
 * manual-labeling eval script (`evaluate-classifiers.ts`), when you'd rather have an LLM read
 * the disagreements than label ~150 posts by hand. No ground truth needed. Run manually
 * (`pnpm compare:classifiers`) — touches a real Laya model download and a real Ollama instance,
 * same as `evaluate-classifiers.ts`, so it never runs in the automated test suite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config';
import { loadSettingsOverrides } from '../src/config/settingsOverrides';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { createRepositories } from '../src/db/repositories';
import { createLogger } from '../src/logging';
import { createLLMProvider } from '../src/llm';
import { createLayaClassifier } from '../src/services/classification/layaClassifier';
import { createGemmaClassifier } from '../src/services/classification/gemmaClassifier';
import type { ClassificationInput, ClassificationResult } from '../src/services/classification/types';

async function main(): Promise<void> {
  const baseConfig = loadConfig();
  const db = createDb(baseConfig.dataDir);
  runMigrations(db);
  const repos = createRepositories(db);
  const config = loadConfig(loadSettingsOverrides(repos));
  const logger = createLogger(config, 'dump-classifier-comparison');

  const limit = Number(process.env.LIMIT ?? 500);
  const posts = repos.posts.list({ limit }).filter((p) => p.content.trim().length > 0);

  if (posts.length === 0) {
    console.log('No posts with content found — run a collection first.');
    return;
  }

  console.log(`Classifying ${posts.length} posts with laya, then gemma4 (one model loaded at a time)...`);

  const inputs: ClassificationInput[] = posts.map((p) => ({
    authorName: p.authorName,
    authorHeadline: p.authorHeadline,
    content: p.content,
    ocrText: p.ocrText,
    language: p.language,
  }));

  const laya = createLayaClassifier({ categories: config.categories });
  let layaResults: ClassificationResult[];
  try {
    console.log('Running laya (first run downloads the ~1.7GB checkpoint)...');
    layaResults = await laya.classifyBatch(inputs);
    console.log('laya done.');
  } finally {
    await laya.release();
  }

  const gemma = createGemmaClassifier({
    llm: createLLMProvider(config, logger),
    categories: config.categories,
    relevanceWeights: config.classification.relevanceWeights,
  });
  let gemmaResults: ClassificationResult[];
  try {
    console.log('Running gemma4 via Ollama...');
    gemmaResults = await gemma.classifyBatch(inputs);
    console.log('gemma4 done.');
  } finally {
    await gemma.release();
  }

  const output = posts.map((post, i) => ({
    postId: post.id,
    authorName: post.authorName,
    authorHeadline: post.authorHeadline,
    content: post.content,
    ocrText: post.ocrText,
    url: post.url,
    processingStatus: post.processingStatus,
    dropReason: post.dropReason,
    laya: layaResults[i],
    gemma4: gemmaResults[i],
  }));

  const outPath = path.join(config.dataDir, 'classifier-comparison.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${output.length} entries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
