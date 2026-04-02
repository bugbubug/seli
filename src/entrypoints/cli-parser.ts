import path from 'node:path';

import type { ParsedCliOptionsV2 } from '../domain/contracts.js';

const TOP_LEVEL_COMMANDS = new Set(['plan', 'init', 'update', 'doctor', 'migrate', 'providers', 'plugins', 'inspect', 'help']);

export function usage(): string {
  return `
Usage:
  seli plan --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--json|--explain]
  seli init --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--force] [--json|--explain]
  seli update --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--force] [--json|--explain]
  seli doctor --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--json|--explain]
  seli migrate --project <abs-path> [--intake intake/manifest.json] [--json|--explain]
  seli providers list [--json|--explain]
  seli plugins list [--json|--explain]
  seli inspect plan --project <abs-path> [--intake intake/manifest.json] [--json|--explain]
  seli inspect config --project <abs-path> [--intake intake/manifest.json] [--json|--explain]
`;
}

export function parseProviderRootArgument(value: string): [string, string] {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`Invalid --provider-root value: ${value}. Expected <provider>=<abs-path>.`);
  }

  const providerId = value.slice(0, separatorIndex);
  const providerRoot = value.slice(separatorIndex + 1);
  return [providerId, path.resolve(providerRoot)];
}

export function parseCliArgs(argv: string[]): ParsedCliOptionsV2 {
  const args = argv.slice(2);

  const first = args[0] || 'help';
  const command = TOP_LEVEL_COMMANDS.has(first) ? first : 'help';

  const parsed: ParsedCliOptionsV2 = {
    command: command as ParsedCliOptionsV2['command'],
    subcommand: undefined,
    force: false,
    intakePath: null,
    outputMode: 'explain',
    providerRoots: {},
    profileId: 'default',
    projectRoot: null
  };

  if (command === 'providers' || command === 'plugins' || command === 'inspect') {
    parsed.subcommand = args[1];
  }

  const startIndex = command === 'providers' || command === 'plugins' || command === 'inspect' ? 2 : 1;
  for (let index = startIndex; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--project') {
      const value = args[index + 1];
      parsed.projectRoot = value ? path.resolve(value) : null;
      index += 1;
      continue;
    }
    if (arg === '--profile') {
      parsed.profileId = args[index + 1] || 'default';
      index += 1;
      continue;
    }
    if (arg === '--intake') {
      const value = args[index + 1];
      parsed.intakePath = value ? path.resolve(value) : null;
      index += 1;
      continue;
    }
    if (arg === '--provider-root') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Missing value for --provider-root.');
      }
      const [providerId, providerRoot] = parseProviderRootArgument(value);
      parsed.providerRoots[providerId] = providerRoot;
      index += 1;
      continue;
    }
    if (arg === '--json') {
      parsed.outputMode = 'json';
      continue;
    }
    if (arg === '--explain') {
      parsed.outputMode = 'explain';
      continue;
    }
    if (arg === '--force') {
      parsed.force = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.command = 'help';
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}
