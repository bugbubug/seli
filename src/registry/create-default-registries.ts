import { DoctorRegistry } from './doctor-registry.js';
import { PolicyRegistry } from './policy-registry.js';
import { ProviderRegistry } from './provider-registry.js';
import { RendererRegistry } from './renderer-registry.js';
import { eccProviderPlugin } from '../plugins/provider-ecc.js';
import { baseRenderPlugin } from '../plugins/render-base.js';
import { codexRenderPlugin } from '../plugins/render-codex.js';
import { claudeRenderPlugin } from '../plugins/render-claude.js';
import { driftCheckPolicyPlugin } from '../plugins/policy-drift.js';
import { teamSkillSelectionPolicyPlugin } from '../plugins/policy-team-skill.js';
import { managedStateDoctorPlugin } from '../plugins/doctor-managed-state.js';
import { providerStateDoctorPlugin } from '../plugins/doctor-provider-state.js';
import { claudeEntrypointDoctorPlugin } from '../plugins/doctor-claude-entrypoint.js';
import { duplicateSkillsDoctorPlugin } from '../plugins/doctor-duplicate-skills.js';

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(eccProviderPlugin);
  return registry;
}

export function createDefaultRendererRegistry(): RendererRegistry {
  const registry = new RendererRegistry();
  registry.register(baseRenderPlugin);
  registry.register(codexRenderPlugin);
  registry.register(claudeRenderPlugin);
  return registry;
}

export function createDefaultPolicyRegistry(): PolicyRegistry {
  const registry = new PolicyRegistry();
  registry.register(teamSkillSelectionPolicyPlugin);
  registry.register(driftCheckPolicyPlugin);
  return registry;
}

export function createDefaultDoctorRegistry(): DoctorRegistry {
  const registry = new DoctorRegistry();
  registry.register(managedStateDoctorPlugin);
  registry.register(providerStateDoctorPlugin);
  registry.register(claudeEntrypointDoctorPlugin);
  registry.register(duplicateSkillsDoctorPlugin);
  return registry;
}
