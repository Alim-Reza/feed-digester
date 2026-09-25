import type { RunCommandType } from '../db/schema';
import { allStages, collect } from './stages';
import type { Stage } from './types';

/** Maps a `run_commands` type to the stage subset it should run. `login` isn't a pipeline run at all. */
export function stagesForCommand(type: Exclude<RunCommandType, 'login'>): Stage[] {
  switch (type) {
    case 'full':
      return allStages;
    case 'collect':
      return [collect];
    case 'process':
      return allStages.filter((s) => s !== collect);
  }
}
