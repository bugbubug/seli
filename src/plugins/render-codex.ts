import type { DesiredEntry } from '../domain/contracts.js';
import type { RenderPlugin } from './interfaces.js';
import { readTemplate } from '../infrastructure/catalog.js';
import { createFileEntry, renderProjectSkillV2 } from './render-helpers.js';

export const codexRenderPlugin: RenderPlugin = {
  id: 'codex',
  render(context) {
    if (!context.config.platforms.codex.enabled) {
      return [];
    }

    const entries: DesiredEntry[] = [];
    entries.push(
      createFileEntry('.codex/config.toml', readTemplate('system', 'codex-config.toml.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );

    for (const agentName of context.config.layers.project.extraAgents) {
      if (agentName === 'explorer') {
        entries.push(
          createFileEntry('.codex/agents/explorer.toml', readTemplate('system', 'codex-agent-explorer.toml.tpl'), {
            layer: 'project',
            owner: 'project-agents',
            managed: true
          })
        );
      }
      if (agentName === 'reviewer') {
        entries.push(
          createFileEntry('.codex/agents/reviewer.toml', readTemplate('system', 'codex-agent-reviewer.toml.tpl'), {
            layer: 'project',
            owner: 'project-agents',
            managed: true
          })
        );
      }
    }

    entries.push(
      createFileEntry('.codex/skills/README.md', readTemplate('system', 'codex-skills-readme.md.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );

    for (const skill of context.config.layers.project.skills) {
      if (!skill.managed) {
        continue;
      }
      entries.push(
        createFileEntry(`.codex/skills/${skill.id}/SKILL.md`, renderProjectSkillV2(skill), {
          layer: 'project',
          owner: 'project-skill',
          managed: true
        })
      );
    }

    return entries;
  }
};
