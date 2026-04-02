import path from 'node:path';

import type { DesiredEntry } from '../domain/contracts.js';
import type { RenderPlugin } from './interfaces.js';
import { readTemplate } from '../infrastructure/catalog.js';
import { createFileEntry, createSymlinkEntry } from './render-helpers.js';

function maybeRelativeTarget(projectRoot: string, entryPath: string, targetPath: string, policy: 'relative' | 'absolute'): string {
  if (policy !== 'relative') {
    return targetPath;
  }
  const linkAbsolutePath = path.join(projectRoot, entryPath);
  return path.relative(path.dirname(linkAbsolutePath), targetPath) || '.';
}

export const claudeRenderPlugin: RenderPlugin = {
  id: 'claude',
  render(context) {
    if (!context.config.platforms.claude.enabled) {
      return [];
    }

    const entries: DesiredEntry[] = [];
    entries.push(
      createFileEntry('.claude/README.md', readTemplate('system', 'claude-readme.md.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    entries.push(
      createFileEntry('.claude/rules/README.md', readTemplate('system', 'claude-rules-readme.md.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );
    entries.push(
      createFileEntry('.claude/settings.local.json', readTemplate('system', 'claude-settings.local.json.tpl'), {
        layer: 'system',
        owner: 'system-baseline',
        managed: true
      })
    );

    const projectSkillSourceRoot = path.join(context.projectRoot, '.codex', 'skills');
    entries.push(
      createSymlinkEntry(
        '.claude/skills',
        maybeRelativeTarget(context.projectRoot, '.claude/skills', projectSkillSourceRoot, context.config.policies.symlink),
        {
          layer: 'project',
          owner: 'project-skill',
          managed: true
        }
      )
    );

    return entries;
  }
};
