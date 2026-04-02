import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  SeliConfigV2,
  SeliLockV2,
  DesiredEntry,
  InstallCommand,
  InstallPlanSummaryV2,
  InstallPlanV2,
  ProjectCommandOptionsV2,
  ProviderPackageSnapshotV2
} from '../domain/contracts.js';
import type { RuntimeEnvironment } from './runtime.js';
import { createOperations } from '../domain/diff.js';
import { CONFIG_RELATIVE_PATH_V2, LOCK_RELATIVE_PATH_V2, normalizeConfigV2 } from '../domain/defaults.js';
import { applyIntakeAndPolicy } from '../domain/config-merge.js';
import { loadAndNormalizeIntake, resolveRequestedOperation } from '../domain/intake.js';
import {
  createBootstrapConfigV2,
  detectLegacyState,
  hasUnsupportedLegacyState,
  loadExistingConfigV2,
  loadExistingLockV2
} from '../domain/project-state.js';
import { readJsonFile } from '../infrastructure/json.js';
import { managedFingerprintFromDesired, sha256, stableSortEntries } from '../infrastructure/fs.js';
import { createFileEntry } from '../plugins/render-helpers.js';

interface PackageMetadata {
  version: string;
}

function toPackageSnapshots(planProviders: InstallPlanV2['resolved']['providers']): ProviderPackageSnapshotV2[] {
  return planProviders.flatMap(provider =>
    provider.packages.map(pkg => ({
      providerId: provider.id,
      packageId: pkg.id,
      label: pkg.label,
      priority: pkg.priority,
      resolvedRoot: pkg.resolvedRoot,
      fingerprint: pkg.fingerprint,
      skills: pkg.skills.map(skill => ({
        skillId: skill.skillId,
        sourcePackageId: skill.sourcePackageId,
        contentFingerprint: skill.contentFingerprint
      }))
    }))
  );
}

function computePackageDriftWarnings(
  resolvedProviders: InstallPlanV2['resolved']['providers'],
  existingLock: SeliLockV2 | null
): string[] {
  if (!existingLock) {
    return [];
  }

  const previousPackages = new Map<string, string>(
    existingLock.providerPackageSnapshots.map(pkg => [`${pkg.providerId}:${pkg.packageId}`, pkg.fingerprint])
  );
  const warnings: string[] = [];

  for (const provider of resolvedProviders) {
    for (const pkg of provider.packages) {
      const key = `${provider.id}:${pkg.id}`;
      const previousFingerprint = previousPackages.get(key);
      if (previousFingerprint && previousFingerprint !== pkg.fingerprint) {
        warnings.push(`Provider package changed: ${provider.id}/${pkg.label}`);
      }
    }
  }

  return warnings;
}

function buildSummary(
  config: SeliConfigV2,
  resolvedProviders: InstallPlanV2['resolved']['providers'],
  operations: InstallPlanV2['operations'],
  managedEntries: InstallPlanV2['managedEntries'],
  existingLock: SeliLockV2 | null
): InstallPlanSummaryV2 {
  const collisions = config.layers.project.skills
    .map(skill => skill.id)
    .filter(skillId => resolvedProviders.some(provider => provider.selectedSkills.some(item => item.skillId === skillId)));
  const resolvedPackageCount = resolvedProviders.reduce((total, provider) => total + provider.packages.length, 0);
  const selectedSkillSources = Object.fromEntries(
    resolvedProviders.flatMap(provider =>
      provider.selectedSkills.map(skill => [skill.skillId, `${provider.id}:${skill.sourcePackageId}`] as const)
    )
  );

  return {
    collisions,
    managedPathCount: managedEntries.length,
    operationCount: operations.length,
    packageDriftWarnings: computePackageDriftWarnings(resolvedProviders, existingLock),
    profile: config.profile,
    resolvedPackageCount,
    selectedSkillSources,
    teamLayerCleanupPaths: operations
      .filter(operation => operation.action === 'delete' && operation.path.startsWith('.agents/skills/'))
      .map(operation => operation.path)
      .sort()
  };
}

