import type { CommandModule } from './types.js';

export const providersListCommandModule: CommandModule = {
  id: 'providers.list',
  description: 'List registered provider plugins.',
  run({ env }) {
    return {
      providers: env.providerRegistry.list()
    };
  }
};
