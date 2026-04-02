export type InstallCommand = 'plan' | 'init' | 'update' | 'doctor';
export type DriftPolicy = 'error' | 'warn' | 'ignore';
export type SymlinkPolicy = 'relative' | 'absolute';
export type CompatPolicy = 'minimal' | 'disabled' | 'full' | string;
export type MaterializationMode = 'symlink' | 'copy' | string;
export type RequestedOperation = 'init' | 'update' | 'doctor' | 'auto';
export type AgentDocumentKind = 'requirements' | 'architecture' | 'team-skill-index' | 'workflow' | 'misc';
export type AgentDocumentScope = 'system' | 'team' | 'project';

export type ProviderRootMap = Record<string, string>;

export interface TeamSkillPackageInput {
  providerId: string;
  rootPath: string;
  label: string;
  priority?: number | undefined;
}

export interface TeamSkillPackageConfig {
  id: string;
  rootPath: string;
  label: string;
  priority: number;
  materializationMode?: MaterializationMode | undefined;
}

export interface PlatformToggle {
  enabled: boolean;
}

export interface SystemLayerConfig {
  baselineVersion: string;
  modules: string[];
}

export interface TeamProviderConfig {
  id: string;
  materializationMode: MaterializationMode;
  skills: string[];
  packages?: TeamSkillPackageConfig[] | undefined;
  sourceRoot?: string | undefined;
}

export interface ResolvedPackageSkill {
  skillId: string;
  sourcePackageId: string;
  skillPath: string;
  contentFingerprint: string;
  summary: string;
}

export interface ResolvedTeamSkillPackage extends TeamSkillPackageConfig {
  resolvedRoot: string;
  fingerprint: string;
  skills: ResolvedPackageSkill[];
  summary: string;
}

export interface ResolvedProviderSelectedSkill extends ResolvedPackageSkill {}

export interface ResolvedProviderConfig extends TeamProviderConfig {
  resolvedSourceRoot: string | null;
  packages: ResolvedTeamSkillPackage[];
  selectedSkills: ResolvedProviderSelectedSkill[];
  availableSkillIds: string[];
}

export interface ProjectSkillBlueprint {
  id: string;
  description: string;
  whenToUse?: string[] | undefined;
  workflow?: string[] | undefined;
  guardrails?: string[] | undefined;
  relatedTeamSkills?: string[] | undefined;
  sourcePaths?: string[] | undefined;
  sourceDocumentLabels?: string[] | undefined;
}

export interface AgentIntakeDocument {
  path: string;
  label: string;
  kind: AgentDocumentKind;
  appliesTo: AgentDocumentScope;
}

export interface AgentDecisionRecord {
  summary: string;
  appliesTo?: AgentDocumentScope | undefined;
  sourcePaths?: string[] | undefined;
}

export interface AgentIntakeManifest {
  version: 1;
  targetProjectPath?: string | undefined;
  requestedOperation?: RequestedOperation | undefined;
  profile?: string | undefined;
  providerRoots?: ProviderRootMap | undefined;
  teamPackages?: TeamSkillPackageInput[] | undefined;
  documents?: AgentIntakeDocument[] | undefined;
  requestedTeamSkills?: string[] | undefined;
  requestedProjectSkills?: string[] | undefined;
  projectSkillBlueprints?: ProjectSkillBlueprint[] | undefined;
  extraAgents?: string[] | undefined;
  compatPlugin?: boolean | undefined;
  agentDecisions?: AgentDecisionRecord[] | undefined;
  notes?: string[] | undefined;
}

