import type { ParsedCliOptionsV2 } from '../domain/contracts.js';
import { CommandRegistry } from './commands/registry.js';
import type { CommandModule } from './commands/types.js';
import type { RuntimeEnvironment } from './runtime.js';
import { doctorCommandModule } from './commands/doctor.js';
import { initCommandModule } from './commands/init.js';
import { inspectConfigCommandModule } from './commands/inspect-config.js';
import { inspectPlanCommandModule } from './commands/inspect-plan.js';
import { migrateCommandModule } from './commands/migrate.js';
import { planCommandModule } from './commands/plan.js';
import { pluginsListCommandModule } from './commands/plugins-list.js';
import { providersListCommandModule } from './commands/providers-list.js';
import { updateCommandModule } from './commands/update.js';

function registerAll(registry: CommandRegistry, modules: CommandModule[]): void {
  for (const module of modules) {
    registry.register(module);
  }
}

export function createDefaultCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registerAll(registry, [
    planCommandModule,
    initCommandModule,
    updateCommandModule,
    doctorCommandModule,
    migrateCommandModule,
    providersListCommandModule,
    pluginsListCommandModule,
    inspectPlanCommandModule,
    inspectConfigCommandModule
  ]);
  return registry;
}

export function resolveCommandModuleId(args: ParsedCliOptionsV2): string {
  if (args.command === 'providers') {
    if (args.subcommand !== 'list') {
      throw new Error('providers requires subcommand: list');
    }
    return 'providers.list';
  }
  if (args.command === 'plugins') {
    if (args.subcommand !== 'list') {
      throw new Error('plugins requires subcommand: list');
    }
    return 'plugins.list';
  }
  if (args.command === 'inspect') {
    if (args.subcommand === 'plan') {
      return 'inspect.plan';
    }
    if (args.subcommand === 'config') {
      return 'inspect.config';
    }
    throw new Error('inspect requires subcommand: plan|config');
  }
  return args.command;
}

export function runCommandFromArgs(args: ParsedCliOptionsV2, env: RuntimeEnvironment): unknown {
  const commandId = resolveCommandModuleId(args);
  const module = env.commandRegistry.get(commandId);
  return module.run({ args, env });
}
