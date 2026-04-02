import fs from 'node:fs';

import type { ProjectCommandOptionsV2 } from '../domain/contracts.js';
import type { RuntimeEnvironment } from './runtime.js';
import { hasUnsupportedLegacyState } from '../domain/project-state.js';
import { readJsonFile } from '../infrastructure/json.js';

export interface MigrationResult {
  projectRoot: string;
  migratedConfig: boolean;
  migratedLock: boolean;
  migratedIntake: boolean;
}

export function migrateProjectToV2(options: ProjectCommandOptionsV2, env: RuntimeEnvironment): MigrationResult {
  void env;
  const projectRoot = options.projectRoot;

  if (hasUnsupportedLegacyState(projectRoot)) {
    throw new Error(
      `Legacy state is no longer supported under ${projectRoot}. Remove .ai-tool-init/, .aitoolinit.json, and .seli, then run seli init.`
    );
  }

  if (options.intakePath && fs.existsSync(options.intakePath)) {
    const raw = readJsonFile<Record<string, unknown>>(options.intakePath);
    if (raw.version === 1) {
      throw new Error(`Legacy intake manifest is no longer supported: ${options.intakePath}. Use schemaVersion=2.`);
    }
  }

  return {
    projectRoot,
    migratedConfig: false,
    migratedLock: false,
    migratedIntake: false
  };
}

export function explainMigration(result: MigrationResult): string {
  return [
    `Project: ${result.projectRoot}`,
    `Migrated config: ${result.migratedConfig ? 'yes' : 'no'}`,
    `Migrated lock: ${result.migratedLock ? 'yes' : 'no'}`,
    `Migrated intake: ${result.migratedIntake ? 'yes' : 'no'}`
  ].join('\n');
}
