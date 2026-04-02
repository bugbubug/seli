import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProfileCatalogV2, ProviderCatalog, TeamSkillPolicyCatalog } from '../domain/contracts.js';
import { readJsonFile } from './json.js';

export const managerRoot = fileURLToPath(new URL('../../', import.meta.url));

function catalogPath(...segments: string[]): string {
  return path.join(managerRoot, 'catalog', ...segments);
}

function templatePath(...segments: string[]): string {
  return path.join(managerRoot, 'templates', ...segments);
}

export function readTemplate(...segments: string[]): string {
  return fs.readFileSync(templatePath(...segments), 'utf8');
}

export function loadProfile(profileId: string): ProfileCatalogV2 {
  return readJsonFile<ProfileCatalogV2>(catalogPath('profiles', `${profileId}.json`));
}

export function loadProviderCatalog(providerId: string): ProviderCatalog {
  return readJsonFile<ProviderCatalog>(catalogPath('providers', `${providerId}.json`));
}

export function loadTeamSkillPolicy(providerId: string): TeamSkillPolicyCatalog {
  return readJsonFile<TeamSkillPolicyCatalog>(catalogPath('team-skill-policies', `${providerId}.json`));
}
