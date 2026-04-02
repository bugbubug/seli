import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProfileCatalog, ProviderCatalog, SystemCatalog, TeamSkillPolicyCatalog } from './types.js';
import { readJson } from './utils.js';

export const managerRoot = fileURLToPath(new URL('../', import.meta.url));

function catalogPath(...segments: string[]): string {
  return path.join(managerRoot, 'catalog', ...segments);
}

function templatePath(...segments: string[]): string {
  return path.join(managerRoot, 'templates', ...segments);
}

export function readTemplate(...segments: string[]): string {
  return fs.readFileSync(templatePath(...segments), 'utf8');
}

export function loadProfile(profileId: string): ProfileCatalog {
  return readJson<ProfileCatalog>(catalogPath('profiles', `${profileId}.json`));
}

export function loadProvider(providerId: string): ProviderCatalog {
  return readJson<ProviderCatalog>(catalogPath('providers', `${providerId}.json`));
}

export function loadSystem(systemId: string): SystemCatalog {
  return readJson<SystemCatalog>(catalogPath('system', `${systemId}.json`));
}

export function loadTeamSkillPolicy(providerId: string): TeamSkillPolicyCatalog {
  return readJson<TeamSkillPolicyCatalog>(catalogPath('team-skill-policies', `${providerId}.json`));
}
