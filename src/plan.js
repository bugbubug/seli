const fs = require('fs');
const path = require('path');
const {
  CONFIG_RELATIVE_PATH,
  LOCK_RELATIVE_PATH,
  createBootstrapConfig,
  loadExistingConfig,
  loadExistingLock,
  normalizeConfig,
  resolveConfig
} = require('./config');
const { readTemplate } = require('./catalog');
const {
  computeCurrentFingerprint,
  getManagedFingerprint,
  getFileContentIfExists,
  getSymlinkTargetIfExists,
  stableSortEntries,
} = require('./utils');
const {
  renderAgentsContract,
  renderCompatMarketplace,
  renderCompatPluginManifest,
  renderCompatPluginReadme,
  renderProjectSkill
} = require('./render');

function createFileEntry(pathRelativeToProject, content, metadata = {}) {
  return {
    type: 'file',
    path: pathRelativeToProject,
    content,
    ...metadata
  };
}

function createSymlinkEntry(pathRelativeToProject, target, metadata = {}) {
  return {
    type: 'symlink',
    path: pathRelativeToProject,
    target,
    ...metadata
  };
}

function maybeRelativeTarget(projectRoot, entryPath, targetPath, policy) {
  if (policy !== 'relative') {
    return targetPath;
  }
  const linkAbsolutePath = path.join(projectRoot, entryPath);
  return path.relative(path.dirname(linkAbsolutePath), targetPath) || '.';
}

function createDesiredEntries(projectRoot, config, resolvedConfig) {
  const entries = [];

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
    entries.push(
      createFileEntry('.codex/skills/README.md', readTemplate('system', 'codex-skills-readme.md.tpl'), {
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

    for (const skill of config.layers.project.skills) {
      if (skill.managed === false) {
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
  }

  entries.push(
    createFileEntry('.agents/skills/README.md', readTemplate('system', 'team-skills-readme.md.tpl'), {
      layer: 'system',
      owner: 'system-baseline',
      managed: true
    })
  );

  for (const provider of resolvedConfig.layers.team.providers) {
    for (const skill of provider.skills) {
      const absoluteTargetPath = path.join(provider.resolvedSourceRoot || '', 'skills', skill);
      const targetPath = maybeRelativeTarget(
        projectRoot,
        `.agents/skills/${skill}`,
        absoluteTargetPath,
        config.policies.symlink
      );
      entries.push(
        createSymlinkEntry(`.agents/skills/${skill}`, targetPath, {
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

function buildLockContent(config, resolvedConfig, managedEntries, packageVersion) {
  return {
    version: 1,
    tool: {
      name: 'ai-tool-init',
      version: packageVersion
    },
    profile: config.profile,
    resolved: {
      providers: resolvedConfig.layers.team.providers.map(provider => ({
        id: provider.id,
        resolvedSourceRoot: provider.resolvedSourceRoot,
        skills: provider.skills,
        materializationMode: provider.materializationMode
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

function createOperations(projectRoot, desiredEntries, existingLock, options = {}) {
  const operations = [];
  const desiredManagedEntries = desiredEntries.filter(entry => entry.managed);
  const desiredManagedPaths = new Set(desiredManagedEntries.map(entry => entry.path));
  const previousManagedEntries = existingLock ? existingLock.managed || [] : [];

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

function createPlan({ command, projectRoot, profileId = 'default' }) {
  const targetProjectRoot = path.resolve(projectRoot);
  const packageJson = require(path.join(__dirname, '..', 'package.json'));
  const existingConfig = loadExistingConfig(targetProjectRoot);
  const existingLock = loadExistingLock(targetProjectRoot);
  const bootstrapped = existingConfig ? null : createBootstrapConfig(targetProjectRoot, profileId);
  const config = normalizeConfig(existingConfig || bootstrapped.config);
  const resolvedConfig = resolveConfig(config);
  const desiredEntries = createDesiredEntries(targetProjectRoot, config, resolvedConfig);

  const configWriteRequired = !existingConfig;
  const configContent = `${JSON.stringify(config, null, 2)}\n`;
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

  const entriesWithState = [
    ...(configWriteRequired ? [configEntry] : []),
    ...desiredEntries,
    lockEntry
  ];

  const operations = createOperations(targetProjectRoot, entriesWithState, existingLock, { command });
  const collisions = config.layers.project.skills
    .map(skill => skill.id)
    .filter(skillId =>
      resolvedConfig.layers.team.providers.some(provider => provider.skills.includes(skillId))
    );

  return {
    command,
    config,
    desiredEntries: entriesWithState,
    detected: bootstrapped ? bootstrapped.detected : null,
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
      profile: config.profile
    }
  };
}

function explainPlan(plan) {
  const lines = [];
  lines.push(`Command: ${plan.command}`);
  lines.push(`Project: ${plan.projectRoot}`);
  lines.push(`Profile: ${plan.summary.profile}`);
  lines.push(`Operations: ${plan.summary.operationCount}`);
  lines.push(`Managed paths: ${plan.summary.managedPathCount}`);
  if (plan.summary.collisions.length > 0) {
    lines.push(`Project overrides team skills: ${plan.summary.collisions.join(', ')}`);
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

module.exports = {
  createPlan,
  explainPlan
};
