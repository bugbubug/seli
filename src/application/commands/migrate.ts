import type { CommandModule } from './types.js';
import { migrateProjectToV2 } from '../migrate.js';

export const migrateCommandModule: CommandModule = {
  id: 'migrate',
  description: 'Validate migration state (legacy contracts are unsupported).',
  run({ args, env }) {
    if (!args.projectRoot) {
      throw new Error('Missing required --project argument.');
    }

    return migrateProjectToV2(
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
