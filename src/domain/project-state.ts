import fs from 'node:fs';
import path from 'node:path';

import type {
  SeliConfigV2,
  SeliLockV2
} from './contracts.js';
import { buildConfigFromProfileV2, normalizeConfigV2, CONFIG_RELATIVE_PATH_V2, LOCK_RELATIVE_PATH_V2 } from './defaults.js';
import { listSkillDirectories, maybeRealPath } from '../infrastructure/fs.js';
import { readJsonFile } from '../infrastructure/json.js';

export interface LegacyStateDetection {
  builtInSkills: string[];
  teamSkills: string[];
  legacyLocalSkills: string[];
  extraAgents: string[];
  detectedSourceRoot: string | null;
  hasAnyLegacyState: boolean;
}

export function configPathFor(projectRoot: string): string {
  return path.join(projectRoot, CONFIG_RELATIVE_PATH_V2);
}

export function lockPathFor(projectRoot: string): string {
  return path.join(projectRoot, LOCK_RELATIVE_PATH_V2);
}

export function hasUnsupportedLegacyState(projectRoot: string): boolean {
  const legacyPaths = [
    path.join(projectRoot, '.ai-tool-init'),
    path.join(projectRoot, '.aitoolinit.json'),
    path.join(projectRoot, '.seli')
  ];
  return legacyPaths.some(item => fs.existsSync(item));
}

export function detectLegacyState(projectRoot: string): LegacyStateDetection {
  const builtInSkillRoot = path.join(projectRoot, '.codex', 'skills');
  const teamSkillRoot = path.join(projectRoot, '.agents', 'skills');
  const agentRoot = path.join(projectRoot, '.codex', 'agents');

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

  const hasAnyLegacyState =
    builtInSkills.length > 0 ||
    teamSkills.length > 0 ||
    legacyLocalSkills.length > 0 ||
    extraAgents.length > 0 ||
    fs.existsSync(path.join(projectRoot, '.codex')) ||
    fs.existsSync(path.join(projectRoot, '.claude')) ||
    fs.existsSync(path.join(projectRoot, '.agents'));

  return {
    builtInSkills,
    teamSkills,
    legacyLocalSkills,
    extraAgents,
    detectedSourceRoot,
    hasAnyLegacyState
  };
}

export function loadExistingConfigV2(projectRoot: string): SeliConfigV2 | null {
  const filePath = configPathFor(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = readJsonFile<Record<string, unknown>>(filePath);
  if (raw.version !== 2) {
    throw new Error(`Unsupported config schema in ${filePath}. Seli only supports .selirc schema version 2.`);
  }
  return normalizeConfigV2(raw as unknown as SeliConfigV2);
}

export function loadExistingLockV2(projectRoot: string): SeliLockV2 | null {
  const filePath = lockPathFor(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = readJsonFile<Record<string, unknown>>(filePath);
  if (raw.version !== 2) {
    throw new Error(`Unsupported lock schema in ${filePath}. Seli only supports .seli.lock schema version 2.`);
  }
  const lock = raw as unknown as SeliLockV2;
  if (lock.tool?.name !== 'seli') {
    throw new Error(`Unsupported lock tool in ${filePath}. Expected tool.name to be "seli".`);
  }
  return lock;
}

export function createBootstrapConfigV2(projectRoot: string, profileId = 'default'): {
  config: SeliConfigV2;
  detected: LegacyStateDetection;
} {
  const base = buildConfigFromProfileV2(profileId);
  const detected = detectLegacyState(projectRoot);

  if (!detected.hasAnyLegacyState) {
    return {
      config: base,
      detected
    };
  }

  const config = normalizeConfigV2(base);
  const provider = config.layers.team.providers[0];
  if (!provider) {
    throw new Error(`Profile ${profileId} does not define a team provider.`);
  }

  if (detected.teamSkills.length > 0) {
    provider.skills = detected.teamSkills;
  }

  if (detected.detectedSourceRoot) {
    provider.sourceRoot = detected.detectedSourceRoot;
    provider.packages = [
      {
        id: `${provider.id}-detected`,
        label: path.basename(detected.detectedSourceRoot),
        rootPath: detected.detectedSourceRoot,
        priority: 0,
        materializationMode: provider.materializationMode
      }
    ];
  }

  config.layers.project.skills =
    detected.builtInSkills.length > 0
      ? detected.builtInSkills.map(skillId => ({
          id: skillId,
          description: `Detected existing project skill ${skillId}.`,
          managed: false
        }))
      : config.layers.project.skills;

  if (detected.extraAgents.length > 0) {
    config.layers.project.extraAgents = detected.extraAgents;
  }

  return {
    config: normalizeConfigV2(config),
    detected
  };
}
