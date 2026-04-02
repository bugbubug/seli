const fs = require('fs');
const path = require('path');
const { computeCurrentFingerprint, ensureDirForFile, removePathIfExists, writeJson } = require('./utils');

function fingerprintMatches(current, expected) {
  if (!current) {
    return false;
  }
  if (current.type !== expected.type) {
    return false;
  }
  if (current.type === 'file') {
    return current.sha256 === expected.sha256;
  }
  if (current.type === 'symlink') {
    return current.symlinkTarget === expected.symlinkTarget;
  }
  return false;
}

function assertNoManagedDrift(plan, force = false) {
  if (force || !plan.existingLock) {
    return;
  }

  const drifts = [];
  for (const managedEntry of plan.existingLock.managed || []) {
    const current = computeCurrentFingerprint(plan.projectRoot, managedEntry);
    if (!fingerprintMatches(current, managedEntry)) {
      drifts.push(managedEntry.path);
    }
  }

  if (drifts.length > 0) {
    const error = new Error(`Managed file drift detected: ${drifts.join(', ')}`);
    error.code = 'MANAGED_DRIFT';
    error.paths = drifts;
    throw error;
  }
}

function applyOperation(plan, operation) {
  if (operation.action === 'delete') {
    removePathIfExists(operation.absolutePath);
    return;
  }

  if (operation.action === 'write-file') {
    ensureDirForFile(operation.absolutePath);
    fs.writeFileSync(operation.absolutePath, operation.entry.content, 'utf8');
    return;
  }

  if (operation.action === 'write-symlink') {
    ensureDirForFile(operation.absolutePath);
    removePathIfExists(operation.absolutePath);
    fs.symlinkSync(operation.entry.target, operation.absolutePath);
  }
}

function executePlan(plan, options = {}) {
  const force = Boolean(options.force);
  assertNoManagedDrift(plan, force);

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

module.exports = {
  executePlan
};