function collectTeamLayerCleanupPaths(projectRoot: string, selectedTeamSkillIds: string[]): string[] {
  const teamSkillsRoot = path.join(projectRoot, '.agents', 'skills');
  if (!fs.existsSync(teamSkillsRoot)) {
    return [];
  }

  const allowed = new Set<string>(['README.md', ...selectedTeamSkillIds]);
  const cleanupPaths: string[] = [];

  for (const name of fs.readdirSync(teamSkillsRoot)) {
    if (name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(teamSkillsRoot, name);
    const relativePath = `.agents/skills/${name}`;
    const stat = fs.lstatSync(absolutePath);
    const isSelectedSkill = name !== 'README.md' && allowed.has(name);

    if (!allowed.has(name)) {
      cleanupPaths.push(relativePath);
      continue;
    }

    if (isSelectedSkill && !stat.isSymbolicLink()) {
      cleanupPaths.push(relativePath);
    }
  }

  return cleanupPaths.sort();
}

function buildLockContent(
  _command: InstallCommand,
  config: SeliConfigV2,
  desiredManagedEntries: DesiredEntry[],
  packageVersion: string,
  env: RuntimeEnvironment,
  resolvedProviders: InstallPlanV2['resolved']['providers']
): SeliLockV2 {
  const providerPackageSnapshots = toPackageSnapshots(resolvedProviders);
  const pipelineFingerprint = sha256(
    JSON.stringify({
      profile: config.profile,
      managed: desiredManagedEntries.map(entry => ({
        path: entry.path,
        ...managedFingerprintFromDesired(entry)
      })),
      providers: providerPackageSnapshots.map(item => ({
        providerId: item.providerId,
        packageId: item.packageId,
        fingerprint: item.fingerprint
      }))
    })
  );

  return {
    version: 2,
    tool: {
      name: 'seli',
      version: packageVersion
    },
    profile: config.profile,
    pipelineFingerprint,
    pluginResolutions: {
      providers: env.providerRegistry.list(),
      renderers: env.rendererRegistry.list(),
      policies: env.policyRegistry.list(),
      doctorChecks: env.doctorRegistry.list()
    },
    providerPackageSnapshots,
    resolved: {
      providers: resolvedProviders.map(provider => ({
        id: provider.id,
        resolvedSourceRoot: provider.resolvedSourceRoot,
        skills: provider.selectedSkills.map(skill => skill.skillId),
        materializationMode: provider.materializationMode,
        packages: provider.packages.map(pkg => ({
          providerId: provider.id,
          packageId: pkg.id,
          label: pkg.label,
          priority: pkg.priority,
          resolvedRoot: pkg.resolvedRoot,
          fingerprint: pkg.fingerprint,
          skills: pkg.skills.map(skill => ({
            skillId: skill.skillId,
            sourcePackageId: skill.sourcePackageId,
            contentFingerprint: skill.contentFingerprint
          }))
        }))
      }))
    },
    managed: desiredManagedEntries.map(entry => ({
      layer: entry.layer,
      owner: entry.owner,
      path: entry.path,
      ...managedFingerprintFromDesired(entry)
    }))
  };
}

function buildRegistrySnapshot(config: SeliConfigV2, env: RuntimeEnvironment): SeliConfigV2 {
  return {
    ...config,
    registriesSnapshot: {
      commands: env.commandRegistry.list(),
      providers: env.providerRegistry.list(),
      renderers: env.rendererRegistry.list(),
      policies: env.policyRegistry.list(),
      doctorChecks: env.doctorRegistry.list()
    }
  };
}

export function createPlanV2(command: InstallCommand, options: ProjectCommandOptionsV2, env: RuntimeEnvironment): InstallPlanV2 {
  const projectRoot = path.resolve(options.projectRoot);
  if (hasUnsupportedLegacyState(projectRoot)) {
    throw new Error(
      `Unsupported legacy state detected under ${projectRoot}. Remove .ai-tool-init/, .aitoolinit.json, and .seli before running seli.`
    );
  }
  const packageJson = readJsonFile<PackageMetadata>(fileURLToPath(new URL('../../package.json', import.meta.url)));

  const intake = options.intakePath ? loadAndNormalizeIntake(options.intakePath) : null;
  if (intake?.target?.projectPath && path.resolve(intake.target.projectPath) !== projectRoot) {
    throw new Error(`Intake target.projectPath does not match --project: ${intake.target.projectPath} !== ${projectRoot}`);
  }

  const existingConfig = loadExistingConfigV2(projectRoot);
  const detectedLegacy = detectLegacyState(projectRoot);
  const effectiveCommand = resolveRequestedOperation(
    command,
    intake?.target?.requestedOperation,
    Boolean(existingConfig),
    detectedLegacy.hasAnyLegacyState
  );
  const bootstrapProfile = intake?.target?.profile || options.profileId || 'default';
  const existingLock = loadExistingLockV2(projectRoot);

  const baseConfig = existingConfig
    ? normalizeConfigV2(existingConfig)
    : createBootstrapConfigV2(projectRoot, bootstrapProfile).config;

  const providerRoots = Object.fromEntries(
    Object.entries(options.providerRoots ?? {}).map(([providerId, providerRoot]) => [providerId, path.resolve(providerRoot)])
  );

  const applied = applyIntakeAndPolicy(baseConfig, intake, providerRoots, env.providerRegistry, env.policyRegistry);
  const configWithRegistry = buildRegistrySnapshot(applied.config, env);
  const config = normalizeConfigV2(configWithRegistry);

  const desiredEntries = stableSortEntries(
    env.rendererRegistry
      .all()
      .flatMap(plugin => plugin.render({
        projectRoot,
        config,
        resolvedProviders: applied.resolvedProviders
      }))
  );

  const managedEntries = desiredEntries.filter(item => item.managed);
  const lockContent = buildLockContent(effectiveCommand, config, managedEntries, packageJson.version, env, applied.resolvedProviders);

  const configContent = `${JSON.stringify(config, null, 2)}\n`;
  const configEntry = createFileEntry(CONFIG_RELATIVE_PATH_V2, configContent, {
    layer: 'state',
    owner: 'config',
    managed: false
  });

  const lockEntry = createFileEntry(LOCK_RELATIVE_PATH_V2, `${JSON.stringify(lockContent, null, 2)}\n`, {
    layer: 'state',
    owner: 'lock',
    managed: false
  });

  const entriesWithState = [configEntry, ...desiredEntries, lockEntry];
  const teamLayerCleanupPaths = collectTeamLayerCleanupPaths(
    projectRoot,
    applied.resolvedProviders.flatMap(provider => provider.selectedSkills.map(skill => skill.skillId))
  );
  const operations = createOperations(projectRoot, entriesWithState, existingLock, teamLayerCleanupPaths);

  return {
    command: effectiveCommand,
    projectRoot,
    config,
    desiredEntries: entriesWithState,
    managedEntries,
    operations,
    lockContent,
    existingConfig: Boolean(existingConfig),
    existingLock,
    summary: buildSummary(config, applied.resolvedProviders, operations, managedEntries, existingLock),
    intake,
    resolved: {
      providers: applied.resolvedProviders
    }
  };
}

export function explainPlanV2(plan: InstallPlanV2): string {
  const lines = [
    `Command: ${plan.command}`,
    `Project: ${plan.projectRoot}`,
    `Profile: ${plan.summary.profile}`,
    `Resolved packages: ${plan.summary.resolvedPackageCount}`,
    `Operations: ${plan.summary.operationCount}`,
    `Managed paths: ${plan.summary.managedPathCount}`,
    `Pipeline fingerprint: ${plan.lockContent.pipelineFingerprint}`
  ];

  if (plan.summary.collisions.length > 0) {
    lines.push(`Project overrides team skills: ${plan.summary.collisions.join(', ')}`);
  }

  if (Object.keys(plan.summary.selectedSkillSources).length > 0) {
    lines.push(
      `Selected skill sources: ${Object.entries(plan.summary.selectedSkillSources)
        .map(([skillId, source]) => `${skillId}<-${source}`)
        .join(', ')}`
    );
  }

  if (plan.summary.packageDriftWarnings.length > 0) {
    lines.push(`Package warnings: ${plan.summary.packageDriftWarnings.join('; ')}`);
  }

  if (plan.summary.teamLayerCleanupPaths.length > 0) {
    lines.push(`Team layer cleanup: ${plan.summary.teamLayerCleanupPaths.join(', ')}`);
  }

  lines.push('');

  for (const operation of plan.operations) {
    if (operation.action === 'delete') {
      lines.push(`- delete ${operation.path}`);
    } else if (operation.action === 'write-file') {
      lines.push(`- write-file ${operation.path}`);
    } else {
      lines.push(`- write-symlink ${operation.path}`);
    }
  }

  return lines.join('\n');
}
