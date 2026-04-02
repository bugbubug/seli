#!/usr/bin/env bun

import path from 'node:path';

import { parseProviderRootArgument } from './intake.js';
import { explainDoctor, explainPlan, initProject, planProject, runDoctor, updateProject } from './index.js';
import type { CliOptions } from './types.js';

function usage(): string {
  return `
Usage:
  ai-tool-init plan --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--json]
  ai-tool-init init --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--force] [--json]
  ai-tool-init update --project <abs-path> [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--force] [--json]
  ai-tool-init doctor --project <abs-path> [--profile default] [--intake intake/manifest.json] [--provider-root ecc=/abs/path] [--json]
`;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const initialCommand = args[0];
  const parsed: CliOptions = {
    command:
      initialCommand === 'plan' ||
      initialCommand === 'init' ||
      initialCommand === 'update' ||
      initialCommand === 'doctor' ||
      initialCommand === 'help'
        ? initialCommand
        : initialCommand
          ? null
          : null,
    force: false,
    intakePath: null,
    json: false,
    providerRoots: {},
    profileId: 'default',
    projectRoot: null
  };

  for (let index = 1; index < args.length; index += 1) {
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
      parsed.json = true;
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

function main(): void {
  try {
    const options = parseArgs(process.argv);

    if (!options.command || options.command === 'help') {
      process.stdout.write(usage());
      process.exit(0);
    }

    if (!options.projectRoot) {
      throw new Error('Missing required --project argument.');
    }
    const commandOptions = {
      force: options.force,
      intakePath: options.intakePath ?? undefined,
      json: options.json,
      providerRoots: options.providerRoots,
      profileId: options.profileId,
      projectRoot: options.projectRoot
    };

    if (options.command === 'plan') {
      const plan = planProject(commandOptions);
      process.stdout.write(options.json ? `${JSON.stringify(plan, null, 2)}\n` : `${explainPlan(plan)}\n`);
      return;
    }

    if (options.command === 'init') {
      const result = initProject(commandOptions);
      process.stdout.write(
        options.json ? `${JSON.stringify(result, null, 2)}\n` : `${explainPlan(result.plan)}\n`
      );
      return;
    }

    if (options.command === 'update') {
      const result = updateProject(commandOptions);
      process.stdout.write(
        options.json ? `${JSON.stringify(result, null, 2)}\n` : `${explainPlan(result.plan)}\n`
      );
      return;
    }

    const doctor = runDoctor(commandOptions);
    process.stdout.write(options.json ? `${JSON.stringify(doctor, null, 2)}\n` : `${explainDoctor(doctor)}\n`);
    process.exit(doctor.ok ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n${usage()}`);
    process.exit(1);
  }
}

main();
