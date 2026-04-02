import type { CommandModule } from './types.js';

export const pluginsListCommandModule: CommandModule = {
  id: 'plugins.list',
  description: 'List internal plugin registrations.',
  run({ env }) {
    return {
      providers: env.providerRegistry.list(),
      renderers: env.rendererRegistry.list(),
      policies: env.policyRegistry.list(),
      doctorChecks: env.doctorRegistry.list()
    };
  }
};
