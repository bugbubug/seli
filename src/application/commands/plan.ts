import type { CommandModule } from './types.js';
import { createPlanV2 } from '../planner.js';

export const planCommandModule: CommandModule = {
  id: 'plan',
  description: 'Create v2 install/update plan.',
  run({ args, env }) {
    if (!args.projectRoot) {
      throw new Error('Missing required --project argument.');
    }

    return createPlanV2(
      'plan',
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
  }
};
