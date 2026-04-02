import fs from 'node:fs';
import path from 'node:path';

import type { CurrentFingerprint, ExecuteResult, InstallPlan, ManagedEntry } from './types.js';
import { computeCurrentFingerprint, ensureDirForFile, removePathIfExists, writeJson } from './utils.js';

function fingerprintMatches(current: CurrentFingerprint | null, expected: ManagedEntry): boolean {
  if (!current || current.type !== expected.type) {
    return false;
  }
  if (current.type === 'file' && expected.type === 'file') {
    return current.sha256 === expected.sha256;
  }
  if (current.type === 'symlink' && expected.type === 'symlink') {
    return current.symlinkTarget === expected.symlinkTarget;
  }
  return false;
}

function assertNoManagedDrift(plan: InstallPlan, force = false): void {
  if (force || !plan.existingLock) {
    return;
  }

  const drifts: string[] = [];
  for (const managedEntry of plan.existingLock.managed) {
    const current = computeCurrentFingerprint(plan.projectRoot, managedEntry);
    if (!fingerprintMatches(current, managedEntry)) {
      drifts.push(managedEntry.path);
    }
  }

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

function applyOperation(plan: InstallPlan, operation: InstallPlan['operations'][number]): void {
  if (operation.action === 'delete') {
    removePathIfExists(operation.absolutePath);
    return;
  }

  if (operation.action === 'write-file') {
    ensureDirForFile(operation.absolutePath);
    fs.writeFileSync(operation.absolutePath, operation.entry.content, 'utf8');
    return;
  }

  ensureDirForFile(operation.absolutePath);
  removePathIfExists(operation.absolutePath);
  fs.symlinkSync(operation.entry.target, operation.absolutePath);
}

export function executePlan(plan: InstallPlan, options: { force?: boolean | undefined } = {}): ExecuteResult {
  assertNoManagedDrift(plan, Boolean(options.force));

  for (const operation of plan.operations.filter(item => item.action === 'delete')) {
    applyOperation(plan, operation);
  }
  for (const operation of plan.operations.filter(item => item.action !== 'delete')) {
    applyOperation(plan, operation);
  }

  writeJson(path.join(plan.projectRoot, '.ai-tool-init', 'lock.json'), plan.lockContent);

  return {
    operations: plan.operations,
    projectRoot: plan.projectRoot
  };
}
