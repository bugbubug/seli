import fs from 'node:fs';
import path from 'node:path';

import type { DoctorCheckPlugin } from './interfaces.js';

function listProjectSkillIds(projectRoot: string): string[] {
  const root = path.join(projectRoot, '.codex', 'skills');
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter(name => !name.startsWith('.'))
    .filter(name => name !== 'README')
    .filter(name => fs.existsSync(path.join(root, name, 'SKILL.md')))
    .sort();
}

function listTeamSkillIds(projectRoot: string): string[] {
  const root = path.join(projectRoot, '.agents', 'skills');
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter(name => !name.startsWith('.'))
    .filter(name => name !== 'README.md')
    .filter(name => {
      const absolute = path.join(root, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        return true;
      }
      return stat.isDirectory() && fs.existsSync(path.join(absolute, 'SKILL.md'));
    })
    .sort();
}

export const duplicateSkillsDoctorPlugin: DoctorCheckPlugin = {
  id: 'duplicate-skills',
  check(context) {
    const projectSkills = new Set(listProjectSkillIds(context.plan.projectRoot));
    const teamSkills = listTeamSkillIds(context.plan.projectRoot);
    const duplicated = teamSkills.filter(skillId => projectSkills.has(skillId)).sort();

    if (duplicated.length === 0) {
      return;
    }

    context.errors.push(
      `Duplicate skill IDs found in both .codex/skills and .agents/skills: ${duplicated.join(
        ', '
      )}. Remove team-layer directories/symlinks for these project skills and rerun seli update.`
    );
  }
};

