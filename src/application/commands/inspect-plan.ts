import type { CommandModule } from './types.js';
import { createPlanV2 } from '../planner.js';

export const inspectPlanCommandModule: CommandModule = {
  id: 'inspect.plan',
  description: 'Inspect pipeline output for plan stage.',
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
      command: plan.command,
      pipelineFingerprint: plan.lockContent.pipelineFingerprint,
      summary: plan.summary,
      pluginResolutions: plan.lockContent.pluginResolutions,
      operationPreview: plan.operations.map(operation => ({ action: operation.action, path: operation.path }))
    };
  }
};
