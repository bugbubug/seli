export type InstallCommand = 'plan' | 'init' | 'update' | 'doctor';
export type CliTopLevelCommand = InstallCommand | 'migrate' | 'providers' | 'plugins' | 'inspect' | 'help';
export type CliOutputMode = 'json' | 'explain';
export type RequestedOperation = 'init' | 'update' | 'doctor' | 'auto';
export type MaterializationMode = 'symlink' | 'copy' | string;
export type DriftPolicy = 'error' | 'warn' | 'ignore';
export type SymlinkPolicy = 'relative' | 'absolute';

export interface ProviderRootMap {
  [providerId: string]: string;
}

export interface TeamSkillPackageInputV2 {
  id?: string | undefined;
  label: string;
  rootPath: string;
  priority?: number | undefined;
}

export interface IntakeProviderInputV2 {
  providerId: string;
  rootPath?: string | undefined;
  teamPackages?: TeamSkillPackageInputV2[] | undefined;
  requestedSkills?: string[] | undefined;
  materializationMode?: MaterializationMode | undefined;
}

export type IntakeDocumentKind = 'requirements' | 'architecture' | 'team-skill-index' | 'workflow' | 'misc';
export type IntakeDocumentScope = 'system' | 'team' | 'project';

export interface IntakeDocumentV2 {
  id: string;
  path: string;
  label: string;
  kind: IntakeDocumentKind;
  appliesTo: IntakeDocumentScope;
}

export interface IntakeDecisionV2 {
  id: string;
  summary: string;
  appliesTo?: IntakeDocumentScope | undefined;
  sourcePaths?: string[] | undefined;
}

export interface ProjectSkillBlueprintV2 {
  id: string;
  description: string;
  whenToUse?: string[] | undefined;
  workflow?: string[] | undefined;
  guardrails?: string[] | undefined;
  relatedTeamSkills?: string[] | undefined;
  sourcePaths?: string[] | undefined;
  sourceDocumentLabels?: string[] | undefined;
}

export interface IntakeProjectInputV2 {
  requestedProjectSkills?: string[] | undefined;
  projectSkillBlueprints?: ProjectSkillBlueprintV2[] | undefined;
  extraAgents?: string[] | undefined;
}

export interface IntakeTargetV2 {
  projectPath?: string | undefined;
  requestedOperation?: RequestedOperation | undefined;
  profile?: string | undefined;
}

export interface AgentIntakeManifestV2 {
  schemaVersion: 2;
  target?: IntakeTargetV2 | undefined;
  providers?: IntakeProviderInputV2[] | undefined;
  documents?: IntakeDocumentV2[] | undefined;
  decisions?: IntakeDecisionV2[] | undefined;
  project?: IntakeProjectInputV2 | undefined;
  notes?: string[] | undefined;
}

export interface TeamSkillPackageConfigV2 {
  id: string;
  label: string;
  rootPath: string;
  priority: number;
  materializationMode?: MaterializationMode | undefined;
}

export interface TeamProviderConfigV2 {
  id: string;
  materializationMode: MaterializationMode;
  sourceRoot?: string | undefined;
  packages: TeamSkillPackageConfigV2[];
  skills: string[];
}

export interface ProjectSkillConfigV2 {
  id: string;
  description: string;
  managed: boolean;
  whenToUse?: string[] | undefined;
  workflow?: string[] | undefined;
  guardrails?: string[] | undefined;
  relatedTeamSkills?: string[] | undefined;
  sourcePaths?: string[] | undefined;
  sourceDocumentLabels?: string[] | undefined;
}

export interface CompatPluginConfigV2 {
  enabled: boolean;
  pluginId: string;
}

export interface ProjectLayerConfigV2 {
  skills: ProjectSkillConfigV2[];
  compatPlugin: CompatPluginConfigV2;
  extraAgents: string[];
}

export interface SystemLayerConfigV2 {
  baselineVersion: string;
  modules: string[];
}

export interface TeamLayerConfigV2 {
  providers: TeamProviderConfigV2[];
}

