import fs from 'node:fs';
import path from 'node:path';

import { loadProfile, loadProvider, managerRoot } from './catalog.js';
import { buildResolvedProvider, createTeamSkillPackageConfig } from './provider-packages.js';
import type {
  SeliConfig,
  SeliLock,
  DetectedLegacyState,
  ProjectSkillConfig,
  ResolvedSeliConfig,
  TeamProviderConfig
} from './types.js';
import { deepClone, listSkillDirectories, maybeRealPath, readJson, uniqueStrings } from './utils.js';

export const CONFIG_RELATIVE_PATH = '.selirc';
export const LOCK_RELATIVE_PATH = '.seli.lock';

export function configPathFor(projectRoot: string): string {
  return path.join(projectRoot, CONFIG_RELATIVE_PATH);
}

export function lockPathFor(projectRoot: string): string {
  return path.join(projectRoot, LOCK_RELATIVE_PATH);
}

export function loadExistingConfig(projectRoot: string): SeliConfig | null {
  const filePath = configPathFor(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson<SeliConfig>(filePath);
}

export function loadExistingLock(projectRoot: string): SeliLock | null {
  const filePath = lockPathFor(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson<SeliLock>(filePath);
}

export function buildConfigFromProfile(profileId = 'default'): SeliConfig {
  const profile = loadProfile(profileId);
  return deepClone(profile.config);
}

const REQUIRED_PROJECT_SKILLS: ProjectSkillConfig[] = [
  {
    id: 'repo-governance',
    description: 'Generic repository governance and topology guardrails.',
    managed: true
  },
  {
    id: 'change-closeout',
    description: 'Generic repo-local closeout checklist and reporting template.',
    managed: true
  },
  {
    id: 'team-skill-evolution',
    description: 'Expand and refresh team skill coverage as the project matures.',
    managed: true,
    whenToUse: [
      'Use when the project enters a new phase, adds new technical scope, or needs additional team skills beyond the initial bootstrap.'
    ],
    workflow: [
      'Read AGENTS.md, .selirc, and .seli.lock before choosing new team skills.',
      'Review the current repository structure, uploaded docs, and configured team skill packages to identify capability gaps.',
      'Prepare intake changes for the new team skill selection, then run plan, update, and doctor.'
    ],
    guardrails: [
      'Add team skills incrementally based on current project evidence instead of enabling every available skill.',
      'Prefer project-local skills when repository-specific guidance should override the team layer.'
    ]
  },
  {
    id: 'team-skill-sync',
    description: 'Keep mounted team skills aligned with external package updates and replacements.',
    managed: true,
    whenToUse: [
      'Use when team skill packages change on disk, new packages are introduced, or existing package contents have been updated.'
    ],
    workflow: [
      'Compare the current package scan against .seli.lock to find added, removed, or changed team skills.',
      'Adjust the selected team skills when a package change affects the project capability set.',
      'Run plan, update, and doctor to refresh symlinks, lock fingerprints, and validation state.'
    ],
    guardrails: [
      'Treat lock drift as a signal to rescan package contents before changing team skill selections.',
      'Do not edit mounted team skills inside the project; update the source package or rerun seli.'
    ]
  }
];

function ensureRequiredProjectSkills(skills: ProjectSkillConfig[]): ProjectSkillConfig[] {
  const existingById = new Map(skills.map(skill => [skill.id, skill]));
  const requiredSkills = REQUIRED_PROJECT_SKILLS.map(defaultSkill => ({
    ...defaultSkill,
    ...existingById.get(defaultSkill.id),
    guardrails: uniqueStrings([...(defaultSkill.guardrails ?? []), ...(existingById.get(defaultSkill.id)?.guardrails ?? [])]),
    relatedTeamSkills: uniqueStrings(existingById.get(defaultSkill.id)?.relatedTeamSkills ?? defaultSkill.relatedTeamSkills ?? []),
    sourceDocumentLabels: uniqueStrings(
      existingById.get(defaultSkill.id)?.sourceDocumentLabels ?? defaultSkill.sourceDocumentLabels ?? []
    ),
    sourcePaths: uniqueStrings(existingById.get(defaultSkill.id)?.sourcePaths ?? defaultSkill.sourcePaths ?? []).map(item =>
      path.resolve(item)
    ),
    whenToUse: uniqueStrings([...(defaultSkill.whenToUse ?? []), ...(existingById.get(defaultSkill.id)?.whenToUse ?? [])]),
    workflow: uniqueStrings([...(defaultSkill.workflow ?? []), ...(existingById.get(defaultSkill.id)?.workflow ?? [])]),
    managed: true
  }));
  const otherSkills = skills.filter(skill => !requiredSkills.some(requiredSkill => requiredSkill.id === skill.id));
  return [...requiredSkills, ...otherSkills];
}

export function resolveProviderSourceRoot(providerConfig: TeamProviderConfig): string | null {
  const providerCatalog = loadProvider(providerConfig.id);
  const explicit = providerConfig.sourceRoot ? path.resolve(providerConfig.sourceRoot) : null;
  if (explicit) {
    return explicit;
  }

  const envValue = providerCatalog.source.envVar ? process.env[providerCatalog.source.envVar] : null;
  if (envValue) {
    return path.resolve(envValue);
  }

  const candidates = providerCatalog.source.defaultCandidates ?? [];
  if (candidates.length === 0) {
    return null;
  }

  const resolvedCandidates = candidates.map(candidate => path.resolve(managerRoot, candidate));
  return resolvedCandidates.find(candidate => fs.existsSync(candidate)) ?? resolvedCandidates[0] ?? null;
}

export function detectLegacyState(projectRoot: string): DetectedLegacyState {
  const builtInSkillRoot = path.join(projectRoot, '.codex', 'skills');
  const teamSkillRoot = path.join(projectRoot, '.agents', 'skills');
  const agentRoot = path.join(projectRoot, '.codex', 'agents');
  const pluginMarketplacePath = path.join(projectRoot, '.agents', 'plugins', 'marketplace.json');
  const pluginsRoot = path.join(projectRoot, 'plugins');

  const builtInSkills = listSkillDirectories(builtInSkillRoot).filter(skill => skill !== 'README');
  const extraAgents = fs.existsSync(agentRoot)
    ? fs
        .readdirSync(agentRoot)
        .filter(file => file.endsWith('.toml'))
        .map(file => path.basename(file, '.toml'))
        .sort()
    : [];

  const teamSkills: string[] = [];
  const legacyLocalSkills: string[] = [];
  let detectedSourceRoot: string | null = null;

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
        if (resolvedTarget && !detectedSourceRoot) {
          const maybeSkillsRoot = path.dirname(resolvedTarget);
          detectedSourceRoot =
            path.basename(maybeSkillsRoot) === 'skills' ? path.dirname(maybeSkillsRoot) : maybeSkillsRoot;
        }
      } else if (stat.isDirectory() && fs.existsSync(path.join(absolutePath, 'SKILL.md'))) {
        legacyLocalSkills.push(name);
      }
    }
  }

  const compatEnabled =
    fs.existsSync(pluginMarketplacePath) ||
    (fs.existsSync(pluginsRoot) &&
      fs
        .readdirSync(pluginsRoot)
        .some(name => fs.existsSync(path.join(pluginsRoot, name, '.codex-plugin', 'plugin.json'))));

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

