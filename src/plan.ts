import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readTemplate } from './catalog.js';
import {
  CONFIG_RELATIVE_PATH,
  LOCK_RELATIVE_PATH,
  createBootstrapConfig,
  loadExistingConfig,
  loadExistingLock,
  normalizeConfig,
  resolveConfig
} from './config.js';
import {
  applyAgentInputsToConfig,
  createEffectiveRunContext,
  readIntakeIfPresent,
  resolveBootstrapProfileId,
  resolveRequestedOperation
} from './intake.js';
import {
  renderAgentsContract,
  renderCompatMarketplace,
  renderCompatPluginManifest,
  renderCompatPluginReadme,
  renderProjectSkill,
  renderSkillTeamContext
} from './render.js';
import type {
  SeliConfig,
  SeliLock,
  DesiredEntry,
  DesiredFileEntry,
  DesiredSymlinkEntry,
  InstallCommand,
  InstallPlan,
  InstallPlanOperation,
  PackageMetadata,
  ResolvedSeliConfig
} from './types.js';
import { getFileContentIfExists, getManagedFingerprint, getSymlinkTargetIfExists, readJson, stableSortEntries } from './utils.js';

function createFileEntry(pathRelativeToProject: string, content: string, metadata: Omit<DesiredFileEntry, 'content' | 'path' | 'type'>): DesiredFileEntry {
  return {
    type: 'file',
    path: pathRelativeToProject,
    content,
    ...metadata
  };
}

function createSymlinkEntry(
  pathRelativeToProject: string,
  target: string,
  metadata: Omit<DesiredSymlinkEntry, 'path' | 'target' | 'type'>
): DesiredSymlinkEntry {
  return {
    type: 'symlink',
    path: pathRelativeToProject,
    target,
    ...metadata
  };
}

function maybeRelativeTarget(projectRoot: string, entryPath: string, targetPath: string, policy: SeliConfig['policies']['symlink']): string {
  if (policy !== 'relative') {
    return targetPath;
  }
  const linkAbsolutePath = path.join(projectRoot, entryPath);
  return path.relative(path.dirname(linkAbsolutePath), targetPath) || '.';
}