export interface LayerConfigV2 {
  system: SystemLayerConfigV2;
  team: TeamLayerConfigV2;
  project: ProjectLayerConfigV2;
}

export interface PolicyConfigV2 {
  overwriteManagedFiles: boolean;
  drift: DriftPolicy;
  symlink: SymlinkPolicy;
  compat: string;
}

export interface PluginConfigV2 {
  enabled: string[];
}

export interface RegistriesSnapshotV2 {
  commands: string[];
  providers: string[];
  renderers: string[];
  policies: string[];
  doctorChecks: string[];
}

export interface CommandDefaultsV2 {
  output: CliOutputMode;
  force: boolean;
}

export interface SeliConfigV2 {
  version: 2;
  profile: string;
  platforms: {
    codex: { enabled: boolean };
    claude: { enabled: boolean };
  };
  layers: LayerConfigV2;
  policies: PolicyConfigV2;
  plugins: PluginConfigV2;
  registriesSnapshot: RegistriesSnapshotV2;
  commandDefaults: CommandDefaultsV2;
}

export interface ResolvedPackageSkillV2 {
  skillId: string;
  sourcePackageId: string;
  skillPath: string;
  contentFingerprint: string;
  summary: string;
}

export interface ResolvedProviderPackageV2 extends TeamSkillPackageConfigV2 {
  resolvedRoot: string;
  fingerprint: string;
  skills: ResolvedPackageSkillV2[];
  summary: string;
}

export interface ResolvedProviderV2 {
  id: string;
  materializationMode: MaterializationMode;
  sourceRoot?: string | undefined;
  resolvedSourceRoot: string | null;
  packages: ResolvedProviderPackageV2[];
  selectedSkills: ResolvedPackageSkillV2[];
  availableSkillIds: string[];
}

export interface ResolvedSnapshotV2 {
  providers: ResolvedProviderV2[];
}

export interface ManagedFileFingerprintV2 {
  type: 'file';
  sha256: string;
}

export interface ManagedSymlinkFingerprintV2 {
  type: 'symlink';
  symlinkTarget: string;
}

export type ManagedFingerprintV2 = ManagedFileFingerprintV2 | ManagedSymlinkFingerprintV2;

export type ManagedEntryV2 = ManagedFingerprintV2 & {
  path: string;
  layer: string;
  owner: string;
};

export interface DesiredEntryBase {
  type: 'file' | 'symlink';
  path: string;
  layer: string;
  owner: string;
  managed: boolean;
}

export interface DesiredFileEntry extends DesiredEntryBase {
  type: 'file';
  content: string;
}

export interface DesiredSymlinkEntry extends DesiredEntryBase {
  type: 'symlink';
  target: string;
}

export type DesiredEntry = DesiredFileEntry | DesiredSymlinkEntry;

export interface DeleteOperation {
  action: 'delete';
  path: string;
  absolutePath: string;
  previous: ManagedEntryV2;
}

export interface WriteFileOperation {
  action: 'write-file';
  path: string;
  absolutePath: string;
  entry: DesiredFileEntry;
}

export interface WriteSymlinkOperation {
  action: 'write-symlink';
  path: string;
  absolutePath: string;
  entry: DesiredSymlinkEntry;
}

export type InstallPlanOperation = DeleteOperation | WriteFileOperation | WriteSymlinkOperation;

export interface ProviderPackageSnapshotV2 {
  providerId: string;
  packageId: string;
  label: string;
  priority: number;
  resolvedRoot: string;
  fingerprint: string;
  skills: Array<{
    skillId: string;
    sourcePackageId: string;
    contentFingerprint: string;
  }>;
}

export interface PluginResolutionSnapshotV2 {
  providers: string[];
  renderers: string[];
  policies: string[];
  doctorChecks: string[];
}

export interface SeliLockV2 {
  version: 2;
  tool: {
    name: 'seli';
    version: string;
  };
  profile: string;
  pipelineFingerprint: string;
  pluginResolutions: PluginResolutionSnapshotV2;
  providerPackageSnapshots: ProviderPackageSnapshotV2[];
  resolved: {
    providers: Array<{
      id: string;
      resolvedSourceRoot: string | null;
      skills: string[];
      materializationMode: MaterializationMode;
      packages: ProviderPackageSnapshotV2[];
    }>;
  };
  managed: ManagedEntryV2[];
}

