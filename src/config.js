const fs = require('fs');
const path = require('path');
const { loadProfile, loadProvider, managerRoot } = require('./catalog');
const { deepClone, listSkillDirectories, maybeRealPath, readJson, uniqueStrings } = require('./utils');

const CONFIG_RELATIVE_PATH = '.ai-tool-init/config.json';
const LOCK_RELATIVE_PATH = '.ai-tool-init/lock.json';

function configPathFor(projectRoot) {
  return path.join(projectRoot, CONFIG_RELATIVE_PATH);
}

function lockPathFor(projectRoot) {
  return path.join(projectRoot, LOCK_RELATIVE_PATH);
}

function loadExistingConfig(projectRoot) {
  const filePath = configPathFor(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function loadExistingLock(projectRoot) {
  const filePath = lockPathFor(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function buildConfigFromProfile(profileId = 'default') {
  const profile = loadProfile(profileId);
  return deepClone(profile.config);
}

function resolveProviderSourceRoot(providerConfig) {
  const providerCatalog = loadProvider(providerConfig.id);
  const explicit = providerConfig.sourceRoot ? path.resolve(providerConfig.sourceRoot) : null;
  if (explicit) {
    return explicit;
  }

  const envValue = providerCatalog.source.envVar ? process.env[providerCatalog.source.envVar] : null;
  if (envValue) {
    return path.resolve(envValue);
  }

  const candidates = providerCatalog.source.defaultCandidates || [];
  if (candidates.length === 0) {
    return null;
  }

  const resolvedCandidates = candidates.map(candidate => path.resolve(managerRoot, candidate));
  const existing = resolvedCandidates.find(candidate => fs.existsSync(candidate));
  return existing || resolvedCandidates[0];
}

function detectLegacyState(projectRoot) {
  const builtInSkillRoot = path.join(projectRoot, '.codex', 'skills');
  const teamSkillRoot = path.join(projectRoot, '.agents', 'skills');
  const agentRoot = path.join(projectRoot, '.codex', 'agents');
  const pluginMarketplacePath = path.join(projectRoot, '.agents', 'plugins', 'marketplace.json');
  const pluginsRoot = path.join(projectRoot, 'plugins');

  const builtInSkills = listSkillDirectories(builtInSkillRoot)
    .filter(skill => skill !== 'README');
  const extraAgents = fs.existsSync(agentRoot)
    ? fs.readdirSync(agentRoot)
        .filter(file => file.endsWith('.toml'))
        .map(file => path.basename(file, '.toml'))
        .sort()
    : [];

  const teamSkills = [];
  const legacyLocalSkills = [];
  let detectedSourceRoot = null;
  if (fs.existsSync(teamSkillRoot)) {
    for (const name of fs.readdirSync(teamSkillRoot).sort()) {
      if (name.startsWith('.')) {
        continue;
      }
      const absolutePath = path.join(teamSkillRoot, name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        teamSkills.push(name);
        const linkTarget = fs.readlinkSync(absolutePath);
        const resolvedTarget = maybeRealPath(path.resolve(path.dirname(absolutePath), linkTarget));
        if (resolvedTarget) {
          const maybeSkillsRoot = path.dirname(resolvedTarget);
          const maybeRoot = path.basename(maybeSkillsRoot) === 'skills'
            ? path.dirname(maybeSkillsRoot)
            : maybeSkillsRoot;
          if (!detectedSourceRoot) {
            detectedSourceRoot = maybeRoot;
          }
        }
      } else if (stat.isDirectory() && fs.existsSync(path.join(absolutePath, 'SKILL.md'))) {
        legacyLocalSkills.push(name);
      }
    }
  }

  const compatEnabled =
    fs.existsSync(pluginMarketplacePath) ||
    (fs.existsSync(pluginsRoot) &&
      fs.readdirSync(pluginsRoot).some(name =>
        fs.existsSync(path.join(pluginsRoot, name, '.codex-plugin', 'plugin.json'))
      ));

  const hasAnyLegacyState =
    builtInSkills.length > 0 ||
    teamSkills.length > 0 ||
    legacyLocalSkills.length > 0 ||
    extraAgents.length > 0 ||
    compatEnabled ||
    fs.existsSync(path.join(projectRoot, '.codex')) ||
    fs.existsSync(path.join(projectRoot, '.claude')) ||
    fs.existsSync(path.join(projectRoot, '.agents'));

  return {
    builtInSkills,
    compatEnabled,
    detectedSourceRoot,
    extraAgents,
    hasAnyLegacyState,
    legacyLocalSkills,
    teamSkills
  };
}

function createBootstrapConfig(projectRoot, profileId = 'default') {
  const base = buildConfigFromProfile(profileId);
  const detected = detectLegacyState(projectRoot);

  if (!detected.hasAnyLegacyState) {
    return {
      config: base,
      detected
    };
  }

  const config = deepClone(base);
  const provider = config.layers.team.providers[0];

  if (detected.teamSkills.length > 0) {
    provider.skills = detected.teamSkills;
  }
  if (detected.detectedSourceRoot) {
    provider.sourceRoot = detected.detectedSourceRoot;
  }

  if (detected.builtInSkills.length > 0) {
    config.layers.project.skills = detected.builtInSkills.map(skill => ({
      id: skill,
      description: `Detected existing project skill ${skill}.`,
      managed: false
    }));
  } else {
    config.layers.project.skills = [];
  }

  if (detected.extraAgents.length > 0) {
    config.layers.project.extraAgents = detected.extraAgents;
  }

  config.layers.project.compatPlugin.enabled = detected.compatEnabled;

  return {
    config,
    detected
  };
}

function normalizeConfig(inputConfig) {
  const config = deepClone(inputConfig);
  config.version = 1;
  config.profile = config.profile || 'default';
  config.platforms = config.platforms || {};
  config.platforms.codex = config.platforms.codex || { enabled: true };
  config.platforms.claude = config.platforms.claude || { enabled: true };

  config.layers = config.layers || {};
  config.layers.system = config.layers.system || { baselineVersion: '1.0.0', modules: ['codex', 'claude'] };
  config.layers.system.modules = uniqueStrings(config.layers.system.modules || ['codex', 'claude']);

  config.layers.team = config.layers.team || { providers: [] };
  config.layers.team.providers = (config.layers.team.providers || []).map(provider => {
    const normalizedProvider = {
      id: provider.id,
      materializationMode: provider.materializationMode || 'symlink',
      skills: uniqueStrings(provider.skills || [])
    };
    if (provider.sourceRoot) {
      normalizedProvider.sourceRoot = provider.sourceRoot;
    }
    return normalizedProvider;
  });

  config.layers.project = config.layers.project || {};
  config.layers.project.skills = (config.layers.project.skills || []).map(skill => ({
    id: skill.id,
    description: skill.description || `Project skill ${skill.id}.`,
    managed: skill.managed !== false
  }));
  config.layers.project.compatPlugin = config.layers.project.compatPlugin || {
    enabled: false,
    pluginId: 'ai-tool-init-compat'
  };
  config.layers.project.compatPlugin.pluginId =
    config.layers.project.compatPlugin.pluginId || 'ai-tool-init-compat';
  config.layers.project.extraAgents = uniqueStrings(config.layers.project.extraAgents || ['explorer', 'reviewer']);

  config.policies = config.policies || {};
  config.policies.overwriteManagedFiles = Boolean(config.policies.overwriteManagedFiles);
  config.policies.drift = config.policies.drift || 'error';
  config.policies.symlink = config.policies.symlink || 'relative';
  config.policies.compat = config.policies.compat || 'minimal';

  return config;
}

function resolveConfig(config) {
  const resolved = deepClone(config);
  resolved.layers.team.providers = resolved.layers.team.providers.map(provider => ({
    ...provider,
    resolvedSourceRoot: resolveProviderSourceRoot(provider)
  }));
  return resolved;
}

module.exports = {
  CONFIG_RELATIVE_PATH,
  LOCK_RELATIVE_PATH,
  buildConfigFromProfile,
  configPathFor,
  createBootstrapConfig,
  detectLegacyState,
  loadExistingConfig,
  loadExistingLock,
  lockPathFor,
  normalizeConfig,
  resolveConfig
};
