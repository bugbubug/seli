const fs = require('fs');
const path = require('path');
const { createPlan } = require('./plan');
const { computeCurrentFingerprint, isInside } = require('./utils');

function runDoctor({ projectRoot, profileId = 'default' }) {
  const plan = createPlan({
    command: 'doctor',
    projectRoot,
    profileId
  });

  const errors = [];
  const warnings = [];
  const info = [];

  if (!plan.existingConfig) {
    warnings.push('Target repository is not onboarded yet; manifest will be bootstrapped from detected state.');
  }

  for (const provider of plan.config.layers.team.providers) {
    const resolvedProvider = plan.desiredEntries.find(entry => entry.owner === provider.id);
    const sourceRoot = plan.config.layers.team.providers
      .map(item => item.id)
      .includes(provider.id)
      ? plan.config.layers.team.providers.find(item => item.id === provider.id).sourceRoot
      : null;
    const resolved = plan.lockContent.resolved.providers.find(item => item.id === provider.id);
    const sourcePath = resolved ? resolved.resolvedSourceRoot : sourceRoot;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      errors.push(`Provider source root missing for ${provider.id}: ${sourcePath || '(unresolved)'}`);
    }
    for (const skill of provider.skills) {
      if (!sourcePath) {
        continue;
      }
      const skillPath = path.join(sourcePath, 'skills', skill, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        errors.push(`Provider skill missing for ${provider.id}: ${skillPath}`);
      }
    }
  }

  for (const managedEntry of plan.lockContent.managed) {
    if (!isInside(plan.projectRoot, path.join(plan.projectRoot, managedEntry.path))) {
      errors.push(`Managed path escaped project root: ${managedEntry.path}`);
    }
  }

  if (plan.existingLock) {
    for (const managedEntry of plan.existingLock.managed || []) {
      const current = computeCurrentFingerprint(plan.projectRoot, managedEntry);
      if (!current) {
        errors.push(`Managed path missing: ${managedEntry.path}`);
        continue;
      }
      if (managedEntry.type === 'file' && current.sha256 !== managedEntry.sha256) {
        errors.push(`Managed file drift: ${managedEntry.path}`);
      }
      if (managedEntry.type === 'symlink' && current.symlinkTarget !== managedEntry.symlinkTarget) {
        errors.push(`Managed symlink drift: ${managedEntry.path}`);
      }
    }
  }

  for (const collision of plan.summary.collisions) {
    info.push(`Project skill overrides team skill: ${collision}`);
  }

  if (plan.detected && plan.detected.legacyLocalSkills.length > 0) {
    warnings.push(`Legacy repo-local skills still exist under .agents/skills/: ${plan.detected.legacyLocalSkills.join(', ')}`);
  }

  return {
    errors,
    info,
    ok: errors.length === 0,
    warnings
  };
}

function explainDoctor(result) {
  const lines = [];
  lines.push(`Doctor status: ${result.ok ? 'ok' : 'error'}`);
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

module.exports = {
  explainDoctor,
  runDoctor
};
