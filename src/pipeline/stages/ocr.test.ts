import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { runOcrStage } from './ocr';
import type { OcrProvider } from '../../services/ocr/provider';
import type { StageContext } from '../types';

const logger = pino({ level: 'silent' });

let tmpDir: string;
let repos: Repositories;
let ctx: StageContext;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-ocr-'));
  const db = createTestDb();
  repos = createRepositories(db);
  const config = loadConfig();
  const run = repos.runs.create('manual');
  ctx = { db, repos, config, logger, run };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function seedPost(hash: string) {
  return repos.posts.insertOrTouch({
    hash,
    authorName: 'Author',
    firstSeenRunId: 'r1',
    collectedAt: new Date(),
  }).post;
}

function fakeProvider(recognize: OcrProvider['recognize']): {
  provider: OcrProvider;
  dispose: ReturnType<typeof vi.fn>;
} {
  const dispose = vi.fn().mockResolvedValue(undefined);
  return { provider: { recognize, dispose }, dispose };
}

describe('runOcrStage', () => {
  it('advances a post with no images straight to ocr_done, without creating a provider', async () => {
    const post = seedPost('h1');
    const createProvider = vi.fn();

    await runOcrStage(ctx, createProvider);

    expect(createProvider).not.toHaveBeenCalled();
    expect(repos.posts.get(post.id)!.processingStatus).toBe('ocr_done');
    expect(repos.posts.get(post.id)!.ocrText).toBeNull();
  });

  it('keeps an image and stores its text when OCR output looks real', async () => {
    const post = seedPost('h2');
    const imagePath = path.join(tmpDir, 'a.png');
    fs.writeFileSync(imagePath, 'fake png bytes');
    const image = repos.postImages.add(post.id, imagePath);

    const realText = 'We are hiring senior backend engineers in Berlin and remote this quarter.';
    const { provider, dispose } = fakeProvider(async () => realText);

    await runOcrStage(ctx, async () => provider);

    expect(repos.posts.get(post.id)!.processingStatus).toBe('ocr_done');
    expect(repos.posts.get(post.id)!.ocrText).toBe(realText);
    const updatedImage = repos.postImages.listForPost(post.id).find((i) => i.id === image.id)!;
    expect(updatedImage.kept).toBe(true);
    expect(updatedImage.ocrText).toBe(realText);
    expect(fs.existsSync(imagePath)).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('discards an image and deletes its file when OCR output looks like noise', async () => {
    const post = seedPost('h3');
    const imagePath = path.join(tmpDir, 'b.png');
    fs.writeFileSync(imagePath, 'fake png bytes');
    repos.postImages.add(post.id, imagePath);

    const { provider } = fakeProvider(async () => '||l l|| ###');

    await runOcrStage(ctx, async () => provider);

    expect(repos.posts.get(post.id)!.processingStatus).toBe('ocr_done');
    expect(repos.posts.get(post.id)!.ocrText).toBeNull();
    const updatedImage = repos.postImages.listForPost(post.id)[0];
    expect(updatedImage.kept).toBe(false);
    expect(fs.existsSync(imagePath)).toBe(false);
  });

  it('treats a recognize() failure as noise instead of crashing the stage', async () => {
    const post = seedPost('h4');
    const imagePath = path.join(tmpDir, 'c.png');
    fs.writeFileSync(imagePath, 'fake png bytes');
    repos.postImages.add(post.id, imagePath);

    const { provider } = fakeProvider(async () => {
      throw new Error('corrupt image');
    });

    await runOcrStage(ctx, async () => provider);

    expect(repos.posts.get(post.id)!.processingStatus).toBe('ocr_done');
    const updatedImage = repos.postImages.listForPost(post.id)[0];
    expect(updatedImage.kept).toBe(false);
  });

  it('creates the provider only once across multiple posts needing OCR', async () => {
    const postA = seedPost('h5');
    const postB = seedPost('h6');
    for (const post of [postA, postB]) {
      const imagePath = path.join(tmpDir, `${post.id}.png`);
      fs.writeFileSync(imagePath, 'fake png bytes');
      repos.postImages.add(post.id, imagePath);
    }
    const { provider } = fakeProvider(async () => 'some real looking words right here today');
    const createProvider = vi.fn().mockResolvedValue(provider);

    await runOcrStage(ctx, createProvider);

    expect(createProvider).toHaveBeenCalledOnce();
  });
});
