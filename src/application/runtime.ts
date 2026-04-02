import type { CommandRegistry } from './commands/registry.js';
import type { DoctorRegistry } from '../registry/doctor-registry.js';
import type { PolicyRegistry } from '../registry/policy-registry.js';
import type { ProviderRegistry } from '../registry/provider-registry.js';
import type { RendererRegistry } from '../registry/renderer-registry.js';

export interface RuntimeEnvironment {
  commandRegistry: CommandRegistry;
  providerRegistry: ProviderRegistry;
  rendererRegistry: RendererRegistry;
  policyRegistry: PolicyRegistry;
  doctorRegistry: DoctorRegistry;
  packageVersion: string;
}
