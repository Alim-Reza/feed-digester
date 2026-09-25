import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { runPipeline } from '../runner';
import { stagesForCommand } from '../stageSets';
import { runClassifyStage } from './classify';
import { runClusterStage } from './cluster';
import { runSummarizeStage } from './summarize';
import type { Classifier } from '../../services/classification/types';
import type { Embedder } from '../../llm/types';
import type { Summarizer } from '../../services/summarization/summarizer';
import type { Stage } from '../types';

const logger = pino({ level: 'silent' });

// The real `classify` stage loads a real Laya model (a ~1.7GB download) or calls a real Ollama
// instance — neither belongs in the automated test suite (grill J9, same reasoning as collect/
// ocr's real providers). Swap in a fake `Classifier` so this test still exercises every other
// stage's real transition logic end to end.
const fakeClassifier: Classifier = {
  name: 'fake',
  model: 'fake-model',
  async classifyBatch(inputs) {
    return inputs.map(() => ({
      categories: { software_engineering: 0.9 },
      primaryCategory: 'software_engineering',
      relevance: 0.9,
    }));
  },
  async release() {},
};
const fakeClassifyStage: Stage = {
  name: 'classify',
  run: (ctx) => runClassifyStage(ctx, () => fakeClassifier),
};

// `cluster` and `summarize` real stages call a real Ollama embedder / LLM provider by default —
// substitute fakes for the same reason as `classify` above.
const fakeEmbedder: Embedder = {
  name: 'fake-embedder',
  async embed(texts) {
    return texts.map(() => [1, 0, 0]);
  },
  async release() {},
};
const fakeClusterStage: Stage = {
  name: 'cluster',
  run: (ctx) => runClusterStage(ctx, () => fakeEmbedder),
};

const fakeSummarizer: Summarizer = {
  async summarizeCluster() {
    return { title: 'Fake topic', bullets: [{ text: 'A fake bullet [1].', sources: [1] }] };
  },
  async summarizeSection() {
    return 'A fake section TL;DR.';
  },
  async release() {},
};
const fakeSummarizeStage: Stage = {
  name: 'summarize',
  run: (ctx) => runSummarizeStage(ctx, () => fakeSummarizer),
};

function seedNewPost(repos: Repositories, runId: string) {
  return repos.posts.insertOrTouch({
    hash: 'h1',
    authorName: 'Author',
    firstSeenRunId: runId,
    collectedAt: new Date(),
  }).post;
}

// Excludes `collect` — since slice 4 it drives a real browser, which unit tests never do
// (grill J9: collector tests use saved fixtures, plus one manual live smoke test). These tests
// seed an already-collected 'new' post directly, so `stagesForCommand('process')` — every
// stub stage after collection — is exactly what "the rest of the pipeline" means here; it's
// the same stage set a real "process" run_command uses to finish posts collection left behind.
const fakeStagesByName: Record<string, Stage> = {
  classify: fakeClassifyStage,
  cluster: fakeClusterStage,
  summarize: fakeSummarizeStage,
};
const processStages = stagesForCommand('process').map((s) => fakeStagesByName[s.name] ?? s);

describe('stub stages', () => {
  it('carries a post through the whole state machine to digested', async () => {
    const db = createTestDb();
    const repos = createRepositories(db);
    const config = loadConfig();
    const run = repos.runs.create('manual');
    const post = seedNewPost(repos, run.id);

    const outcome = await runPipeline({ db, repos, config, logger }, run.id, processStages);

    expect(outcome).toBe('succeeded');
    expect(repos.posts.get(post.id)!.processingStatus).toBe('digested');
  });

  it('a second run over the same posts is a no-op (idempotent)', async () => {
    const db = createTestDb();
    const repos = createRepositories(db);
    const config = loadConfig();
    const run1 = repos.runs.create('manual');
    seedNewPost(repos, run1.id);
    await runPipeline({ db, repos, config, logger }, run1.id, processStages);

    const run2 = repos.runs.create('manual');
    const outcome = await runPipeline({ db, repos, config, logger }, run2.id, processStages);

    expect(outcome).toBe('succeeded');
    expect(repos.posts.countByStatus('digested')).toBe(1);
    expect(repos.posts.countByStatus('new')).toBe(0);
  });
});
