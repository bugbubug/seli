import type { DoctorResultV2, ProjectCommandOptionsV2 } from '../domain/contracts.js';
import type { RuntimeEnvironment } from './runtime.js';
import { createPlanV2 } from './planner.js';
import { verifyStage } from './pipeline/stages.js';

export function runDoctorV2(options: ProjectCommandOptionsV2, env: RuntimeEnvironment): DoctorResultV2 {
  const plan = createPlanV2('doctor', options, env);
  const result = verifyStage(plan, env);

  if (!plan.existingConfig) {
    result.warnings.push('Target repository is not onboarded yet; manifest will be bootstrapped from detected state.');
  }

  if (plan.summary.collisions.length > 0) {
    for (const collision of plan.summary.collisions) {
      result.info.push(`Project skill overrides team skill: ${collision}`);
    }
  }

  return {
    ...result,
    ok: result.errors.length === 0
  };
}

export function explainDoctorV2(result: DoctorResultV2): string {
  const lines = [`Doctor status: ${result.ok ? 'ok' : 'error'}`];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const item of result.errors) {
      lines.push(`- ${item}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const item of result.warnings) {
      lines.push(`- ${item}`);
    }
  }

  if (result.info.length > 0) {
    lines.push('Info:');
    for (const item of result.info) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join('\n');
}
