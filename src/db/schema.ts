import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ── posts ────────────────────────────────────────────────────────────────

export const postProcessingStatuses = [
  'new',
  'ocr_done',
  'filtered',
  'dropped',
  'classified',
  'enriched',
  'clustered',
  'digested',
  'failed',
] as const;
export type PostProcessingStatus = (typeof postProcessingStatuses)[number];

export const postContentTypes = ['text', 'image', 'video', 'poll', 'article', 'document'] as const;
export type PostContentType = (typeof postContentTypes)[number];

export const publishedAtPrecisions = ['exact', 'estimated'] as const;
export type PublishedAtPrecision = (typeof publishedAtPrecisions)[number];

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    externalId: text('external_id'),
    hash: text('hash').notNull(),
    url: text('url'),
    authorName: text('author_name').notNull(),
    authorHeadline: text('author_headline'),
    viaName: text('via_name'),
    content: text('content').notNull().default(''),
    ocrText: text('ocr_text'),
    contentType: text('content_type', { enum: postContentTypes }).notNull().default('text'),
    language: text('language'),
    isSponsored: integer('is_sponsored', { mode: 'boolean' }).notNull().default(false),
    isConnectionSuggestion: integer('is_connection_suggestion', { mode: 'boolean' })
      .notNull()
      .default(false),
    isPoll: integer('is_poll', { mode: 'boolean' }).notNull().default(false),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    publishedAtPrecision: text('published_at_precision', { enum: publishedAtPrecisions }),
    firstSeenRunId: text('first_seen_run_id').notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    collectedAt: integer('collected_at', { mode: 'timestamp_ms' }).notNull(),
    processingStatus: text('processing_status', { enum: postProcessingStatuses })
      .notNull()
      .default('new'),
    dropReason: text('drop_reason'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    contentPurgedAt: integer('content_purged_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    uniqueIndex('posts_external_id_unique').on(t.externalId),
    uniqueIndex('posts_hash_unique').on(t.hash),
    index('posts_processing_status_idx').on(t.processingStatus),
  ],
);

// ── post_images ──────────────────────────────────────────────────────────

export const postImages = sqliteTable(
  'post_images',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    ocrText: text('ocr_text'),
    kept: integer('kept', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('post_images_post_id_idx').on(t.postId)],
);

// ── post_analysis ────────────────────────────────────────────────────────

export const postAnalysis = sqliteTable('post_analysis', {
  postId: text('post_id')
    .primaryKey()
    .references(() => posts.id, { onDelete: 'cascade' }),
  categories: text('categories', { mode: 'json' }).notNull().$type<Record<string, number>>(),
  primaryCategory: text('primary_category').notNull(),
  relevance: real('relevance').notNull(),
  classifier: text('classifier').notNull(),
  model: text('model').notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp_ms' }).notNull(),
});

// ── job_openings ─────────────────────────────────────────────────────────

export const jobOpenings = sqliteTable(
  'job_openings',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    company: text('company'),
    role: text('role').notNull(),
    location: text('location'),
    remoteStatus: text('remote_status'),
    seniority: text('seniority'),
    experience: text('experience'),
    skills: text('skills', { mode: 'json' }).notNull().$type<string[]>(),
    model: text('model').notNull(),
  },
  (t) => [index('job_openings_post_id_idx').on(t.postId)],
);

// ── digests / digest_sections ───────────────────────────────────────────

export const digests = sqliteTable('digests', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  windowStart: integer('window_start', { mode: 'timestamp_ms' }).notNull(),
  windowEnd: integer('window_end', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  stats: text('stats', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
});

export const digestSections = sqliteTable(
  'digest_sections',
  {
    id: text('id').primaryKey(),
    digestId: text('digest_id')
      .notNull()
      .references(() => digests.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    tldr: text('tldr').notNull(),
    postCount: integer('post_count').notNull().default(0),
    order: integer('order').notNull().default(0),
  },
  (t) => [index('digest_sections_digest_id_idx').on(t.digestId)],
);

// ── topic_clusters / topic_cluster_posts ────────────────────────────────

export const insightLevels = ['low', 'medium', 'high'] as const;
export type InsightLevel = (typeof insightLevels)[number];

export const topicClusters = sqliteTable(
  'topic_clusters',
  {
    id: text('id').primaryKey(),
    digestId: text('digest_id')
      .notNull()
      .references(() => digests.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    /** The insight's title (a concrete claim, not a category name). Empty = not an insight (spec-second.md). */
    title: text('title').notNull(),
    /** The synthesized claim/idea itself — a paragraph, not per-bullet inline citations (sources come from topic_cluster_posts). */
    summary: text('summary').notNull().default(''),
    whyItMatters: text('why_it_matters'),
    suggestedAction: text('suggested_action'),
    noveltyLevel: text('novelty_level', { enum: insightLevels }),
    confidence: text('confidence', { enum: insightLevels }),
    /** Cluster cohesion (0..1), unrelated to `rank` below. */
    score: real('score').notNull(),
    /** Final 1..N position in the ranked briefing; null = not an insight, or an insight cut for length. */
    rank: integer('rank'),
  },
  (t) => [index('topic_clusters_digest_id_idx').on(t.digestId)],
);

export const topicClusterPosts = sqliteTable(
  'topic_cluster_posts',
  {
    clusterId: text('cluster_id')
      .notNull()
      .references(() => topicClusters.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull().default(0),
  },
  (t) => [uniqueIndex('topic_cluster_posts_pk').on(t.clusterId, t.postId)],
);

// ── runs / run_events / run_commands ────────────────────────────────────

export const runTriggers = ['manual', 'scheduled'] as const;
export type RunTrigger = (typeof runTriggers)[number];

export const runStatuses = [
  'queued',
  'running',
  'awaiting_user',
  'interrupted',
  'succeeded',
  'failed',
] as const;
export type RunStatus = (typeof runStatuses)[number];

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  trigger: text('trigger', { enum: runTriggers }).notNull(),
  status: text('status', { enum: runStatuses }).notNull().default('queued'),
  currentStage: text('current_stage'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  stats: text('stats', { mode: 'json' })
    .notNull()
    .default(sql`'{}'`)
    .$type<Record<string, unknown>>(),
});

export const runEventLevels = ['debug', 'info', 'warn', 'error'] as const;
export type RunEventLevel = (typeof runEventLevels)[number];

export const runEvents = sqliteTable(
  'run_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    level: text('level', { enum: runEventLevels }).notNull(),
    stage: text('stage'),
    message: text('message').notNull(),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
    ts: integer('ts', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('run_events_run_id_idx').on(t.runId)],
);

export const runCommandTypes = ['full', 'collect', 'process', 'login'] as const;
export type RunCommandType = (typeof runCommandTypes)[number];

export const runCommandStatuses = ['pending', 'claimed', 'done', 'failed'] as const;
export type RunCommandStatus = (typeof runCommandStatuses)[number];

export const runCommands = sqliteTable('run_commands', {
  id: text('id').primaryKey(),
  type: text('type', { enum: runCommandTypes }).notNull(),
  status: text('status', { enum: runCommandStatuses }).notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// ── feedback ─────────────────────────────────────────────────────────────

export const feedbackKinds = ['up', 'down', 'wrong_category', 'label'] as const;
export type FeedbackKind = (typeof feedbackKinds)[number];

export const feedback = sqliteTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: feedbackKinds }).notNull(),
    value: text('value', { mode: 'json' }).$type<unknown>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('feedback_post_id_idx').on(t.postId)],
);

// ── settings ─────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull().$type<unknown>(),
});
