import type { TeamSkillPolicyRule } from '../domain/contracts.js';
import type { PolicyPlugin } from './interfaces.js';
import { loadTeamSkillPolicy } from '../infrastructure/catalog.js';
import { uniqueStrings } from '../infrastructure/fs.js';

function buildCorpus(input: Parameters<NonNullable<PolicyPlugin['selectTeamSkills']>>[0]): string {
  const documentText = (input.intake?.documents ?? [])
    .map(document => [document.label, document.kind, document.appliesTo].filter(Boolean).join('\n'))
    .join('\n');
  const decisionText = (input.intake?.decisions ?? []).map(item => item.summary).join('\n');
  const notes = (input.intake?.notes ?? []).join('\n');
  return [documentText, decisionText, notes].join('\n').toLowerCase();
}

function scoreRule(rule: TeamSkillPolicyRule, corpus: string, input: Parameters<NonNullable<PolicyPlugin['selectTeamSkills']>>[0]): number {
  let score = 0;

  const matchedKeywords = rule.keywords.filter(keyword => corpus.includes(keyword.toLowerCase()));
  score += matchedKeywords.length * 2;

  if (rule.documentKinds && rule.documentKinds.length > 0) {
    const matchingDocuments = (input.intake?.documents ?? []).filter(document => rule.documentKinds?.includes(document.kind));
    if (matchingDocuments.length > 0) {
      score += 1;
    }
  }

  if (rule.appliesTo && rule.appliesTo.length > 0) {
    const matchingScope =
      (input.intake?.documents ?? []).some(document => rule.appliesTo?.includes(document.appliesTo)) ||
      (input.intake?.decisions ?? []).some(decision => decision.appliesTo && rule.appliesTo?.includes(decision.appliesTo));
    if (matchingScope) {
      score += 1;
    }
  }

  return score;
}

export const teamSkillSelectionPolicyPlugin: PolicyPlugin = {
  id: 'team-skill-selection',
  kind: 'team-skill-selection',
  selectTeamSkills(input) {
    const available = new Set(input.resolvedProvider.availableSkillIds);
    const hasAvailabilityConstraint = available.size > 0;

    const keepAvailable = (skills: string[]): string[] =>
      uniqueStrings(hasAvailabilityConstraint ? skills.filter(skill => available.has(skill)) : skills);

    const explicit = input.intake?.providers?.find(provider => provider.providerId === input.providerId)?.requestedSkills;
    if (explicit && explicit.length > 0) {
      return keepAvailable(explicit);
    }

    let policy;
    try {
      policy = loadTeamSkillPolicy(input.providerId);
    } catch {
      return keepAvailable(input.fallbackSkills);
    }

    const corpus = buildCorpus(input);
    const baseSkills = keepAvailable(input.fallbackSkills);
    const scoredRules = policy.rules
      .filter(rule => !hasAvailabilityConstraint || available.has(rule.skillId))
      .map(rule => ({ rule, score: scoreRule(rule, corpus, input) }))
      .filter(item => item.score >= 2)
      .sort((left, right) => right.score - left.score || left.rule.skillId.localeCompare(right.rule.skillId));

    if (scoredRules.length === 0) {
      const policyFallback = keepAvailable(policy.fallbackSkills.length > 0 ? policy.fallbackSkills : input.fallbackSkills);
      return uniqueStrings([...baseSkills, ...policyFallback]);
    }

    return uniqueStrings([...baseSkills, ...scoredRules.map(item => item.rule.skillId)]);
  }
};
