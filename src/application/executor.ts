import fs from 'node:fs';

import type { ExecuteResultV2, InstallPlanV2 } from '../domain/contracts.js';
import type { RuntimeEnvironment } from './runtime.js';
import { computeCurrentFingerprint, ensureDirForFile, removePathIfExists, writeJsonAtomic, writeFileAtomic } from '../infrastructure/fs.js';
import { LOCK_RELATIVE_PATH_V2 } from '../domain/defaults.js';

function assertNoManagedDrift(plan: InstallPlanV2, env: RuntimeEnvironment, force = false): void {
  if (force || !plan.existingLock) {
    return;
  }

  const driftPolicies = env.policyRegistry.getByKind('drift-check').filter(item => item.checkManagedDrift);
  let drifts: string[] = [];

  for (const policy of driftPolicies) {
    const result = policy.checkManagedDrift!({
      projectRoot: plan.projectRoot,
      existingManagedEntries: plan.existingLock.managed,
      computeCurrentFingerprint: entry => computeCurrentFingerprint(plan.projectRoot, entry)
    });
    drifts = [...drifts, ...result.drifts];
  }

  drifts = Array.from(new Set(drifts)).sort();
  if (drifts.length > 0) {
    const error = new Error(`Managed file drift detected: ${drifts.join(', ')}`) as Error & {
      code?: string;
      paths?: string[];
    };
    error.code = 'MANAGED_DRIFT';
    error.paths = drifts;
    throw error;
  }
}

function applyOperation(operation: InstallPlanV2['operations'][number]): void {
  if (operation.action === 'delete') {
    removePathIfExists(operation.absolutePath);
    return;
  }

  if (operation.action === 'write-file') {
    writeFileAtomic(operation.absolutePath, operation.entry.content);
    return;
  }

  ensureDirForFile(operation.absolutePath);
  removePathIfExists(operation.absolutePath);
  fs.symlinkSync(operation.entry.target, operation.absolutePath);
}

export function executePlanV2(plan: InstallPlanV2, env: RuntimeEnvironment, options: { force?: boolean | undefined } = {}): ExecuteResultV2 {
  assertNoManagedDrift(plan, env, Boolean(options.force));

  for (const operation of plan.operations.filter(item => item.action === 'delete')) {
    applyOperation(operation);
  }

  for (const operation of plan.operations.filter(item => item.action !== 'delete')) {
    applyOperation(operation);
  }

  writeJsonAtomic(`${plan.projectRoot}/${LOCK_RELATIVE_PATH_V2}`, plan.lockContent);

  return {
    operations: plan.operations,
    projectRoot: plan.projectRoot
  };
}
