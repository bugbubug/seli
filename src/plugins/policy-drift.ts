import type { CurrentFingerprint, ManagedEntryV2 } from '../domain/contracts.js';
import type { PolicyPlugin } from './interfaces.js';

function fingerprintMatches(
  current: CurrentFingerprint | null,
  expected: ManagedEntryV2
): boolean {
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

export const driftCheckPolicyPlugin: PolicyPlugin = {
  id: 'drift-check',
  kind: 'drift-check',
  checkManagedDrift(input) {
    const drifts: string[] = [];

    for (const managedEntry of input.existingManagedEntries) {
      const current = input.computeCurrentFingerprint({ path: managedEntry.path });
      if (!fingerprintMatches(current, managedEntry)) {
        drifts.push(managedEntry.path);
      }
    }

    return { drifts };
  }
};
