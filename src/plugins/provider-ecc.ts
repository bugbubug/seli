import fs from 'node:fs';
import path from 'node:path';

import type {
  ProviderCatalog,
  ResolvedPackageSkillV2,
  ResolvedProviderPackageV2,
  ResolvedProviderV2,
  TeamProviderConfigV2
} from '../domain/contracts.js';
import type { ProviderPlugin } from './interfaces.js';
import { loadProviderCatalog, managerRoot } from '../infrastructure/catalog.js';
import { sha256, slugify, summarizeSkill, uniqueStrings } from '../infrastructure/fs.js';

function createPackageId(providerId: string, rootPath: string, label?: string): string {
  const stem = slugify(label || path.basename(rootPath) || providerId);
  return `${providerId}-${stem}-${sha256(path.resolve(rootPath)).slice(0, 8)}`;
}

function resolvePackageRoot(rootPath: string, skillsSubdir: string): string {
  const absoluteRoot = path.resolve(rootPath);
  if (path.basename(absoluteRoot) === skillsSubdir && fs.existsSync(absoluteRoot)) {
    return path.dirname(absoluteRoot);
  }
  return absoluteRoot;
}

function resolveCatalogCandidate(candidate: string): string {
  if (path.isAbsolute(candidate)) {
    return path.resolve(candidate);
  }
  return path.resolve(managerRoot, candidate);
}

function createEccLocalCandidates(): string[] {
  const home = process.env.HOME ? path.resolve(process.env.HOME) : null;
  const cwd = path.resolve(process.cwd());
  const candidates = [
    ...(home
      ? [
          path.join(home, 'Desktop', 'ai-project', 'everything-claude-code'),
          path.join(home, 'Desktop', 'everything-claude-code'),
          path.join(home, 'projects', 'everything-claude-code'),
          path.join(home, 'workspace', 'everything-claude-code'),
          path.join(home, 'code', 'everything-claude-code')
        ]
      : []),
    path.resolve(cwd, '../everything-claude-code'),
    path.resolve(cwd, '../../everything-claude-code'),
    path.resolve(cwd, '../../../everything-claude-code')
  ];
  return uniqueStrings(candidates.map(item => path.resolve(item)));
}

function resolveSourceRootFromCatalog(providerCatalog: ProviderCatalog): string | null {
  if (providerCatalog.source.envVar) {
    const envValue = process.env[providerCatalog.source.envVar];
    if (envValue) {
      return path.resolve(envValue);
    }
  }

  const candidates = providerCatalog.source.defaultCandidates ?? [];
  const localCandidates = providerCatalog.id === 'ecc' ? createEccLocalCandidates() : [];
  const resolvedCandidates = uniqueStrings([...localCandidates, ...candidates.map(resolveCatalogCandidate)]);

  if (resolvedCandidates.length === 0) {
    return null;
  }

  return resolvedCandidates.find(candidate => fs.existsSync(candidate)) ?? resolvedCandidates[0] ?? null;
}

function resolveCatalogCandidates(providerCatalog: ProviderCatalog): string[] {
  const candidates = providerCatalog.source.defaultCandidates ?? [];
  if (candidates.length === 0) {
    return [];
  }
  return candidates.map(resolveCatalogCandidate);
}

