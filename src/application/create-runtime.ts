import { readJsonFile } from '../infrastructure/json.js';
import { createDefaultCommandRegistry } from './command-runtime.js';
import type { RuntimeEnvironment } from './runtime.js';
import { createDefaultDoctorRegistry, createDefaultPolicyRegistry, createDefaultProviderRegistry, createDefaultRendererRegistry } from '../registry/create-default-registries.js';
import { fileURLToPath } from 'node:url';

interface PackageMetadata {
  version: string;
}

export function createRuntimeEnvironment(): RuntimeEnvironment {
  const providerRegistry = createDefaultProviderRegistry();
  const rendererRegistry = createDefaultRendererRegistry();
  const policyRegistry = createDefaultPolicyRegistry();
  const doctorRegistry = createDefaultDoctorRegistry();
  const commandRegistry = createDefaultCommandRegistry();
  const packageJson = readJsonFile<PackageMetadata>(fileURLToPath(new URL('../../package.json', import.meta.url)));

  return {
    commandRegistry,
    providerRegistry,
    rendererRegistry,
    policyRegistry,
    doctorRegistry,
    packageVersion: packageJson.version
  };
}
