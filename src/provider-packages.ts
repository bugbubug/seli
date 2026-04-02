import fs from 'node:fs';
import path from 'node:path';

import { loadProvider } from './catalog.js';
import type {
  MaterializationMode,
  ResolvedPackageSkill,
  ResolvedProviderConfig,
  ResolvedProviderSelectedSkill,
  ResolvedTeamSkillPackage,
  TeamProviderConfig,
  TeamSkillPackageConfig,
  TeamSkillPackageInput
} from './types.js';
import { sha256, uniqueStrings } from './utils.js';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'package';
}

function summarizeSkill(content: string): string {
  const normalized = content
    .replace(/^---[\s\S]*?---\s*/m, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');
  return normalized.slice(0, 160);
}

function resolvePackageRoot(rootPath: string, skillsSubdir: string): string {
  const absoluteRoot = path.resolve(rootPath);
  if (path.basename(absoluteRoot) === skillsSubdir && fs.existsSync(absoluteRoot)) {
    return path.dirname(absoluteRoot);
  }
  return absoluteRoot;
}

export function createPackageId(providerId: string, rootPath: string, label?: string): string {
  const stem = slugify(label || path.basename(rootPath) || providerId);
  return `${providerId}-${stem}-${sha256(path.resolve(rootPath)).slice(0, 8)}`;
}

export function createTeamSkillPackageConfig(
  providerId: string,
  rootPath: string,
  {
    label,
    priority = 0,
    materializationMode
  }: { label?: string | undefined; priority?: number | undefined; materializationMode?: MaterializationMode | undefined } = {}
): TeamSkillPackageConfig {
  const normalizedRoot = path.resolve(rootPath);
  return {
    id: createPackageId(providerId, normalizedRoot, label),
    label: label || path.basename(normalizedRoot) || providerId,
    materializationMode,
    priority,
    rootPath: normalizedRoot
  };
}

export function normalizeTeamPackageInput(input: TeamSkillPackageInput, baseDir: string): TeamSkillPackageInput {
  return {
    ...input,
    label: input.label,
    priority: input.priority,
    rootPath: path.resolve(baseDir, input.rootPath)
  };
}

export function mergeProviderPackages(
  providerId: string,
  currentPackages: TeamSkillPackageConfig[] | undefined,
  teamPackages: TeamSkillPackageInput[] | undefined,
  sourceRoot: string | undefined,
  providerRootOverride: string | undefined,
  materializationMode: MaterializationMode
): TeamSkillPackageConfig[] {
  const selectedFromIntake = (teamPackages ?? [])
    .filter(item => item.providerId === providerId)
    .map(item =>
      createTeamSkillPackageConfig(providerId, item.rootPath, {
        label: item.label,
        materializationMode,
        priority: item.priority
      })
    );

  if (selectedFromIntake.length > 0) {
    return selectedFromIntake.sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  }

  if (providerRootOverride) {
    return [
      createTeamSkillPackageConfig(providerId, providerRootOverride, {
        label: path.basename(providerRootOverride),
        materializationMode,
        priority: 0
      })
    ];
  }

  if (currentPackages && currentPackages.length > 0) {
    return currentPackages
      .map(item => ({
        ...item,
        id: item.id || createPackageId(providerId, item.rootPath, item.label),
        materializationMode: item.materializationMode || materializationMode,
        priority: item.priority ?? 0,
        rootPath: path.resolve(item.rootPath)
      }))
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  }

  if (sourceRoot) {
    return [
      createTeamSkillPackageConfig(providerId, sourceRoot, {
        label: path.basename(sourceRoot),
        materializationMode,
        priority: 0
      })
    ];
  }

  return [];
}

export function resolveProviderPackages(provider: TeamProviderConfig): ResolvedTeamSkillPackage[] {
  const providerCatalog = loadProvider(provider.id);
  const rawPackages =
    provider.packages && provider.packages.length > 0
      ? provider.packages
      : provider.sourceRoot
        ? [
            createTeamSkillPackageConfig(provider.id, provider.sourceRoot, {
              label: path.basename(provider.sourceRoot),
              materializationMode: provider.materializationMode,
              priority: 0
            })
          ]
        : [];

  return rawPackages
    .map(item => {
      const resolvedRoot = resolvePackageRoot(item.rootPath, providerCatalog.source.skillsSubdir);
      const skillsRoot = path.join(resolvedRoot, providerCatalog.source.skillsSubdir);
      const skillIds = fs.existsSync(skillsRoot)
        ? fs
            .readdirSync(skillsRoot)
            .filter(name => !name.startsWith('.'))
            .filter(name => fs.existsSync(path.join(skillsRoot, name, 'SKILL.md')))
            .sort()
        : [];
      const skills: ResolvedPackageSkill[] = skillIds.map(skillId => {
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
              contentFingerprint: skill.contentFingerprint,
              skillId: skill.skillId
            }))
          )
        ),
        materializationMode: item.materializationMode || provider.materializationMode,
        resolvedRoot,
        skills,
        summary: skills.map(skill => `${skill.skillId}: ${skill.summary}`).join('\n').slice(0, 400)
      };
    })
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}

export function buildResolvedProvider(provider: TeamProviderConfig): ResolvedProviderConfig {
  const packages = resolveProviderPackages(provider);
  const selectedSkillIds = uniqueStrings(provider.skills);
  const availableSkills = new Map<string, ResolvedProviderSelectedSkill>();

  for (const pkg of packages) {
    for (const skill of pkg.skills) {
      if (!availableSkills.has(skill.skillId)) {
        availableSkills.set(skill.skillId, skill);
      }
    }
  }

  return {
    ...provider,
    availableSkillIds: Array.from(availableSkills.keys()).sort(),
    packages,
    resolvedSourceRoot: packages[0]?.resolvedRoot ?? null,
    selectedSkills: selectedSkillIds.map(skillId => availableSkills.get(skillId)).filter(Boolean) as ResolvedProviderSelectedSkill[]
  };
}

