import fs from 'node:fs';

import type { DoctorCheckPlugin } from './interfaces.js';

export const providerStateDoctorPlugin: DoctorCheckPlugin = {
  id: 'provider-state',
  check(context) {
    for (const provider of context.plan.resolved.providers) {
      const sourcePath = provider.resolvedSourceRoot;
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        context.errors.push(`Provider source root missing for ${provider.id}: ${sourcePath || '(unresolved)'}`);
      }

      const previousProvider = context.plan.existingLock?.resolved.providers.find(item => item.id === provider.id);
      const previousPackages = new Map<string, string>(
        (previousProvider?.packages ?? []).map(pkg => [`${provider.id}:${pkg.packageId}`, pkg.fingerprint])
      );

      for (const pkg of provider.packages) {
        if (!fs.existsSync(pkg.resolvedRoot)) {
          context.errors.push(`Provider package root missing for ${provider.id}: ${pkg.resolvedRoot}`);
          continue;
        }

        const previousFingerprint = previousPackages.get(`${provider.id}:${pkg.id}`);
        if (previousFingerprint && previousFingerprint !== pkg.fingerprint) {
          context.errors.push(`Provider package drift detected for ${provider.id}: ${pkg.label}`);
        }
      }

      for (const previousPackage of previousProvider?.packages ?? []) {
        const currentPackage = provider.packages.find(item => item.id === previousPackage.packageId);
        if (!currentPackage) {
          context.errors.push(`Provider package missing for ${provider.id}: ${previousPackage.label}`);
          continue;
        }

        for (const skill of previousPackage.skills) {
          const exists = currentPackage.skills.some(item => item.skillId === skill.skillId);
          if (!exists) {
            context.errors.push(`Provider skill missing for ${provider.id}: ${skill.skillId}`);
          }
        }
      }
    }
  }
};
