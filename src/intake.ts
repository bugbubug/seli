import path from 'node:path';

import { detectLegacyState, loadExistingConfig } from './config.js';
import { mergeProviderPackages, normalizeTeamPackageInput, resolveProviderPackages } from './provider-packages.js';
import { resolveProjectSkillBlueprints, selectTeamSkills } from './selection.js';
import type {
  AgentIntakeDocument,
  AgentIntakeManifest,
  AgentDecisionRecord,
  SeliConfig,
  EffectiveRunContext,
  InstallCommand,
  ProjectSkillConfig,
  ProviderRootMap,
  RequestedOperation
} from './types.js';
import { deepClone, readJson, uniqueStrings } from './utils.js';

export const DEFAULT_INTAKE_RELATIVE_PATH = 'intake/manifest.json';

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function normalizeDocument(document: AgentIntakeDocument, baseDir: string): AgentIntakeDocument {
  return {
    path: path.resolve(baseDir, document.path),
    label: document.label,
    kind: document.kind,
    appliesTo: document.appliesTo
  };
}

function normalizeDecision(decision: AgentDecisionRecord, baseDir: string): AgentDecisionRecord {
  const normalized: AgentDecisionRecord = {
    summary: decision.summary
  };
  if (decision.appliesTo) {
    normalized.appliesTo = decision.appliesTo;
  }
  if (decision.sourcePaths) {
    normalized.sourcePaths = uniqueStrings(decision.sourcePaths).map(item => path.resolve(baseDir, item));
  }
  return normalized;
}

export function loadAgentIntake(intakePath: string): AgentIntakeManifest {
  const absolutePath = path.resolve(intakePath);
  return normalizeAgentIntake(readJson<AgentIntakeManifest>(absolutePath), path.dirname(absolutePath));
}

export function normalizeAgentIntake(input: AgentIntakeManifest, baseDir = process.cwd()): AgentIntakeManifest {
  const normalized: AgentIntakeManifest = {
    version: 1
  };

  if (input.targetProjectPath) {
    normalized.targetProjectPath = path.resolve(baseDir, input.targetProjectPath);
  }
  if (input.requestedOperation) {
    normalized.requestedOperation = input.requestedOperation;
  }
  if (input.profile) {
    normalized.profile = input.profile;
  }
  if (input.providerRoots) {
    normalized.providerRoots = Object.fromEntries(
      Object.entries(input.providerRoots)
        .filter(([, value]) => Boolean(value))
        .map(([providerId, providerRoot]) => [providerId, path.resolve(baseDir, providerRoot)])
    );
  }
  if (hasOwn(input, 'teamPackages')) {
    normalized.teamPackages = (input.teamPackages ?? []).map(item => normalizeTeamPackageInput(item, baseDir));
  }
  if (hasOwn(input, 'documents')) {
    normalized.documents = (input.documents ?? []).map(document => normalizeDocument(document, baseDir));
  }
  if (hasOwn(input, 'requestedTeamSkills')) {
    normalized.requestedTeamSkills = uniqueStrings(input.requestedTeamSkills ?? []);
  }
  if (hasOwn(input, 'requestedProjectSkills')) {
    normalized.requestedProjectSkills = uniqueStrings(input.requestedProjectSkills ?? []);
  }
  if (hasOwn(input, 'projectSkillBlueprints')) {
    normalized.projectSkillBlueprints = (input.projectSkillBlueprints ?? []).map(blueprint => ({
      ...blueprint,
      guardrails: uniqueStrings(blueprint.guardrails ?? []),
      relatedTeamSkills: uniqueStrings(blueprint.relatedTeamSkills ?? []),
      sourceDocumentLabels: uniqueStrings(blueprint.sourceDocumentLabels ?? []),
      sourcePaths: uniqueStrings(blueprint.sourcePaths ?? []).map(item => path.resolve(baseDir, item)),
      whenToUse: uniqueStrings(blueprint.whenToUse ?? []),
      workflow: uniqueStrings(blueprint.workflow ?? [])
    }));
  }
  if (hasOwn(input, 'extraAgents')) {
    normalized.extraAgents = uniqueStrings(input.extraAgents ?? []);
  }
  if (hasOwn(input, 'compatPlugin')) {
    normalized.compatPlugin = Boolean(input.compatPlugin);
  }
  if (hasOwn(input, 'agentDecisions')) {
    normalized.agentDecisions = (input.agentDecisions ?? []).map(decision => normalizeDecision(decision, baseDir));
  }
  if (hasOwn(input, 'notes')) {
    normalized.notes = uniqueStrings(input.notes ?? []);
  }

  return normalized;
}

