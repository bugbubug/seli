import type { CommandModule } from './types.js';
import { createPlanV2 } from '../planner.js';
import { executeStage } from '../pipeline/stages.js';

export const initCommandModule: CommandModule = {
  id: 'init',
  description: 'Run v2 init flow.',
  run({ args, env }) {
    if (!args.projectRoot) {
      throw new Error('Missing required --project argument.');
    }

    const plan = createPlanV2(
      'init',
      {
        projectRoot: args.projectRoot,
        profileId: args.profileId,
        intakePath: args.intakePath || undefined,
        providerRoots: args.providerRoots,
        force: args.force,
        outputMode: args.outputMode
      },
      env
    );

    const result = executeStage(plan, env, Boolean(args.force));
    return { plan, result };
  }
};
