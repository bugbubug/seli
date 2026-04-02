import path from 'node:path';

import type {
  AgentIntakeManifestV2,
  SeliConfigV2,
  ProjectSkillBlueprintV2,
  ProjectSkillConfigV2,
  ResolvedProviderV2
} from './contracts.js';
import type { PolicyRegistry } from '../registry/policy-registry.js';
import type { ProviderRegistry } from '../registry/provider-registry.js';
import { deepClone } from '../infrastructure/json.js';
import { uniqueStrings } from '../infrastructure/fs.js';
import { normalizeConfigV2 } from './defaults.js';

function createManagedProjectSkill(skillId: string, existingSkill?: ProjectSkillConfigV2): ProjectSkillConfigV2 {
  return {
    id: skillId,
    description: existingSkill?.description ?? `Agent-managed project skill ${skillId}.`,
    managed: true
  };
}

function createGenericBlueprint(
  skillId: string,
  existingSkill: ProjectSkillConfigV2 | undefined,
  relatedTeamSkills: string[],
  intake: AgentIntakeManifestV2
): ProjectSkillBlueprintV2 {
  const documents = intake.documents ?? [];
  const sourcePaths = documents.map(document => document.path);
  const sourceDocumentLabels = documents.map(document => document.label);
  const projectDecisions = (intake.decisions ?? [])
    .filter(decision => !decision.appliesTo || decision.appliesTo === 'project')
    .map(decision => decision.summary);

  return {
    id: skillId,
    description: existingSkill?.description ?? `Project-specific guidance for ${skillId}.`,
    whenToUse:
      projectDecisions.length > 0
        ? projectDecisions.slice(0, 3)
        : ['Use this skill when repository-specific delivery rules must override the team layer.'],
    workflow:
      projectDecisions.length > 0
        ? projectDecisions
        : ['Review the current repository truth before implementing changes.'],
    guardrails: [
      'Prefer repository-specific guidance over team defaults when they conflict.',
      'Keep repository truth in AGENTS.md and .selirc.'
    ],
    relatedTeamSkills,
    sourcePaths,
    sourceDocumentLabels
  };
}

function resolveBlueprints(
  intake: AgentIntakeManifestV2 | null,
  existingSkills: ProjectSkillConfigV2[],
  relatedTeamSkills: string[]
): ProjectSkillBlueprintV2[] | null {
  if (!intake) {
    return null;
  }

  if (intake.project?.projectSkillBlueprints && intake.project.projectSkillBlueprints.length > 0) {
    return intake.project.projectSkillBlueprints.map(blueprint => ({
      ...blueprint,
      guardrails: uniqueStrings(blueprint.guardrails),
      relatedTeamSkills: uniqueStrings(blueprint.relatedTeamSkills ?? relatedTeamSkills),
      sourceDocumentLabels: uniqueStrings(blueprint.sourceDocumentLabels),
      sourcePaths: uniqueStrings(blueprint.sourcePaths),
      whenToUse: uniqueStrings(blueprint.whenToUse),
      workflow: uniqueStrings(blueprint.workflow)
    }));
  }

  if (!intake.project?.requestedProjectSkills) {
    return null;
  }

  const existingSkillMap = new Map(existingSkills.map(skill => [skill.id, skill]));
  return intake.project.requestedProjectSkills.map(skillId =>
    createGenericBlueprint(skillId, existingSkillMap.get(skillId), relatedTeamSkills, intake)
  );
}

function applyBlueprints(config: SeliConfigV2, blueprints: ProjectSkillBlueprintV2[]): void {
  const existingSkillMap = new Map(config.layers.project.skills.map(skill => [skill.id, skill]));
  const unmanagedSkills = config.layers.project.skills.filter(skill => skill.managed === false);

  const managedSkills = blueprints.map(blueprint => ({
    ...createManagedProjectSkill(blueprint.id, existingSkillMap.get(blueprint.id)),
    description: blueprint.description,
    guardrails: uniqueStrings(blueprint.guardrails),
    relatedTeamSkills: uniqueStrings(blueprint.relatedTeamSkills),
    sourceDocumentLabels: uniqueStrings(blueprint.sourceDocumentLabels),
    sourcePaths: uniqueStrings(blueprint.sourcePaths),
    whenToUse: uniqueStrings(blueprint.whenToUse),
    workflow: uniqueStrings(blueprint.workflow)
  }));

  config.layers.project.skills = [...managedSkills, ...unmanagedSkills];
}

