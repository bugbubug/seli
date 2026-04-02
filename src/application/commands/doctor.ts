import type { CommandModule } from './types.js';
import { runDoctorV2 } from '../doctor.js';

export const doctorCommandModule: CommandModule = {
  id: 'doctor',
  description: 'Validate managed state for v2 project.',
  run({ args, env }) {
    if (!args.projectRoot) {
      throw new Error('Missing required --project argument.');
    }

    return runDoctorV2(
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
