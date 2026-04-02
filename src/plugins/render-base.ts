import path from 'node:path';

import type { DesiredEntry } from '../domain/contracts.js';
import type { RenderPlugin } from './interfaces.js';
import { createFileEntry, createSymlinkEntry, renderAgentsContractV2, renderSkillTeamContextV2 } from './render-helpers.js';

function maybeRelativeTarget(projectRoot: string, entryPath: string, targetPath: string, policy: 'relative' | 'absolute'): string {
  if (policy !== 'relative') {
    return targetPath;
  }
  const linkAbsolutePath = path.join(projectRoot, entryPath);
  return path.relative(path.dirname(linkAbsolutePath), targetPath) || '.';
}

export const baseRenderPlugin: RenderPlugin = {
  id: 'base',
  render(context) {
    const entries: DesiredEntry[] = [];

    entries.push(
      createFileEntry('AGENTS.md', renderAgentsContractV2(context.config, context.resolvedProviders), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );

    entries.push(
      createSymlinkEntry('CLAUDE.md', 'AGENTS.md', {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );

    entries.push(
      createFileEntry('.agents/skills/README.md', '# Team Skills\n\nThis directory contains mounted team skills managed by seli v2.\n', {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    entries.push(
      createFileEntry('.agents/skill_team.md', renderSkillTeamContextV2(context.resolvedProviders), {
        layer: 'team',
        owner: 'team-context',
        managed: true
      })
    );

    for (const provider of context.resolvedProviders) {
      for (const skill of provider.selectedSkills) {
        const targetPath = maybeRelativeTarget(
          context.projectRoot,
          `.agents/skills/${skill.skillId}`,
          skill.skillPath,
          context.config.policies.symlink
        );

        entries.push(
          createSymlinkEntry(`.agents/skills/${skill.skillId}`, targetPath, {
            layer: 'team',
            owner: provider.id,
            managed: true
          })
        );
      }
    }

    return entries;
  }
};
