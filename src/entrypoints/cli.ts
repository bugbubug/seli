#!/usr/bin/env bun

import { explainDoctorV2 } from '../application/doctor.js';
import { explainMigration } from '../application/migrate.js';
import { createPlanV2, explainPlanV2 } from '../application/planner.js';
import { createRuntimeEnvironment } from '../application/create-runtime.js';
import { runCommandFromArgs, resolveCommandModuleId } from '../application/command-runtime.js';
import { parseCliArgs, usage } from './cli-parser.js';

function banner(version: string): string {
  return [
    '   _      _',
    `  (o\\----/o)  Seli v${version}`,
    '   \\  --  /   --------------------------',
    '   ( \\__/ )   AI Project Starter Engine',
    '    \\____/    "Ready to seal the deal?"',
    ''
  ].join('\n');
}

function formatExplain(commandId: string, result: unknown): string {
  if (commandId === 'plan') {
    return explainPlanV2(result as ReturnType<typeof createPlanV2>);
  }
  if (commandId === 'init' || commandId === 'update') {
    return explainPlanV2((result as { plan: ReturnType<typeof createPlanV2> }).plan);
  }
  if (commandId === 'doctor') {
    return explainDoctorV2(result as ReturnType<typeof import('../application/doctor.js').runDoctorV2>);
  }
  if (commandId === 'migrate') {
    return explainMigration(result as ReturnType<typeof import('../application/migrate.js').migrateProjectToV2>);
  }

  return JSON.stringify(result, null, 2);
}

function main(): void {
  try {
    const args = parseCliArgs(process.argv);
    const env = createRuntimeEnvironment();
    const isJsonMode = args.outputMode === 'json';
    const isHumanMode = !isJsonMode;

    if (args.command === 'help') {
      if (isHumanMode) {
        process.stdout.write(banner(env.packageVersion));
      }
      process.stdout.write(`${usage()}\n`);
      return;
    }

    if (isHumanMode && (args.command === 'init' || args.command === 'update')) {
      process.stdout.write(banner(env.packageVersion));
      process.stdout.write('[Seli] 🦭 Searching for local skills (Flink, Spark, StarRocks...)...\n');
      process.stdout.write('[Seli] ✨ Sealing the configuration for your agent...\n');
    }

    const commandId = resolveCommandModuleId(args);
    const result = runCommandFromArgs(args, env);

    if (isJsonMode) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(`${formatExplain(commandId, result)}\n`);
    if (commandId === 'init') {
      process.stdout.write(
        '[Seli] ✅ Project initialized. Ask Claude or Codex: "这是什么项目？我需要提供什么才能帮我配置开发环境？"\n'
      );
    }

    if (commandId === 'doctor') {
      const ok = (result as { ok: boolean }).ok;
      process.exit(ok ? 0 : 1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n${usage()}`);
    process.exit(1);
  }
}

main();