export interface ProjectSkillConfig {
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

export interface CompatPluginConfig {
  enabled: boolean;
  pluginId: string;
}

export interface ProjectLayerConfig {
  skills: ProjectSkillConfig[];
  compatPlugin: CompatPluginConfig;
  extraAgents: string[];
}

export interface TeamLayerConfig {
  providers: TeamProviderConfig[];
}

export interface LayerConfig {
  system: SystemLayerConfig;
  team: TeamLayerConfig;
  project: ProjectLayerConfig;
}

export interface PolicyConfig {
  overwriteManagedFiles: boolean;
  drift: DriftPolicy;
  symlink: SymlinkPolicy;
  compat: CompatPolicy;
}

export interface SeliConfig {
  version: 1;
  profile: string;
  platforms: {
    codex: PlatformToggle;
    claude: PlatformToggle;
  };
  layers: LayerConfig;
  policies: PolicyConfig;
}

export interface ResolvedSeliConfig extends Omit<SeliConfig, 'layers'> {
  layers: Omit<LayerConfig, 'team'> & {
    team: {
      providers: ResolvedProviderConfig[];
    };
  };
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
  documentKinds?: AgentDocumentKind[] | undefined;
  appliesTo?: AgentDocumentScope[] | undefined;
}

export interface TeamSkillPolicyCatalog {
  providerId: string;
  fallbackSkills: string[];
  rules: TeamSkillPolicyRule[];
}

export interface ProfileCatalog {
  id: string;
  config: SeliConfig;
}

export interface SystemCatalog {
  id: string;
  description: string;
  modules: string[];
}

export interface DetectedLegacyState {
  builtInSkills: string[];
  compatEnabled: boolean;
  detectedSourceRoot: string | null;
  extraAgents: string[];
  hasAnyLegacyState: boolean;
  legacyLocalSkills: string[];
  teamSkills: string[];
}

export interface LockToolMetadata {
  name: 'seli';
  version: string;
}

export interface ResolvedProviderLock {
  id: string;
  resolvedSourceRoot: string | null;
  skills: string[];
  materializationMode: MaterializationMode;
  packages: {
    id: string;
    label: string;
    priority: number;
    resolvedRoot: string;
    fingerprint: string;
    skills: {
      skillId: string;
      sourcePackageId: string;
      contentFingerprint: string;
    }[];
  }[];
}

export interface ManagedFileFingerprint {
  type: 'file';
  sha256: string;
}

export interface ManagedSymlinkFingerprint {
  type: 'symlink';
  symlinkTarget: string;
}

export type ManagedFingerprint = ManagedFileFingerprint | ManagedSymlinkFingerprint;

export type ManagedEntry = {
  layer: string;
  owner: string;
  path: string;
} & ManagedFingerprint;

export interface SeliLock {
  version: 1;
  tool: LockToolMetadata;
  profile: string;
  resolved: {
    providers: ResolvedProviderLock[];
  };
  managed: ManagedEntry[];
}

export interface DesiredEntryBase {
  layer: string;
  managed: boolean;
  owner: string;
  path: string;
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

export interface CurrentOtherFingerprint {
  type: 'other';
}

export type CurrentFingerprint = ManagedFingerprint | CurrentOtherFingerprint;

export interface DeleteOperation {
  action: 'delete';
  path: string;
  absolutePath: string;
  previous: ManagedEntry;
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

export interface InstallPlanSummary {
  collisions: string[];
  managedPathCount: number;
  operationCount: number;
  profile: string;
  resolvedPackageCount: number;
  selectedSkillSources: Record<string, string>;
  packageDriftWarnings: string[];
}

export interface InstallPlan {
  command: InstallCommand;
  config: SeliConfig;
  desiredEntries: DesiredEntry[];
  detected: DetectedLegacyState | null;
  existingConfig: boolean;
  existingLock: SeliLock | null;
  lockContent: SeliLock;
  managedEntries: DesiredEntry[];
  operations: InstallPlanOperation[];
  projectRoot: string;
  summary: InstallPlanSummary;
}

export interface ExecuteResult {
  operations: InstallPlanOperation[];
  projectRoot: string;
}

export interface ProjectCommandOptions {
  projectRoot: string;
  profileId?: string | undefined;
  force?: boolean | undefined;
  json?: boolean | undefined;
  intakePath?: string | undefined;
  providerRoots?: ProviderRootMap | undefined;
}

export interface CliOptions {
  command: InstallCommand | 'help' | null;
  force: boolean;
  intakePath: string | null;
  json: boolean;
  providerRoots: ProviderRootMap;
  profileId: string;
  projectRoot: string | null;
}

export interface DoctorError {
  message: string;
  path?: string | undefined;
}

export interface DoctorResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

export interface PackageMetadata {
  version: string;
}

export interface InitOrUpdateResult {
  plan: InstallPlan;
  result: ExecuteResult;
}

export interface EffectiveRunContext {
  config: SeliConfig;
  detected: DetectedLegacyState | null;
  existingConfig: SeliConfig | null;
  existingLock: SeliLock | null;
  intake: AgentIntakeManifest | null;
  projectRoot: string;
  requestedOperation: RequestedOperation | null;
}
