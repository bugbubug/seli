import path from 'node:path';

import type { SeliLockV2, DesiredEntry, InstallPlanOperation } from './contracts.js';
import { readSymlinkIfExists, readTextIfExists } from '../infrastructure/fs.js';

export function createOperations(
  projectRoot: string,
  desiredEntries: DesiredEntry[],
  existingLock: SeliLockV2 | null,
  forcedDeletePaths: string[] = []
): InstallPlanOperation[] {
  const operations: InstallPlanOperation[] = [];
  const desiredManagedEntries = desiredEntries.filter(entry => entry.managed);
  const desiredManagedPaths = new Set(desiredManagedEntries.map(entry => entry.path));
  const previousManagedEntries = existingLock?.managed ?? [];
  const seenDeletePaths = new Set<string>();

  const pushDelete = (pathRelative: string, previous: SeliLockV2['managed'][number]) => {
    if (seenDeletePaths.has(pathRelative)) {
      return;
    }
    seenDeletePaths.add(pathRelative);
    operations.push({
      action: 'delete',
      path: pathRelative,
      absolutePath: path.join(projectRoot, pathRelative),
      previous
    });
  };

  for (const previousEntry of previousManagedEntries) {
    if (!desiredManagedPaths.has(previousEntry.path)) {
      pushDelete(previousEntry.path, previousEntry);
    }
  }

  for (const relativePath of forcedDeletePaths) {
    const previous =
      previousManagedEntries.find(entry => entry.path === relativePath) ??
      ({
        path: relativePath,
        layer: 'team',
        owner: 'team-normalization',
        type: 'file',
        sha256: ''
      } as const);
    pushDelete(relativePath, previous);
  }

  for (const entry of desiredEntries) {
    const absolutePath = path.join(projectRoot, entry.path);
    if (entry.type === 'file') {
      const currentContent = readTextIfExists(absolutePath);
      if (currentContent !== entry.content) {
        operations.push({
          action: 'write-file',
          path: entry.path,
          absolutePath,
          entry
        });
      }
      continue;
    }

    const currentTarget = readSymlinkIfExists(absolutePath);
    if (currentTarget !== entry.target) {
      operations.push({
        action: 'write-symlink',
        path: entry.path,
        absolutePath,
        entry
      });
    }
  }

  return operations;
}
