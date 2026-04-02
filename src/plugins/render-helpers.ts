import type {
  SeliConfigV2,
  DesiredEntry,
  ProjectSkillConfigV2,
  ResolvedProviderV2
} from '../domain/contracts.js';
import { readTemplate } from '../infrastructure/catalog.js';
import { renderTemplate } from '../infrastructure/json.js';

const GENERIC_PROJECT_SKILL_DESCRIPTION_PREFIXES = [
  'Detected existing project skill ',
  'Agent-managed project skill ',
  'Project-specific guidance for '
];
const BASELINE_PROJECT_SKILL_IDS = new Set([
  'repo-governance',
  'change-closeout',
  'stack-bootstrap-guide',
  'git-management-guide',
  'team-skill-evolution',
  'team-skill-sync'
]);
const MAX_CONTEXT_ITEMS = 3;
const MAX_RESPONSE_PRINCIPLES = 4;
const MAX_DERIVED_PRINCIPLES = 2;
const MAX_DOCUMENT_LABELS = 3;
const MAX_BULLET_LENGTH = 140;

function bulletList(values: readonly string[]): string {
  if (values.length === 0) {
    return '- (none)';
  }
  return values.join('\n');
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateLine(value: string, maxLength = MAX_BULLET_LENGTH): string {
  const normalized = normalizeLine(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function uniqueValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeLine(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function toBullets(values: readonly string[], maxItems: number): string[] {
  return uniqueValues(values)
    .slice(0, maxItems)
    .map(item => `- ${truncateLine(item)}`);
}

function isGenericProjectSkillDescription(description: string): boolean {
  return GENERIC_PROJECT_SKILL_DESCRIPTION_PREFIXES.some(prefix => description.startsWith(prefix));
}

function prioritizeProjectSkills(config: SeliConfigV2): ProjectSkillConfigV2[] {
  const customSkills = config.layers.project.skills.filter(skill => !BASELINE_PROJECT_SKILL_IDS.has(skill.id));
  const baselineSkills = config.layers.project.skills.filter(skill => BASELINE_PROJECT_SKILL_IDS.has(skill.id));
  return [...customSkills, ...baselineSkills];
}

function renderProjectContext(config: SeliConfigV2): string {
  const prioritizedSkills = prioritizeProjectSkills(config);
  const customSkillDescriptions = uniqueValues(
    prioritizedSkills
      .filter(skill => !BASELINE_PROJECT_SKILL_IDS.has(skill.id))
      .map(skill => skill.description)
      .filter(description => !isGenericProjectSkillDescription(description))
  );
  const baselineSkillDescriptions = uniqueValues(
    prioritizedSkills
      .filter(skill => BASELINE_PROJECT_SKILL_IDS.has(skill.id))
      .map(skill => skill.description)
      .filter(description => !isGenericProjectSkillDescription(description))
  );
  const projectSkillDescriptions = customSkillDescriptions.length > 0 ? customSkillDescriptions : baselineSkillDescriptions;
  const sourceDocumentLabels = uniqueValues(prioritizedSkills.flatMap(skill => skill.sourceDocumentLabels ?? [])).slice(0, MAX_DOCUMENT_LABELS);
  const projectSignals = uniqueValues(prioritizedSkills.flatMap(skill => [...(skill.whenToUse ?? []), ...(skill.workflow ?? [])]));

  const contextCandidates = [...projectSkillDescriptions];
  if (sourceDocumentLabels.length > 0) {
    contextCandidates.push(`Refer to project documents: ${sourceDocumentLabels.join(', ')}.`);
  }
  if (projectSignals.length > 0) {
    contextCandidates.push(`Current delivery focus: ${projectSignals[0]}`);
  }

  const contextLines = toBullets(contextCandidates, MAX_CONTEXT_ITEMS);
  if (contextLines.length === 0) {
    return bulletList(['- Use repository files and configured project skills to determine current product requirements.']);
  }

  return bulletList(contextLines);
}

function renderResponsePrinciples(config: SeliConfigV2): string {
  const prioritizedSkills = prioritizeProjectSkills(config);
  const derivedPrinciples = uniqueValues(
    prioritizedSkills.flatMap(skill => [...(skill.whenToUse ?? []), ...(skill.workflow ?? [])])
  ).slice(0, MAX_DERIVED_PRINCIPLES);

  return bulletList(
    toBullets(
      [
        'Base answers and implementation decisions on files, configs, and runtime state in this repository.',
        'Do not assume this repository is the seli source repository unless repository evidence confirms it.',
        ...derivedPrinciples
      ],
      MAX_RESPONSE_PRINCIPLES
    )
  );
}

export function createFileEntry(pathRelativeToProject: string, content: string, metadata: Omit<Extract<DesiredEntry, { type: 'file' }>, 'content' | 'path' | 'type'>): Extract<DesiredEntry, { type: 'file' }> {
  return {
    type: 'file',
    path: pathRelativeToProject,
    content,
    ...metadata
  };
}

export function createSymlinkEntry(pathRelativeToProject: string, target: string, metadata: Omit<Extract<DesiredEntry, { type: 'symlink' }>, 'path' | 'target' | 'type'>): Extract<DesiredEntry, { type: 'symlink' }> {
  return {
    type: 'symlink',
    path: pathRelativeToProject,
    target,
    ...metadata
  };
}

export function renderAgentsContractV2(config: SeliConfigV2, _resolvedProviders: ResolvedProviderV2[]): string {
  return renderTemplate(readTemplate('system', 'AGENTS.md.tpl'), {
    projectContext: renderProjectContext(config),
    responsePrinciples: renderResponsePrinciples(config)
  });
}

export function renderProjectSkillV2(skill: ProjectSkillConfigV2): string {
  const whenToUse = bulletList(
    skill.whenToUse && skill.whenToUse.length > 0
      ? skill.whenToUse.map(item => `- ${item}`)
      : ['- Use this skill when repository-specific requirements or uploaded project documents apply.']
  );
  const workflow = bulletList(
    skill.workflow && skill.workflow.length > 0
      ? skill.workflow.map(item => `- ${item}`)
      : [
          '- Review the repository contract and source material before making changes.',
          '- Apply project-specific rules before falling back to the team layer.'
        ]
  );
  const sourceMaterialValues: string[] = [];
  if (skill.sourceDocumentLabels && skill.sourceDocumentLabels.length > 0) {
    sourceMaterialValues.push(...skill.sourceDocumentLabels.map(label => `- Document: ${label}`));
  }
  if (skill.sourcePaths && skill.sourcePaths.length > 0) {
    sourceMaterialValues.push(...skill.sourcePaths.map(sourcePath => `- Path: ${sourcePath}`));
  }
  const relatedTeamSkills = bulletList(
    skill.relatedTeamSkills && skill.relatedTeamSkills.length > 0
      ? skill.relatedTeamSkills.map(item => `- \`${item}\``)
      : ['- (none)']
  );
  const projectGuardrails = bulletList(
    skill.guardrails && skill.guardrails.length > 0 ? skill.guardrails.map(item => `- ${item}`) : ['- (none)']
  );

  return renderTemplate(readTemplate('project', 'skill', 'SKILL.md.tpl'), {
    projectGuardrails,
    relatedTeamSkills,
    skillDescription: skill.description,
    skillId: skill.id,
    sourceMaterial: bulletList(sourceMaterialValues),
    whenToUse,
    workflow
  });
}

export function renderSkillTeamContextV2(resolvedProviders: ResolvedProviderV2[]): string {
  const packageLines = resolvedProviders.flatMap(provider =>
    provider.packages.map(pkg => `- \`${provider.id}/${pkg.label}\` -> \`${pkg.resolvedRoot}\``)
  );
  const skillLines = resolvedProviders.flatMap(provider =>
    provider.packages.flatMap(pkg =>
      pkg.skills.map(skill => `- \`${skill.skillId}\` (\`${provider.id}/${pkg.label}\`): ${skill.summary}`)
    )
  );

  return [
    '# Skill Team Context',
    '',
    '## system_prompt',
    '',
    '本项目由 Seli 初始化，请参考本地技能包进行代码生成。',
    '',
    '## Team Packages',
    '',
    packageLines.length > 0 ? packageLines.join('\n') : '- (none)',
    '',
    '## Scanned Skills',
    '',
    skillLines.length > 0 ? skillLines.join('\n') : '- (none)',
    ''
  ].join('\n');
}
