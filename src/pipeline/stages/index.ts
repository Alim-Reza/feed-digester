import { collect } from './collect';
import { ocr } from './ocr';
import { filter } from './filter';
import { classify } from './classify';
import { extractJobs } from './extractJobs';
import { cluster } from './cluster';
import { summarize } from './summarize';
import { digest } from './digest';
import { retention } from './retention';
import type { Stage } from '../types';

export const allStages: Stage[] = [
  collect,
  ocr,
  filter,
  classify,
  extractJobs,
  cluster,
  summarize,
  digest,
  retention,
];

export { collect, ocr, filter, classify, extractJobs, cluster, summarize, digest, retention };