function createManagedProjectSkill(skillId: string, existingSkill?: ProjectSkillConfig): ProjectSkillConfig {
  return {
    id: skillId,
    description: existingSkill?.description ?? `Agent-managed project skill ${skillId}.`,
    managed: true
  };
}

export function applyAgentInputsToConfig(
  baseConfig: SeliConfig,
  intake: AgentIntakeManifest | null,
  providerRoots: ProviderRootMap = {}
): SeliConfig {
  const config = deepClone(baseConfig);

  if (intake?.profile) {
    config.profile = intake.profile;
  }

  const resolvedProviderRoots = {
    ...(intake?.providerRoots ?? {}),
    ...providerRoots
  };

  const selectedTeamSkillsByProvider = new Map<string, string[]>();
  config.layers.team.providers = config.layers.team.providers.map(provider => {
    const normalizedProvider = {
      ...provider,
      skills: [...provider.skills]
    };

    normalizedProvider.packages = mergeProviderPackages(
      provider.id,
      provider.packages,
      intake?.teamPackages,
      provider.sourceRoot,
      resolvedProviderRoots[provider.id],
      provider.materializationMode
    );
    normalizedProvider.sourceRoot = normalizedProvider.packages[0]?.rootPath;

    if (intake) {
      const resolvedPackages = resolveProviderPackages(normalizedProvider);
      normalizedProvider.skills = selectTeamSkills(provider.id, intake, provider.skills, resolvedPackages);
    }
    selectedTeamSkillsByProvider.set(provider.id, normalizedProvider.skills);

    return normalizedProvider;
  });

  const selectedTeamSkills = Array.from(selectedTeamSkillsByProvider.values()).flat();
  const resolvedBlueprints = resolveProjectSkillBlueprints(intake, config.layers.project.skills, selectedTeamSkills);
  if (resolvedBlueprints) {
    const existingSkillMap = new Map(config.layers.project.skills.map(skill => [skill.id, skill]));
    const unmanagedSkills = config.layers.project.skills.filter(skill => skill.managed === false);
    const managedSkills = resolvedBlueprints.map(blueprint => ({
      ...createManagedProjectSkill(blueprint.id, existingSkillMap.get(blueprint.id)),
      description: blueprint.description,
      guardrails: blueprint.guardrails,
      relatedTeamSkills: blueprint.relatedTeamSkills,
      sourceDocumentLabels: blueprint.sourceDocumentLabels,
      sourcePaths: blueprint.sourcePaths,
      whenToUse: blueprint.whenToUse,
      workflow: blueprint.workflow
    }));
    config.layers.project.skills = [...managedSkills, ...unmanagedSkills];
  }

  if (intake && hasOwn(intake, 'extraAgents')) {
    config.layers.project.extraAgents = uniqueStrings(intake.extraAgents ?? []);
  }

  if (intake && hasOwn(intake, 'compatPlugin')) {
    config.layers.project.compatPlugin.enabled = Boolean(intake.compatPlugin);
  }

  return config;
}

function detectOperationFromProject(projectRoot: string): Extract<InstallCommand, 'init' | 'update'> {
  if (loadExistingConfig(projectRoot)) {
    return 'update';
  }

  return detectLegacyState(projectRoot).hasAnyLegacyState ? 'update' : 'init';
}

export function resolveRequestedOperation(
  command: InstallCommand,
  projectRoot: string,
  intake: AgentIntakeManifest | null
): InstallCommand {
  if ((command !== 'init' && command !== 'update') || !intake?.requestedOperation) {
    return command;
  }

  if (intake.requestedOperation === 'auto') {
    return detectOperationFromProject(projectRoot);
  }

  return command;
}

export function createEffectiveRunContext({
  config,
  detected,
  existingConfig,
  existingLock,
  intake,
  projectRoot
}: Omit<EffectiveRunContext, 'requestedOperation'>): EffectiveRunContext {
  return {
    config,
    detected,
    existingConfig,
    existingLock,
    intake,
    projectRoot,
    requestedOperation: intake?.requestedOperation ?? null
  };
}

export function resolveBootstrapProfileId(profileId: string | undefined, intake: AgentIntakeManifest | null): string {
  return intake?.profile ?? profileId ?? 'default';
}

export function parseProviderRootArgument(value: string): [string, string] {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error(`Invalid --provider-root value: ${value}. Expected <provider>=<abs-path>.`);
  }

  const providerId = value.slice(0, separatorIndex);
  const providerRoot = value.slice(separatorIndex + 1);
  return [providerId, path.resolve(providerRoot)];
}

export function readIntakeIfPresent(intakePath?: string | null): AgentIntakeManifest | null {
  if (!intakePath) {
    return null;
  }
  return loadAgentIntake(path.resolve(intakePath));
}
