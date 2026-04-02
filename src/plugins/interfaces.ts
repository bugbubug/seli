import type {
  AgentIntakeManifestV2,
  SeliConfigV2,
  CurrentFingerprint,
  DesiredEntry,
  InstallPlanV2,
  ManagedEntryV2,
  ResolvedProviderV2,
  TeamProviderConfigV2
} from '../domain/contracts.js';

export interface ProviderResolutionInput {
  projectRoot: string;
  providerConfig: TeamProviderConfigV2;
}

export interface ProviderPlugin {
  id: string;
  resolveSourceRoot(providerConfig: TeamProviderConfigV2): string | null;
  resolveProvider(input: ProviderResolutionInput): ResolvedProviderV2;
}

export interface TeamSkillSelectionInput {
  providerId: string;
  intake: AgentIntakeManifestV2 | null;
  fallbackSkills: string[];
  resolvedProvider: ResolvedProviderV2;
}

export interface DriftCheckInput {
  projectRoot: string;
  existingManagedEntries: ManagedEntryV2[];
  computeCurrentFingerprint: (entry: Pick<ManagedEntryV2, 'path'>) => CurrentFingerprint | null;
}

export interface DriftCheckOutput {
  drifts: string[];
}

export interface PolicyPlugin {
  id: string;
  kind: 'team-skill-selection' | 'drift-check';
  selectTeamSkills?(input: TeamSkillSelectionInput): string[];
  checkManagedDrift?(input: DriftCheckInput): DriftCheckOutput;
}

export interface RenderContext {
  projectRoot: string;
  config: SeliConfigV2;
  resolvedProviders: ResolvedProviderV2[];
}

export interface RenderPlugin {
  id: string;
  render(context: RenderContext): DesiredEntry[];
}

export interface DoctorCheckContext {
  plan: InstallPlanV2;
  errors: string[];
  warnings: string[];
  info: string[];
}

export interface DoctorCheckPlugin {
  id: string;
  check(context: DoctorCheckContext): void;
}
