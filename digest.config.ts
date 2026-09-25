import type { DigestConfig } from './src/config/schema';

/**
 * Typed defaults for the pipeline. Overridden at load time by `settings` table rows
 * (once slice 1 lands) and by environment variables — see src/config/index.ts.
 */
const digestConfig: DigestConfig = {
  categories: [
    {
      id: 'software_engineering',
      label: 'Software Engineering',
      description: 'Programming, system design, tools, languages, frameworks, and practices.',
    },
    {
      id: 'ai_ml',
      label: 'AI / ML / Agents',
      description: 'Machine learning, LLMs, agents, and applied AI research or products.',
    },
    {
      id: 'career',
      label: 'Career Advice',
      description: 'Advice on growth, interviewing, negotiation, or navigating a tech career.',
    },
    {
      id: 'engineering_leadership',
      label: 'Engineering Leadership',
      description: 'Management, mentoring, team building, and technical leadership.',
    },
    {
      id: 'industry_news',
      label: 'Industry & Tech News',
      description: 'Company news, funding, product launches, and broader tech industry events.',
    },
    {
      id: 'job',
      label: 'Job Openings',
      description: 'A specific open role being advertised, with hiring details.',
    },
  ],

  thresholds: {
    relevance: 0.4,
    job: 0.5,
    clusterScore: 0.3,
  },

  filtering: {
    celebrationPhrases: [
      "i'm happy to share",
      "i'm thrilled to announce",
      'excited to announce',
      'humbled and honored',
      'proud to share',
      'grateful to announce',
    ],
    allowlist: [],
    blocklist: [],
    allowedLanguages: ['en', 'bn'],
    minVideoTextLength: 200,
  },

  pacing: {
    scrollStepPxMin: 300,
    scrollStepPxMax: 900,
    pauseMsMin: 1500,
    pauseMsMax: 6000,
    readingPauseChance: 0.15,
    readingPauseMsMin: 8000,
    readingPauseMsMax: 20000,
  },

  stopConditions: {
    maxDurationMinutes: 15,
    maxPosts: 300,
    maxConsecutiveSeenPosts: 15,
    maxRunsPerDay: 3,
    checkpointWaitMinutes: 15,
    checkpointPollSeconds: 5,
  },

  schedule: {
    enabled: true,
    dailyAt: '08:00',
    timezone: 'local',
  },

  models: {
    ollamaHost: 'http://127.0.0.1:11434',
    llm: 'gemma4:latest',
    embedding: 'embeddinggemma',
    llmKeepAliveSeconds: 0,
  },

  groq: {
    enabled: false,
    model: 'llama-3.3-70b-versatile',
  },

  // ADR 0003: gemma4 won the bake-off on category accuracy; relevanceWeights compensates for
  // its own poorly-calibrated relevance number by deriving relevance from its category scores
  // instead (see docs/adr/0003-classifier-bake-off.md). Weights are relative, not required to
  // sum to 1 — software_engineering/ai_ml lead since those are this reader's main interests,
  // with career/leadership/industry_news/job weighted down but not zeroed.
  classification: {
    active: 'gemma4',
    relevanceWeights: {
      software_engineering: 0.3,
      ai_ml: 0.3,
      career: 0.15,
      engineering_leadership: 0.1,
      industry_news: 0.1,
      job: 0.05,
    },
  },

  jobs: {
    skillAliases: {
      js: 'JavaScript',
      ts: 'TypeScript',
      k8s: 'Kubernetes',
      k8: 'Kubernetes',
      ml: 'Machine Learning',
      ai: 'AI',
      llm: 'LLM',
      llms: 'LLM',
      py: 'Python',
      golang: 'Go',
      postgres: 'PostgreSQL',
      psql: 'PostgreSQL',
      aws: 'AWS',
      gcp: 'GCP',
      nextjs: 'Next.js',
      'next.js': 'Next.js',
      reactjs: 'React',
      'react.js': 'React',
      nodejs: 'Node.js',
      'node.js': 'Node.js',
    },
  },

  retention: {
    keepCompletedRuns: 14,
  },

  profiles: {
    active: 'main',
    names: ['main', 'collector'],
  },

  relevanceProfile: undefined,

  dataDir: 'data',
};

export default digestConfig;