function createDesiredEntries(
  projectRoot: string,
  config: SeliConfig,
  resolvedConfig: ResolvedSeliConfig
): DesiredEntry[] {
  const entries: DesiredEntry[] = [];
  const projectSkillSourceRoot = path.join(projectRoot, '.codex', 'skills');

  entries.push(
    createFileEntry('AGENTS.md', renderAgentsContract(config, resolvedConfig), {
      layer: 'system',
      owner: 'system-baseline',
      managed: true
    })
  );
  entries.push(
    createSymlinkEntry('CLAUDE.md', 'AGENTS.md', {
      layer: 'system',
      owner: 'system-baseline',
      managed: true
    })
  );

  if (config.platforms.codex.enabled) {
    entries.push(
      createFileEntry('.codex/config.toml', readTemplate('system', 'codex-config.toml.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );

    for (const agentName of config.layers.project.extraAgents) {
      if (agentName === 'explorer') {
        entries.push(
          createFileEntry('.codex/agents/explorer.toml', readTemplate('system', 'codex-agent-explorer.toml.tpl'), {
            layer: 'project',
            owner: 'project-agents',
            managed: true
          })
        );
      }
      if (agentName === 'reviewer') {
        entries.push(
          createFileEntry('.codex/agents/reviewer.toml', readTemplate('system', 'codex-agent-reviewer.toml.tpl'), {
            layer: 'project',
            owner: 'project-agents',
            managed: true
          })
        );
      }
    }
  }

  if (config.platforms.codex.enabled || config.platforms.claude.enabled) {
    entries.push(
      createFileEntry('.codex/skills/README.md', readTemplate('system', 'codex-skills-readme.md.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    for (const skill of config.layers.project.skills) {
      if (!skill.managed) {
        continue;
      }
      entries.push(
        createFileEntry(`.codex/skills/${skill.id}/SKILL.md`, renderProjectSkill(skill), {
          layer: 'project',
          owner: 'project-skill',
          managed: true
        })
      );
    }
  }

  if (config.platforms.claude.enabled) {
    entries.push(
      createFileEntry('.claude/README.md', readTemplate('system', 'claude-readme.md.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    entries.push(
      createFileEntry('.claude/rules/README.md', readTemplate('system', 'claude-rules-readme.md.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    entries.push(
      createFileEntry('.claude/settings.local.json', readTemplate('system', 'claude-settings.local.json.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    entries.push(
      createSymlinkEntry(
        '.claude/skills',
        maybeRelativeTarget(projectRoot, '.claude/skills', projectSkillSourceRoot, config.policies.symlink),
        {
          layer: 'project',
          owner: 'project-skill',
          managed: true
        }
      )
    );
  }

  entries.push(
    createFileEntry('.agents/skills/README.md', readTemplate('system', 'team-skills-readme.md.tpl'), {
      layer: 'system',
      owner: 'system-baseline',
      managed: true
    })
  );
  entries.push(
    createFileEntry('.agents/skill_team.md', renderSkillTeamContext(resolvedConfig), {
      layer: 'team',
      owner: 'team-context',
      managed: true
    })
  );

  for (const provider of resolvedConfig.layers.team.providers) {
    for (const skill of provider.selectedSkills) {
      const targetPath = maybeRelativeTarget(
        projectRoot,
        `.agents/skills/${skill.skillId}`,
        skill.skillPath,
        config.policies.symlink
      );
      entries.push(
        createSymlinkEntry(`.agents/skills/${skill.skillId}`, targetPath, {
          layer: 'team',
          owner: provider.id,
          managed: true
        })
      );
    }
  }

  if (config.layers.project.compatPlugin.enabled) {
    const pluginId = config.layers.project.compatPlugin.pluginId;
    entries.push(
      createFileEntry('.agents/plugins/marketplace.json', renderCompatMarketplace(pluginId), {
        layer: 'compat',
        owner: 'compat-plugin',
        managed: true
      })
    );
    entries.push(
      createFileEntry(`plugins/${pluginId}/.codex-plugin/plugin.json`, renderCompatPluginManifest(pluginId), {
        layer: 'compat',
        owner: 'compat-plugin',
        managed: true
      })
    );
    entries.push(
      createFileEntry(`plugins/${pluginId}/README.md`, renderCompatPluginReadme(pluginId), {
        layer: 'compat',
        owner: 'compat-plugin',
        managed: true
      })
    );
    entries.push(
      createSymlinkEntry(
        `plugins/${pluginId}/skills`,
        maybeRelativeTarget(
          projectRoot,
          `plugins/${pluginId}/skills`,
          path.join(projectRoot, '.codex', 'skills'),
          config.policies.symlink
        ),
        {
          layer: 'compat',
          owner: 'compat-plugin',
          managed: true
        }
      )
    );
  }

  return stableSortEntries(entries);
}

function buildLockContent(
  config: SeliConfig,
  resolvedConfig: ResolvedSeliConfig,
  managedEntries: DesiredEntry[],
  packageVersion: string
): SeliLock {
  return {
    version: 1,
    tool: {
      name: 'seli',
      version: packageVersion
    },
    profile: config.profile,
    resolved: {
      providers: resolvedConfig.layers.team.providers.map(provider => ({
        id: provider.id,
        resolvedSourceRoot: provider.resolvedSourceRoot,
        skills: provider.selectedSkills.map(skill => skill.skillId),
        materializationMode: provider.materializationMode,
        packages: provider.packages.map(pkg => ({
          id: pkg.id,
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
    managed: managedEntries.map(entry => ({
      layer: entry.layer,
      owner: entry.owner,
      path: entry.path,
      ...getManagedFingerprint(entry)
    }))
  };
}

function createOperations(
  projectRoot: string,
  desiredEntries: DesiredEntry[],
  existingLock: SeliLock | null
): InstallPlanOperation[] {
  const operations: InstallPlanOperation[] = [];
  const desiredManagedEntries = desiredEntries.filter(entry => entry.managed);
  const desiredManagedPaths = new Set(desiredManagedEntries.map(entry => entry.path));
  const previousManagedEntries = existingLock?.managed ?? [];

  for (const previousEntry of previousManagedEntries) {
    if (!desiredManagedPaths.has(previousEntry.path)) {
      operations.push({
        action: 'delete',
        path: previousEntry.path,
        absolutePath: path.join(projectRoot, previousEntry.path),
        previous: previousEntry
      });
    }
  }

  for (const entry of desiredEntries) {
    const absolutePath = path.join(projectRoot, entry.path);
    if (entry.type === 'file') {
      const currentContent = getFileContentIfExists(absolutePath);
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

    const currentTarget = getSymlinkTargetIfExists(absolutePath);
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

function computePackageDriftWarnings(
  resolvedConfig: ResolvedSeliConfig,
  existingLock: SeliLock | null
): string[] {
  if (!existingLock) {
    return [];
  }

  const previousPackages = new Map<string, string>(
    existingLock.resolved.providers.flatMap(provider =>
      provider.packages.map(pkg => [`${provider.id}:${pkg.id}`, pkg.fingerprint] as const)
    )
  );
  const warnings: string[] = [];

  for (const provider of resolvedConfig.layers.team.providers) {
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

export function createPlan({
  command,
  projectRoot,
  intakePath,
  providerRoots,
  profileId = 'default'
}: {
  command: InstallCommand;
  projectRoot: string;
  profileId?: string | undefined;
  intakePath?: string | undefined;
  providerRoots?: Record<string, string> | undefined;
}): InstallPlan {
  const targetProjectRoot = path.resolve(projectRoot);
  const packageJson = readJson<PackageMetadata>(fileURLToPath(new URL('../package.json', import.meta.url)));
  const intake = readIntakeIfPresent(intakePath);
  if (intake?.targetProjectPath && intake.targetProjectPath !== targetProjectRoot) {
    throw new Error(
      `Intake targetProjectPath does not match --project: ${intake.targetProjectPath} !== ${targetProjectRoot}`
    );
  }
  const existingConfig = loadExistingConfig(targetProjectRoot);
  const existingLock = loadExistingLock(targetProjectRoot);
  const bootstrapProfileId = resolveBootstrapProfileId(profileId, intake);
  const effectiveCommand = resolveRequestedOperation(command, targetProjectRoot, intake);
  const bootstrapped = existingConfig ? null : createBootstrapConfig(targetProjectRoot, bootstrapProfileId);
  const config = normalizeConfig(
    applyAgentInputsToConfig(normalizeConfig(existingConfig || bootstrapped!.config), intake, providerRoots)
  );
  const resolvedConfig = resolveConfig(config);
  const desiredEntries = createDesiredEntries(targetProjectRoot, config, resolvedConfig);
  const context = createEffectiveRunContext({
    config,
    detected: bootstrapped ? bootstrapped.detected : null,
    existingConfig,
    existingLock,
    intake,
    projectRoot: targetProjectRoot
  });

  const configContent = `${JSON.stringify(config, null, 2)}\n`;
  const existingConfigContent = existingConfig ? `${JSON.stringify(existingConfig, null, 2)}\n` : null;
  const configWriteRequired = existingConfigContent !== configContent;
  const managedEntries = desiredEntries.filter(entry => entry.managed);
  const lockContent = buildLockContent(config, resolvedConfig, managedEntries, packageJson.version);
  const lockEntry = createFileEntry(LOCK_RELATIVE_PATH, `${JSON.stringify(lockContent, null, 2)}\n`, {
    layer: 'state',
    owner: 'lock',
    managed: false
  });
  const configEntry = createFileEntry(CONFIG_RELATIVE_PATH, configContent, {
    layer: 'state',
    owner: 'config',
    managed: false
  });

  const entriesWithState = [...(configWriteRequired ? [configEntry] : []), ...desiredEntries, lockEntry];

  const operations = createOperations(targetProjectRoot, entriesWithState, existingLock);
  const collisions = config.layers.project.skills
    .map(skill => skill.id)
    .filter(skillId => resolvedConfig.layers.team.providers.some(provider => provider.selectedSkills.some(item => item.skillId === skillId)));
  const resolvedPackageCount = resolvedConfig.layers.team.providers.reduce((total, provider) => total + provider.packages.length, 0);
  const selectedSkillSources = Object.fromEntries(
    resolvedConfig.layers.team.providers.flatMap(provider =>
      provider.selectedSkills.map(skill => [skill.skillId, `${provider.id}:${skill.sourcePackageId}`] as const)
    )
  );
  const packageDriftWarnings = computePackageDriftWarnings(resolvedConfig, existingLock);

  return {
    command: effectiveCommand,
    config,
    desiredEntries: entriesWithState,
    detected: context.detected,
    existingConfig: Boolean(existingConfig),
    existingLock,
    lockContent,
    managedEntries,
    operations,
    projectRoot: targetProjectRoot,
    summary: {
      collisions,
      managedPathCount: managedEntries.length,
      operationCount: operations.length,
      packageDriftWarnings,
      profile: config.profile,
      resolvedPackageCount,
      selectedSkillSources
    }
  };
}

export function explainPlan(plan: InstallPlan): string {
  const lines = [
    `Command: ${plan.command}`,
    `Project: ${plan.projectRoot}`,
    `Profile: ${plan.summary.profile}`,
    `Resolved packages: ${plan.summary.resolvedPackageCount}`,
    `Operations: ${plan.summary.operationCount}`,
    `Managed paths: ${plan.summary.managedPathCount}`
  ];
  if (plan.summary.collisions.length > 0) {
    lines.push(`Project overrides team skills: ${plan.summary.collisions.join(', ')}`);
  }
  if (Object.keys(plan.summary.selectedSkillSources).length > 0) {
    lines.push(
      `Selected skill sources: ${Object.entries(plan.summary.selectedSkillSources)
        .map(([skillId, source]) => `${skillId}<- ${source}`)
        .join(', ')}`
    );
  }
  if (plan.summary.packageDriftWarnings.length > 0) {
    lines.push(`Package warnings: ${plan.summary.packageDriftWarnings.join('; ')}`);
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
