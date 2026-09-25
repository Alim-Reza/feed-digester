import type { DbClient } from '../client';
import { createPostsRepository } from './posts';
import { createPostImagesRepository } from './postImages';
import { createPostAnalysisRepository } from './postAnalysis';
import { createJobOpeningsRepository } from './jobOpenings';
import { createDigestsRepository } from './digests';
import { createTopicClustersRepository } from './topicClusters';
import { createTopicClusterPostsRepository } from './topicClusterPosts';
import { createDigestSectionsRepository } from './digestSections';
import { createFeedbackRepository } from './feedback';
import { createRunsRepository } from './runs';
import { createRunEventsRepository } from './runEvents';
import { createRunCommandsRepository } from './runCommands';
import { createSettingsRepository } from './settings';

export function createRepositories(db: DbClient) {
  return {
    posts: createPostsRepository(db),
    postImages: createPostImagesRepository(db),
    postAnalysis: createPostAnalysisRepository(db),
    jobOpenings: createJobOpeningsRepository(db),
    digests: createDigestsRepository(db),
    topicClusters: createTopicClustersRepository(db),
    topicClusterPosts: createTopicClusterPostsRepository(db),
    digestSections: createDigestSectionsRepository(db),
    feedback: createFeedbackRepository(db),
    runs: createRunsRepository(db),
    runEvents: createRunEventsRepository(db),
    runCommands: createRunCommandsRepository(db),
    settings: createSettingsRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from './posts';
export * from './postImages';
export * from './postAnalysis';
export * from './jobOpenings';
export * from './digests';
export * from './topicClusters';
export * from './topicClusterPosts';
export * from './digestSections';
export * from './feedback';
export * from './runs';
export * from './runEvents';
export * from './runCommands';
export * from './settings';