function normalizeProviderPackages(
  providerId: string,
  materializationMode: string,
  rootPath: string,
  label: string,
  priority = 0
): SeliConfigV2['layers']['team']['providers'][number]['packages'][number] {
  const normalizedRoot = path.resolve(rootPath);
  return {
    id: `${providerId}-${priority}-${path.basename(normalizedRoot)}`,
    label,
    rootPath: normalizedRoot,
    priority,
    materializationMode
  };
}

export function applyIntakeAndPolicy(
  baseConfig: SeliConfigV2,
  intake: AgentIntakeManifestV2 | null,
  providerRoots: Record<string, string>,
  providerRegistry: ProviderRegistry,
  policyRegistry: PolicyRegistry
): { config: SeliConfigV2; resolvedProviders: ResolvedProviderV2[] } {
  const config = deepClone(baseConfig);

  if (intake?.target?.profile) {
    config.profile = intake.target.profile;
  }

  config.layers.team.providers = config.layers.team.providers.map(provider => {
    const intakeProvider = intake?.providers?.find(item => item.providerId === provider.id);
    const providerRootOverride = providerRoots[provider.id] || intakeProvider?.rootPath;

    const nextProvider = {
      ...provider,
      materializationMode: intakeProvider?.materializationMode || provider.materializationMode,
      skills: [...provider.skills],
      packages: [...provider.packages]
    };

    if (intakeProvider?.teamPackages && intakeProvider.teamPackages.length > 0) {
      nextProvider.packages = intakeProvider.teamPackages.map((pkg, index) => ({
        id: pkg.id || `${provider.id}-pkg-${index + 1}`,
        label: pkg.label,
        rootPath: path.resolve(pkg.rootPath),
        priority: pkg.priority ?? index,
        materializationMode: intakeProvider.materializationMode || provider.materializationMode
      }));
      nextProvider.sourceRoot = nextProvider.packages[0]?.rootPath;
    } else if (providerRootOverride) {
      nextProvider.packages = [
        normalizeProviderPackages(
          provider.id,
          nextProvider.materializationMode,
          providerRootOverride,
          path.basename(providerRootOverride),
          0
        )
      ];
      nextProvider.sourceRoot = path.resolve(providerRootOverride);
    } else if (nextProvider.packages.length === 0 && nextProvider.sourceRoot) {
      nextProvider.packages = [
        normalizeProviderPackages(
          provider.id,
          nextProvider.materializationMode,
          nextProvider.sourceRoot,
          path.basename(nextProvider.sourceRoot),
          0
        )
      ];
    }

    return nextProvider;
  });

  const selectionPolicies = policyRegistry.getByKind('team-skill-selection').filter(item => item.selectTeamSkills);
  const resolvedProviders = config.layers.team.providers.map(provider => {
    const plugin = providerRegistry.get(provider.id);
    const resolved = plugin.resolveProvider({
      projectRoot: process.cwd(),
      providerConfig: provider
    });

    const fallback = provider.skills;
    let selected = fallback;

    for (const policy of selectionPolicies) {
      selected = policy.selectTeamSkills!({
        providerId: provider.id,
        fallbackSkills: selected,
        intake,
        resolvedProvider: resolved
      });
    }

    provider.skills = uniqueStrings(selected);

    const selectedSet = new Set(provider.skills);
    resolved.selectedSkills = resolved.availableSkillIds
      .filter(skillId => selectedSet.has(skillId))
      .map(skillId => {
        for (const pkg of resolved.packages) {
          const found = pkg.skills.find(skill => skill.skillId === skillId);
          if (found) {
            return found;
          }
        }
        return null;
      })
      .filter(Boolean) as ResolvedProviderV2['selectedSkills'];

    return resolved;
  });

  const selectedTeamSkills = resolvedProviders.flatMap(provider => provider.selectedSkills.map(skill => skill.skillId));
  const blueprints = resolveBlueprints(intake, config.layers.project.skills, selectedTeamSkills);
  if (blueprints) {
    applyBlueprints(config, blueprints);
  }

  if (intake?.project?.extraAgents) {
    config.layers.project.extraAgents = uniqueStrings(intake.project.extraAgents);
  }

  return {
    config: normalizeConfigV2(config),
    resolvedProviders
  };
}
