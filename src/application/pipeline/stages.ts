import type { DoctorResultV2, InstallPlanV2 } from '../../domain/contracts.js';
import type { RuntimeEnvironment } from '../runtime.js';
import { executePlanV2 } from '../executor.js';

export function executeStage(plan: InstallPlanV2, env: RuntimeEnvironment, force = false) {
  return executePlanV2(plan, env, { force });
}

export function verifyStage(plan: InstallPlanV2, env: RuntimeEnvironment): DoctorResultV2 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  for (const plugin of env.doctorRegistry.all()) {
    plugin.check({
      plan,
      errors,
      warnings,
      info
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    info
  };
}
