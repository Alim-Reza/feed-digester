import path from 'node:path';
import fs from 'node:fs';
import pino from 'pino';
import type { DigestConfig } from '../config/schema';

export type Logger = pino.Logger;

/**
 * Creates the process-wide logger: pretty stdout in dev, a rotating file under
 * `<dataDir>/logs`, and JSON-structured entries either way so the file stream stays parseable.
 * `run_events` persistence (for the UI) is layered on top by the pipeline runner (slice 2+),
 * which subscribes to this logger's output rather than replacing it.
 */
export function createLogger(
  config: Pick<DigestConfig, 'dataDir'>,
  name = 'feed-digester',
): Logger {
  const logsDir = path.join(config.dataDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const isDev = process.env.NODE_ENV !== 'production';

  const targets: pino.TransportTargetOptions[] = [
    {
      target: 'pino-roll',
      level: 'trace',
      options: {
        file: path.join(logsDir, name),
        extension: '.log',
        frequency: 'daily',
        size: '10m',
        mkdir: true,
      },
    },
  ];

  targets.push(
    isDev
      ? { target: 'pino-pretty', level: 'trace', options: { colorize: true } }
      : { target: 'pino/file', level: 'trace', options: { destination: 1 } },
  );

  return pino({ name, level: process.env.LOG_LEVEL ?? 'info' }, pino.transport({ targets }));
}
