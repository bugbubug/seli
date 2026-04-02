import { executePlan } from './apply.js';
import { explainDoctor, runDoctor } from './doctor.js';
import { createPlan, explainPlan } from './plan.js';

import type { InitOrUpdateResult, ProjectCommandOptions } from './types.js';

export function planProject(options: ProjectCommandOptions) {
  return createPlan({
    command: 'plan',
    ...options
  });
}

export function initProject(options: ProjectCommandOptions): InitOrUpdateResult {
  const plan = createPlan({
    command: 'init',
    ...options
  });
  const result = executePlan(plan, options);
  return { plan, result };
}

export function updateProject(options: ProjectCommandOptions): InitOrUpdateResult {
  const plan = createPlan({
    command: 'update',
    ...options
  });
  const result = executePlan(plan, options);
  return { plan, result };
}

export { createPlan, executePlan, explainDoctor, explainPlan, runDoctor };
export type {
  AgentDecisionRecord,
  AgentIntakeDocument,
  AgentIntakeManifest,
  AiToolInitConfig,
  AiToolInitLock,
  CliOptions,
  DoctorError,
  DoctorResult,
  EffectiveRunContext,
  InstallPlan,
  InstallPlanOperation,
  LayerConfig,
  ProjectSkillBlueprint,
  ProviderRootMap,
  ProjectSkillConfig,
  ResolvedProviderConfig,
  ResolvedTeamSkillPackage,
  RequestedOperation,
  TeamSkillPolicyCatalog,
  TeamSkillPolicyRule,
  TeamSkillPackageConfig,
  TeamSkillPackageInput,
  TeamProviderConfig
} from './types.js';