export function createBootstrapConfig(
  projectRoot: string,
  profileId = 'default'
): { config: SeliConfig; detected: DetectedLegacyState } {
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
  if (!provider) {
    throw new Error(`Profile ${profileId} does not define a default team provider.`);
  }

  if (detected.teamSkills.length > 0) {
    provider.skills = detected.teamSkills;
  }
  if (detected.detectedSourceRoot) {
    provider.sourceRoot = detected.detectedSourceRoot;
  }

  config.layers.project.skills =
    detected.builtInSkills.length > 0
      ? detected.builtInSkills.map(skill => ({
          id: skill,
          description: `Detected existing project skill ${skill}.`,
          managed: false
        }))
      : [];

  if (detected.extraAgents.length > 0) {
    config.layers.project.extraAgents = detected.extraAgents;
  }

  config.layers.project.compatPlugin.enabled = detected.compatEnabled;

  return {
    config,
    detected
  };
}

export function normalizeConfig(inputConfig: SeliConfig): SeliConfig {
  const config = deepClone(inputConfig);
  config.version = 1;
  config.profile = config.profile || 'default';
  config.platforms = config.platforms || { codex: { enabled: true }, claude: { enabled: true } };
  config.platforms.codex = config.platforms.codex || { enabled: true };
  config.platforms.claude = config.platforms.claude || { enabled: true };

  config.layers = config.layers || {
    system: { baselineVersion: '1.0.0', modules: ['codex', 'claude'] },
    team: { providers: [] },
    project: {
      skills: [],
      compatPlugin: { enabled: false, pluginId: 'seli-compat' },
      extraAgents: ['explorer', 'reviewer']
    }
  };

  config.layers.system = config.layers.system || {
    baselineVersion: '1.0.0',
    modules: ['codex', 'claude']
  };
  config.layers.system.modules = uniqueStrings(config.layers.system.modules || ['codex', 'claude']);

  config.layers.team = config.layers.team || { providers: [] };
  config.layers.team.providers = (config.layers.team.providers || []).map(provider => {
    const normalizedPackages =
      provider.packages && provider.packages.length > 0
        ? provider.packages.map(item => ({
            id: item.id || createTeamSkillPackageConfig(provider.id, item.rootPath, { label: item.label }).id,
            label: item.label || path.basename(item.rootPath),
            materializationMode: item.materializationMode || provider.materializationMode || 'symlink',
            priority: item.priority ?? 0,
            rootPath: path.resolve(item.rootPath)
          }))
        : provider.sourceRoot
          ? [
              createTeamSkillPackageConfig(provider.id, provider.sourceRoot, {
                label: path.basename(provider.sourceRoot),
                materializationMode: provider.materializationMode,
                priority: 0
              })
            ]
          : [];
    const normalizedProvider: TeamProviderConfig = {
      id: provider.id,
      materializationMode: provider.materializationMode || 'symlink',
      packages: normalizedPackages,
      skills: uniqueStrings(provider.skills || [])
    };
    if (provider.sourceRoot || normalizedPackages[0]?.rootPath) {
      normalizedProvider.sourceRoot = path.resolve(provider.sourceRoot || normalizedPackages[0]!.rootPath);
    }
    return normalizedProvider;
  });

  config.layers.project = config.layers.project || {
    skills: [],
    compatPlugin: { enabled: false, pluginId: 'seli-compat' },
    extraAgents: ['explorer', 'reviewer']
  };
  config.layers.project.skills = (config.layers.project.skills || []).map(skill => ({
    id: skill.id,
    description: skill.description || `Project skill ${skill.id}.`,
    managed: skill.managed !== false,
    guardrails: uniqueStrings(skill.guardrails || []),
    relatedTeamSkills: uniqueStrings(skill.relatedTeamSkills || []),
    sourceDocumentLabels: uniqueStrings(skill.sourceDocumentLabels || []),
    sourcePaths: uniqueStrings(skill.sourcePaths || []).map(item => path.resolve(item)),
    whenToUse: uniqueStrings(skill.whenToUse || []),
    workflow: uniqueStrings(skill.workflow || [])
  }));
  config.layers.project.skills = ensureRequiredProjectSkills(config.layers.project.skills);

  const compatPlugin = config.layers.project.compatPlugin || {
    enabled: false,
    pluginId: 'seli-compat'
  };
  config.layers.project.compatPlugin = {
    enabled: compatPlugin.enabled,
    pluginId: compatPlugin.pluginId || 'seli-compat'
  };
  config.layers.project.extraAgents = uniqueStrings(config.layers.project.extraAgents || ['explorer', 'reviewer']);

  config.policies = config.policies || {
    overwriteManagedFiles: false,
    drift: 'error',
    symlink: 'relative',
    compat: 'minimal'
  };
  config.policies.overwriteManagedFiles = Boolean(config.policies.overwriteManagedFiles);
  config.policies.drift = config.policies.drift || 'error';
  config.policies.symlink = config.policies.symlink || 'relative';
  config.policies.compat = config.policies.compat || 'minimal';

  return config;
}

export function resolveConfig(config: SeliConfig): ResolvedSeliConfig {
  const resolved = deepClone(config);
  resolved.layers.team.providers = resolved.layers.team.providers.map(provider => {
    const fallbackSourceRoot = resolveProviderSourceRoot(provider);
    return buildResolvedProvider({
      ...provider,
      sourceRoot: provider.sourceRoot || fallbackSourceRoot || undefined
    });
  }) as ResolvedSeliConfig['layers']['team']['providers'];
  return resolved as ResolvedSeliConfig;
}
