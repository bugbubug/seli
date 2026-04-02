import path from 'node:path';

import type { DoctorCheckPlugin } from './interfaces.js';
import { computeCurrentFingerprint, isInside } from '../infrastructure/fs.js';

export const managedStateDoctorPlugin: DoctorCheckPlugin = {
  id: 'managed-state',
  check(context) {
    for (const managedEntry of context.plan.lockContent.managed) {
      if (!isInside(context.plan.projectRoot, path.join(context.plan.projectRoot, managedEntry.path))) {
        context.errors.push(`Managed path escaped project root: ${managedEntry.path}`);
      }
    }

    if (!context.plan.existingLock) {
      return;
    }

    for (const managedEntry of context.plan.existingLock.managed) {
      const current = computeCurrentFingerprint(context.plan.projectRoot, managedEntry);
      if (!current) {
        context.errors.push(`Managed path missing: ${managedEntry.path}`);
        continue;
      }
      if (managedEntry.type === 'file' && current.type === 'file' && current.sha256 !== managedEntry.sha256) {
        context.errors.push(`Managed file drift: ${managedEntry.path}`);
      }
      if (
        managedEntry.type === 'symlink' &&
        current.type === 'symlink' &&
        current.symlinkTarget !== managedEntry.symlinkTarget
      ) {
        context.errors.push(`Managed symlink drift: ${managedEntry.path}`);
      }
    }
  }
};
