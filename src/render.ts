import { readTemplate } from './catalog.js';
import type { AiToolInitConfig, ProjectSkillConfig, ResolvedAiToolInitConfig } from './types.js';
import { renderTemplate } from './utils.js';

function bulletList(values: readonly string[]): string {
  if (values.length === 0) {
    return '- (none)';
  }
  return values.join('\n');
}

export function renderAgentsContract(config: AiToolInitConfig, resolvedConfig: ResolvedAiToolInitConfig): string {
  const teamProviders = resolvedConfig.layers.team.providers.map(provider => {
    return `- \`${provider.id}\` -> \`${provider.resolvedSourceRoot || '(unresolved)'}\` (${provider.packages.length} package(s))`;
  });
  const teamPackages = resolvedConfig.layers.team.providers.flatMap(provider =>
    provider.packages.map(pkg => `- \`${provider.id}/${pkg.label}\` -> \`${pkg.resolvedRoot}\``)
  );

  const teamSkills = config.layers.team.providers.flatMap(provider => provider.skills.map(skill => `- \`${skill}\``));
  const selectedSkillSources = resolvedConfig.layers.team.providers.flatMap(provider =>
    provider.selectedSkills.map(skill => `- \`${skill.skillId}\` from \`${provider.id}/${skill.sourcePackageId}\``)
  );
  const projectSkills = config.layers.project.skills.map((skill: ProjectSkillConfig) => {
    const suffix = skill.managed === false ? ' (detected/external)' : '';
    return `- \`${skill.id}\`${suffix}`;
  });

  const compatPlugin = config.layers.project.compatPlugin.enabled
    ? `- Enabled via \`.agents/plugins/marketplace.json\` and \`plugins/${config.layers.project.compatPlugin.pluginId}/\``
    : '- Disabled';

  return renderTemplate(readTemplate('system', 'AGENTS.md.tpl'), {
    compatPlugin,
    projectSkills: bulletList(projectSkills),
    selectedSkillSources: bulletList(selectedSkillSources),
    teamPackages: bulletList(teamPackages),
    teamProviders: bulletList(teamProviders),
    teamSkills: bulletList(teamSkills)
  });
}

export function renderProjectSkill(skill: ProjectSkillConfig): string {
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

export function renderCompatPluginManifest(pluginId: string): string {
  return renderTemplate(readTemplate('compat', 'plugin.json.tpl'), { pluginId });
}

export function renderCompatPluginReadme(pluginId: string): string {
  return renderTemplate(readTemplate('compat', 'plugin-readme.md.tpl'), { pluginId });
}

export function renderCompatMarketplace(pluginId: string): string {
  return renderTemplate(readTemplate('compat', 'marketplace.json.tpl'), { pluginId });
}
