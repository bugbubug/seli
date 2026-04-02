import { createRuntimeEnvironment } from './application/create-runtime.js';
import { runDoctorV2, explainDoctorV2 } from './application/doctor.js';
import { executePlanV2 } from './application/executor.js';
import { explainMigration, migrateProjectToV2 } from './application/migrate.js';
import { createPlanV2, explainPlanV2 } from './application/planner.js';
import type { InitOrUpdateResultV2, ProjectCommandOptionsV2 } from './domain/contracts.js';

function withDefaults(options: ProjectCommandOptionsV2): ProjectCommandOptionsV2 {
  return {
    ...options,
    profileId: options.profileId || 'default',
    providerRoots: options.providerRoots || {}
  };
}

export function planProject(options: ProjectCommandOptionsV2) {
  const env = createRuntimeEnvironment();
  return createPlanV2('plan', withDefaults(options), env);
}

export function initProject(options: ProjectCommandOptionsV2): InitOrUpdateResultV2 {
  const env = createRuntimeEnvironment();
  const plan = createPlanV2('init', withDefaults(options), env);
  const result = executePlanV2(plan, env, { force: options.force });
  return { plan, result };
}

export function updateProject(options: ProjectCommandOptionsV2): InitOrUpdateResultV2 {
  const env = createRuntimeEnvironment();
  const plan = createPlanV2('update', withDefaults(options), env);
  const result = executePlanV2(plan, env, { force: options.force });
  return { plan, result };
}

export function runDoctor(options: ProjectCommandOptionsV2) {
  const env = createRuntimeEnvironment();
  return runDoctorV2(withDefaults(options), env);
}

export function migrateProject(options: ProjectCommandOptionsV2) {
  const env = createRuntimeEnvironment();
  return migrateProjectToV2(withDefaults(options), env);
}

export const explainPlan = explainPlanV2;
export const explainDoctor = explainDoctorV2;
export const explainMigrationResult = explainMigration;

export type {
  AgentIntakeManifestV2,
  SeliConfigV2,
  SeliLockV2,
  CliOutputMode,
  DoctorResultV2,
  InitOrUpdateResultV2,
  InstallPlanV2,
  InstallPlanOperation,
  ParsedCliOptionsV2,
  ProjectCommandOptionsV2,
  RequestedOperation,
  TeamProviderConfigV2,
  TeamSkillPolicyCatalog
} from './domain/contracts.js';
