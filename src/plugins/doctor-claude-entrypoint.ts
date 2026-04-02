import path from 'node:path';

import type { DoctorCheckPlugin } from './interfaces.js';
import { readSymlinkIfExists } from '../infrastructure/fs.js';

export const claudeEntrypointDoctorPlugin: DoctorCheckPlugin = {
  id: 'claude-entrypoint',
  check(context) {
    if (!context.plan.config.platforms.claude.enabled) {
      return;
    }

    const expectedTarget = path.relative(path.join(context.plan.projectRoot, '.claude'), path.join(context.plan.projectRoot, '.codex', 'skills')) || '.';
    const currentTarget = readSymlinkIfExists(path.join(context.plan.projectRoot, '.claude', 'skills'));
    if (currentTarget !== expectedTarget) {
      context.errors.push(`Claude skill entrypoint mismatch: .claude/skills -> ${currentTarget || '(missing)'}`);
    }
  }
};