function resolvePackages(providerCatalog: ProviderCatalog, providerConfig: TeamProviderConfigV2): TeamProviderConfigV2['packages'] {
  if (providerConfig.packages && providerConfig.packages.length > 0) {
    return providerConfig.packages.map((item, index) => ({
      id: item.id || createPackageId(providerConfig.id, item.rootPath, item.label),
      label: item.label || path.basename(item.rootPath),
      rootPath: path.resolve(item.rootPath),
      priority: item.priority ?? index,
      materializationMode: item.materializationMode || providerConfig.materializationMode
    }));
  }

  const sourceRoot = providerConfig.sourceRoot || resolveSourceRootFromCatalog(providerCatalog);
  if (!sourceRoot) {
    const fallbackCatalogCandidates = resolveCatalogCandidates(providerCatalog);
    if (fallbackCatalogCandidates.length === 0) {
      return [];
    }

    const normalizedFallbackRoot = path.resolve(fallbackCatalogCandidates[0]!);
    return [
      {
        id: createPackageId(providerConfig.id, normalizedFallbackRoot, path.basename(normalizedFallbackRoot)),
        label: path.basename(normalizedFallbackRoot),
        rootPath: normalizedFallbackRoot,
        priority: 0,
        materializationMode: providerConfig.materializationMode
      }
    ];
  }

  const normalizedRoot = path.resolve(sourceRoot);
  return [
    {
      id: createPackageId(providerConfig.id, normalizedRoot, path.basename(normalizedRoot)),
      label: path.basename(normalizedRoot),
      rootPath: normalizedRoot,
      priority: 0,
      materializationMode: providerConfig.materializationMode
    }
  ];
}

function resolvePackageSkills(providerCatalog: ProviderCatalog, providerConfig: TeamProviderConfigV2, packages: TeamProviderConfigV2['packages']): ResolvedProviderPackageV2[] {
  return packages
    .map(item => {
      const resolvedRoot = resolvePackageRoot(item.rootPath, providerCatalog.source.skillsSubdir);
      const skillsRoot = path.join(resolvedRoot, providerCatalog.source.skillsSubdir);
      const skillIds = fs.existsSync(skillsRoot)
        ? fs
            .readdirSync(skillsRoot)
            .filter(name => !name.startsWith('.'))
            .filter(name => fs.existsSync(path.join(skillsRoot, name, 'SKILL.md')))
            .filter(name => providerCatalog.allowedSkills.includes(name))
            .sort()
        : [];

      const skills: ResolvedPackageSkillV2[] = skillIds.map(skillId => {
        const skillPath = path.join(skillsRoot, skillId);
        const content = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf8');
        return {
          contentFingerprint: sha256(content),
          skillId,
          skillPath,
          sourcePackageId: item.id,
          summary: summarizeSkill(content)
        };
      });

      return {
        ...item,
        fingerprint: sha256(
          JSON.stringify(
            skills.map(skill => ({
              skillId: skill.skillId,
              contentFingerprint: skill.contentFingerprint
            }))
          )
        ),
        materializationMode: item.materializationMode || providerConfig.materializationMode,
        resolvedRoot,
        skills,
        summary: skills.map(skill => `${skill.skillId}: ${skill.summary}`).join('\n').slice(0, 400)
      };
    })
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}

export const eccProviderPlugin: ProviderPlugin = {
  id: 'ecc',
  resolveSourceRoot(providerConfig: TeamProviderConfigV2): string | null {
    if (providerConfig.sourceRoot) {
      return path.resolve(providerConfig.sourceRoot);
    }
    return resolveSourceRootFromCatalog(loadProviderCatalog('ecc'));
  },
  resolveProvider({ providerConfig }): ResolvedProviderV2 {
    const providerCatalog = loadProviderCatalog(providerConfig.id);
    const packages = resolvePackages(providerCatalog, providerConfig);
    const resolvedPackages = resolvePackageSkills(providerCatalog, providerConfig, packages);
    const selectedIds = uniqueStrings(providerConfig.skills);
    const availableSkillMap = new Map<string, ResolvedPackageSkillV2>();

    for (const pkg of resolvedPackages) {
      for (const skill of pkg.skills) {
        if (!availableSkillMap.has(skill.skillId)) {
          availableSkillMap.set(skill.skillId, skill);
        }
      }
    }

    return {
      id: providerConfig.id,
      materializationMode: providerConfig.materializationMode,
      sourceRoot: providerConfig.sourceRoot,
      resolvedSourceRoot: resolvedPackages[0]?.resolvedRoot ?? this.resolveSourceRoot(providerConfig),
      packages: resolvedPackages,
      selectedSkills: selectedIds.map(skillId => availableSkillMap.get(skillId)).filter(Boolean) as ResolvedPackageSkillV2[],
      availableSkillIds: Array.from(availableSkillMap.keys()).sort()
    };
  }
};
