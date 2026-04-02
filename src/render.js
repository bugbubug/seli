const { readTemplate } = require('./catalog');
const { renderTemplate } = require('./utils');

function bulletList(values, formatter = value => `- \`${value}\``) {
  if (!values || values.length === 0) {
    return '- (none)';
  }
  return values.map(formatter).join('\n');
}

function renderAgentsContract(config, resolvedConfig) {
  const teamProviders = resolvedConfig.layers.team.providers.map(provider => {
    const sourceRoot = provider.resolvedSourceRoot || '(unresolved)';
    return `- \`${provider.id}\` -> \`${sourceRoot}\``;
  });

  const teamSkills = [];
  for (const provider of config.layers.team.providers) {
    for (const skill of provider.skills) {
      teamSkills.push(skill);
    }
  }

  const projectSkills = config.layers.project.skills.map(skill => {
    const suffix = skill.managed === false ? ' (detected/external)' : '';
    return `- \`${skill.id}\`${suffix}`;
  });

  const compatPlugin = config.layers.project.compatPlugin.enabled
    ? `- Enabled via \`.agents/plugins/marketplace.json\` and \`plugins/${config.layers.project.compatPlugin.pluginId}/\``
    : '- Disabled';

  return renderTemplate(readTemplate('system', 'AGENTS.md.tpl'), {
    compatPlugin,
    projectSkills: bulletList(projectSkills, value => value),
    teamProviders: bulletList(teamProviders, value => value),
    teamSkills: bulletList(teamSkills)
  });
}

function renderProjectSkill(skill) {
  return renderTemplate(readTemplate('project', 'skill', 'SKILL.md.tpl'), {
    skillDescription: skill.description,
    skillId: skill.id
  });
}

function renderCompatPluginManifest(pluginId) {
  return renderTemplate(readTemplate('compat', 'plugin.json.tpl'), { pluginId });
}

function renderCompatPluginReadme(pluginId) {
  return renderTemplate(readTemplate('compat', 'plugin-readme.md.tpl'), { pluginId });
}

function renderCompatMarketplace(pluginId) {
  return renderTemplate(readTemplate('compat', 'marketplace.json.tpl'), { pluginId });
}

module.exports = {
  renderAgentsContract,
  renderCompatMarketplace,
  renderCompatPluginManifest,
  renderCompatPluginReadme,
  renderProjectSkill
};
