import type { CommandModule } from './types.js';
import { createPlanV2 } from '../planner.js';

export const inspectConfigCommandModule: CommandModule = {
  id: 'inspect.config',
  description: 'Inspect resolved v2 config snapshot.',
  run({ args, env }) {
    if (!args.projectRoot) {
      throw new Error('Missing required --project argument.');
    }

    const plan = createPlanV2(
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

    return {
      config: plan.config,
      resolvedProviders: plan.resolved.providers.map(provider => ({
        id: provider.id,
        resolvedSourceRoot: provider.resolvedSourceRoot,
        packageCount: provider.packages.length,
        selectedSkills: provider.selectedSkills.map(skill => skill.skillId)
      }))
    };
  }
};
