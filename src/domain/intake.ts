import path from 'node:path';

import type {
  AgentIntakeManifestV2,
  IntakeDecisionV2,
  IntakeDocumentV2,
  IntakeProviderInputV2,
  RequestedOperation
} from './contracts.js';
import { readJsonFile } from '../infrastructure/json.js';
import { uniqueStrings } from '../infrastructure/fs.js';

function normalizeDocument(document: IntakeDocumentV2, baseDir: string, index: number): IntakeDocumentV2 {
  return {
    id: document.id || `doc-${index + 1}`,
    path: path.resolve(baseDir, document.path),
    label: document.label,
    kind: document.kind,
    appliesTo: document.appliesTo
  };
}

function normalizeDecision(decision: IntakeDecisionV2, baseDir: string, index: number): IntakeDecisionV2 {
  return {
    id: decision.id || `decision-${index + 1}`,
    summary: decision.summary,
    appliesTo: decision.appliesTo,
    sourcePaths: uniqueStrings(decision.sourcePaths).map(item => path.resolve(baseDir, item))
  };
}

function normalizeProviders(providers: IntakeProviderInputV2[] | undefined, baseDir: string): IntakeProviderInputV2[] {
  return (providers ?? []).map(provider => ({
    providerId: provider.providerId,
    materializationMode: provider.materializationMode,
    rootPath: provider.rootPath ? path.resolve(baseDir, provider.rootPath) : undefined,
    requestedSkills: uniqueStrings(provider.requestedSkills),
    teamPackages: (provider.teamPackages ?? []).map((item, index) => ({
      id: item.id || `${provider.providerId}-pkg-${index + 1}`,
      label: item.label,
      rootPath: path.resolve(baseDir, item.rootPath),
      priority: item.priority
    }))
  }));
}

export function normalizeIntakeV2(input: AgentIntakeManifestV2, baseDir: string): AgentIntakeManifestV2 {
  return {
    schemaVersion: 2,
    target: {
      projectPath: input.target?.projectPath ? path.resolve(baseDir, input.target.projectPath) : undefined,
      requestedOperation: input.target?.requestedOperation,
      profile: input.target?.profile
    },
    providers: normalizeProviders(input.providers, baseDir),
    documents: (input.documents ?? []).map((document, index) => normalizeDocument(document, baseDir, index)),
    decisions: (input.decisions ?? []).map((decision, index) => normalizeDecision(decision, baseDir, index)),
    project: {
      requestedProjectSkills: uniqueStrings(input.project?.requestedProjectSkills),
      projectSkillBlueprints: (input.project?.projectSkillBlueprints ?? []).map(item => ({
        ...item,
        guardrails: uniqueStrings(item.guardrails),
        relatedTeamSkills: uniqueStrings(item.relatedTeamSkills),
        sourceDocumentLabels: uniqueStrings(item.sourceDocumentLabels),
        sourcePaths: uniqueStrings(item.sourcePaths).map(sourcePath => path.resolve(baseDir, sourcePath)),
        whenToUse: uniqueStrings(item.whenToUse),
        workflow: uniqueStrings(item.workflow)
      })),
      extraAgents: uniqueStrings(input.project?.extraAgents)
    },
    notes: uniqueStrings(input.notes)
  };
}

export function loadAndNormalizeIntake(intakePath: string): AgentIntakeManifestV2 {
  const absolutePath = path.resolve(intakePath);
  const raw = readJsonFile<Record<string, unknown>>(absolutePath);
  const baseDir = path.dirname(absolutePath);

  if (raw.schemaVersion === 2) {
    return normalizeIntakeV2(raw as unknown as AgentIntakeManifestV2, baseDir);
  }
  if (raw.version === 1) {
    throw new Error(`Legacy intake manifest is no longer supported at ${absolutePath}. Use schemaVersion=2.`);
  }

  throw new Error(`Unsupported intake manifest schema at ${absolutePath}`);
}

export function resolveRequestedOperation(command: 'plan' | 'init' | 'update' | 'doctor', requestedOperation: RequestedOperation | undefined, hasExistingConfig: boolean, hasLegacyState: boolean): 'plan' | 'init' | 'update' | 'doctor' {
  if ((command !== 'init' && command !== 'update') || !requestedOperation) {
    return command;
  }

  if (requestedOperation === 'auto') {
    return hasExistingConfig || hasLegacyState ? 'update' : 'init';
  }

  if (requestedOperation === 'init' || requestedOperation === 'update' || requestedOperation === 'doctor') {
    return requestedOperation === 'doctor' ? command : requestedOperation;
  }

  return command;
}