export interface InstallPlanSummaryV2 {
  profile: string;
  managedPathCount: number;
  operationCount: number;
  collisions: string[];
  resolvedPackageCount: number;
  selectedSkillSources: Record<string, string>;
  packageDriftWarnings: string[];
  teamLayerCleanupPaths: string[];
}

export interface InstallPlanV2 {
  command: InstallCommand;
  projectRoot: string;
  config: SeliConfigV2;
  desiredEntries: DesiredEntry[];
  managedEntries: DesiredEntry[];
  operations: InstallPlanOperation[];
  lockContent: SeliLockV2;
  existingConfig: boolean;
  existingLock: SeliLockV2 | null;
  summary: InstallPlanSummaryV2;
  intake: AgentIntakeManifestV2 | null;
  resolved: ResolvedSnapshotV2;
}

export interface ExecuteResultV2 {
  operations: InstallPlanOperation[];
  projectRoot: string;
}

export interface DoctorResultV2 {
  ok: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

export interface ProjectCommandOptionsV2 {
  projectRoot: string;
  profileId?: string | undefined;
  intakePath?: string | undefined;
  providerRoots?: ProviderRootMap | undefined;
  force?: boolean | undefined;
  outputMode?: CliOutputMode | undefined;
}

export interface InitOrUpdateResultV2 {
  plan: InstallPlanV2;
  result: ExecuteResultV2;
}

export interface ParsedCliOptionsV2 {
  command: CliTopLevelCommand;
  subcommand?: string | undefined;
  projectRoot: string | null;
  profileId: string;
  intakePath: string | null;
  providerRoots: ProviderRootMap;
  force: boolean;
  outputMode: CliOutputMode;
}

export interface ProviderCatalog {
  id: string;
  description: string;
  materialization: {
    defaultMode: MaterializationMode;
  };
  source: {
    envVar?: string;
    defaultCandidates?: string[];
    skillsSubdir: string;
  };
  supportedPlatforms: string[];
  allowedSkills: string[];
}

export interface TeamSkillPolicyRule {
  skillId: string;
  summary: string;
  keywords: string[];
  documentKinds?: IntakeDocumentKind[] | undefined;
  appliesTo?: IntakeDocumentScope[] | undefined;
}

export interface TeamSkillPolicyCatalog {
  providerId: string;
  fallbackSkills: string[];
  rules: TeamSkillPolicyRule[];
}

export interface ProfileCatalogV2 {
  id: string;
  config: {
    version: number;
    profile: string;
    platforms: {
      codex: { enabled: boolean };
      claude: { enabled: boolean };
    };
    layers: {
      system: {
        baselineVersion: string;
        modules: string[];
      };
      team: {
        providers: Array<{
          id: string;
          materializationMode: MaterializationMode;
          skills: string[];
        }>;
      };
      project: {
        skills: Array<{
          id: string;
          description: string;
          managed: boolean;
        }>;
        compatPlugin: {
          enabled: boolean;
          pluginId: string;
        };
        extraAgents: string[];
      };
    };
    policies: {
      overwriteManagedFiles: boolean;
      drift: DriftPolicy;
      symlink: SymlinkPolicy;
      compat: string;
    };
  };
}

export interface CurrentFingerprintFile {
  type: 'file';
  sha256: string;
}

export interface CurrentFingerprintSymlink {
  type: 'symlink';
  symlinkTarget: string;
}

export interface CurrentFingerprintOther {
  type: 'other';
}

export type CurrentFingerprint = CurrentFingerprintFile | CurrentFingerprintSymlink | CurrentFingerprintOther;

export interface InstallPlanContext {
  command: InstallCommand;
  projectRoot: string;
  profileId: string;
  intakePath?: string | undefined;
  providerRoots: ProviderRootMap;
}

export interface RuntimeContext {
  packageVersion: string;
}
