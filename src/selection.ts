import fs from 'node:fs';

import { loadTeamSkillPolicy } from './catalog.js';
import type { AgentIntakeManifest, ProjectSkillBlueprint, ProjectSkillConfig, ResolvedTeamSkillPackage, TeamSkillPolicyRule } from './types.js';
import { uniqueStrings } from './utils.js';

function readDocumentSnippet(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.slice(0, 24_000);
  } catch {
    return '';
  }
}

function buildCorpus(intake: AgentIntakeManifest): string {
  const documents = intake.documents ?? [];
  const documentText = documents
    .map(document =>
      [document.label, document.kind, document.appliesTo, readDocumentSnippet(document.path)].filter(Boolean).join('\n')
    )
    .join('\n');
  const decisionText = (intake.agentDecisions ?? []).map(item => item.summary).join('\n');
  const notes = (intake.notes ?? []).join('\n');
  return [documentText, decisionText, notes].join('\n').toLowerCase();
}

function scoreRule(rule: TeamSkillPolicyRule, intake: AgentIntakeManifest, corpus: string): number {
  let score = 0;
  const matchedKeywords = rule.keywords.filter(keyword => corpus.includes(keyword.toLowerCase()));
  score += matchedKeywords.length * 2;

  if (rule.documentKinds && rule.documentKinds.length > 0) {
    const matchingDocuments = (intake.documents ?? []).filter(document => rule.documentKinds?.includes(document.kind));
    if (matchingDocuments.length > 0) {
      score += 1;
    }
  }

  if (rule.appliesTo && rule.appliesTo.length > 0) {
    const matchingScope =
      (intake.documents ?? []).some(document => rule.appliesTo?.includes(document.appliesTo)) ||
      (intake.agentDecisions ?? []).some(decision => decision.appliesTo && rule.appliesTo?.includes(decision.appliesTo));
    if (matchingScope) {
      score += 1;
    }
  }

  return score;
}

function availableSkillSet(packages: ResolvedTeamSkillPackage[] | undefined): Set<string> {
  return new Set((packages ?? []).flatMap(item => item.skills.map(skill => skill.skillId)));
}

export function selectTeamSkills(
  providerId: string,
  intake: AgentIntakeManifest,
  fallbackSkills: string[],
  resolvedPackages: ResolvedTeamSkillPackage[] = []
): string[] {
  const availableSkills = availableSkillSet(resolvedPackages);
  const hasAvailabilityConstraint = availableSkills.size > 0;
  const keepAvailable = (skills: string[]): string[] =>
    uniqueStrings(hasAvailabilityConstraint ? skills.filter(skill => availableSkills.has(skill)) : skills);

  if (intake.requestedTeamSkills) {
    return keepAvailable(intake.requestedTeamSkills);
  }

  let policy;
  try {
    policy = loadTeamSkillPolicy(providerId);
  } catch {
    return keepAvailable(fallbackSkills);
  }
  const corpus = buildCorpus(intake);
  const baseSkills = keepAvailable(fallbackSkills);
  const scoredRules = policy.rules
    .filter(rule => !hasAvailabilityConstraint || availableSkills.has(rule.skillId))
    .map(rule => ({ rule, score: scoreRule(rule, intake, corpus) }))
    .filter(item => item.score >= 2)
    .sort((left, right) => right.score - left.score || left.rule.skillId.localeCompare(right.rule.skillId));

  if (scoredRules.length === 0) {
    const policyFallback = keepAvailable(policy.fallbackSkills.length > 0 ? policy.fallbackSkills : fallbackSkills);
    return uniqueStrings([...baseSkills, ...policyFallback]);
  }

  return uniqueStrings([...baseSkills, ...scoredRules.map(item => item.rule.skillId)]);
}

function createGenericBlueprint(
  skillId: string,
  existingSkill: ProjectSkillConfig | undefined,
  relatedTeamSkills: string[],
  intake: AgentIntakeManifest
): ProjectSkillBlueprint {
  const documents = intake.documents ?? [];
  const sourcePaths = documents.map(document => document.path);
  const sourceDocumentLabels = documents.map(document => document.label);
  const projectDecisions = (intake.agentDecisions ?? [])
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

export function resolveProjectSkillBlueprints(
  intake: AgentIntakeManifest | null,
  existingSkills: ProjectSkillConfig[],
  relatedTeamSkills: string[]
): ProjectSkillBlueprint[] | null {
  if (!intake) {
    return null;
  }

  if (intake.projectSkillBlueprints && intake.projectSkillBlueprints.length > 0) {
    return intake.projectSkillBlueprints.map(blueprint => ({
      ...blueprint,
      guardrails: uniqueStrings(blueprint.guardrails ?? []),
      relatedTeamSkills: uniqueStrings(blueprint.relatedTeamSkills ?? relatedTeamSkills),
      sourceDocumentLabels: uniqueStrings(blueprint.sourceDocumentLabels ?? []),
      sourcePaths: uniqueStrings(blueprint.sourcePaths ?? []).map(item => item),
      whenToUse: uniqueStrings(blueprint.whenToUse ?? []),
      workflow: uniqueStrings(blueprint.workflow ?? [])
    }));
  }

  if (!intake.requestedProjectSkills) {
    return null;
  }

  const existingSkillMap = new Map(existingSkills.map(skill => [skill.id, skill]));
  return intake.requestedProjectSkills.map(skillId =>
    createGenericBlueprint(skillId, existingSkillMap.get(skillId), relatedTeamSkills, intake)
  );
}
