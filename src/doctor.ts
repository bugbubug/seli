import fs from 'node:fs';
import path from 'node:path';

import { createPlan } from './plan.js';
import type { DoctorResult, ProjectCommandOptions } from './types.js';
import { computeCurrentFingerprint, getSymlinkTargetIfExists, isInside } from './utils.js';

export function runDoctor({
  intakePath,
  profileId = 'default',
  projectRoot,
  providerRoots
}: ProjectCommandOptions): DoctorResult {
  const plan = createPlan({
    command: 'doctor',
    intakePath,
    providerRoots,
    projectRoot,
    profileId
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  if (!plan.existingConfig) {
    warnings.push('Target repository is not onboarded yet; manifest will be bootstrapped from detected state.');
  }

  for (const provider of plan.lockContent.resolved.providers) {
    const sourcePath = provider.resolvedSourceRoot;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      errors.push(`Provider source root missing for ${provider.id}: ${sourcePath || '(unresolved)'}`);
    }
    const previousProvider = plan.existingLock?.resolved.providers.find(item => item.id === provider.id);
    for (const pkg of provider.packages) {
      if (!fs.existsSync(pkg.resolvedRoot)) {
        errors.push(`Provider package root missing for ${provider.id}: ${pkg.resolvedRoot}`);
        continue;
      }
      const previousPackage = previousProvider?.packages.find(item => item.id === pkg.id);
      if (previousPackage && previousPackage.fingerprint !== pkg.fingerprint) {
        errors.push(`Provider package drift detected for ${provider.id}: ${pkg.label}`);
      }
      for (const skill of pkg.skills) {
        const matchingSkill = previousPackage?.skills.find(item => item.skillId === skill.skillId);
        if (!matchingSkill) {
          continue;
        }
        if (matchingSkill.contentFingerprint !== skill.contentFingerprint) {
          errors.push(`Provider skill drift detected for ${provider.id}: ${skill.skillId}`);
        }
      }
    }
    for (const previousPackage of previousProvider?.packages ?? []) {
      const currentPackage = provider.packages.find(item => item.id === previousPackage.id);
      if (!currentPackage) {
        errors.push(`Provider package missing for ${provider.id}: ${previousPackage.label}`);
        continue;
      }
      for (const skill of previousPackage.skills) {
        const foundSkill = currentPackage.skills.some(item => item.skillId === skill.skillId);
        if (!foundSkill) {
          errors.push(`Provider skill missing for ${provider.id}: ${skill.skillId}`);
        }
      }
    }
  }

  if (plan.config.platforms.claude.enabled) {
    const expectedTarget = path.relative(path.join(plan.projectRoot, '.claude'), path.join(plan.projectRoot, '.codex', 'skills')) || '.';
    const currentTarget = getSymlinkTargetIfExists(path.join(plan.projectRoot, '.claude', 'skills'));
    if (currentTarget !== expectedTarget) {
      errors.push(`Claude skill entrypoint mismatch: .claude/skills -> ${currentTarget || '(missing)'}`);
    }
  }

  for (const managedEntry of plan.lockContent.managed) {
    if (!isInside(plan.projectRoot, path.join(plan.projectRoot, managedEntry.path))) {
      errors.push(`Managed path escaped project root: ${managedEntry.path}`);
    }
  }

  if (plan.existingLock) {
    for (const managedEntry of plan.existingLock.managed) {
      const current = computeCurrentFingerprint(plan.projectRoot, managedEntry);
      if (!current) {
        errors.push(`Managed path missing: ${managedEntry.path}`);
        continue;
      }
      if (managedEntry.type === 'file' && current.type === 'file' && current.sha256 !== managedEntry.sha256) {
        errors.push(`Managed file drift: ${managedEntry.path}`);
      }
      if (
        managedEntry.type === 'symlink' &&
        current.type === 'symlink' &&
        current.symlinkTarget !== managedEntry.symlinkTarget
      ) {
        errors.push(`Managed symlink drift: ${managedEntry.path}`);
      }
    }
  }

  for (const collision of plan.summary.collisions) {
    info.push(`Project skill overrides team skill: ${collision}`);
  }

  if (plan.detected && plan.detected.legacyLocalSkills.length > 0) {
    warnings.push(
      `Legacy repo-local skills still exist under .agents/skills/: ${plan.detected.legacyLocalSkills.join(', ')}`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    info
  };
}

export function explainDoctor(result: DoctorResult): string {
  const lines = [`Doctor status: ${result.ok ? 'ok' : 'error'}`];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
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
