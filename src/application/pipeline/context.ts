import type {
  AgentIntakeManifestV2,
  SeliConfigV2,
  SeliLockV2,
  DesiredEntry,
  InstallCommand,
  InstallPlanContext,
  ResolvedSnapshotV2
} from '../../domain/contracts.js';
import type { LegacyStateDetection } from '../../domain/project-state.js';

export interface PipelineContext extends InstallPlanContext {
  runtimeVersion: string;
  intake: AgentIntakeManifestV2 | null;
  detectedLegacy: LegacyStateDetection;
  effectiveCommand: InstallCommand;
  existingConfig: SeliConfigV2 | null;
  existingLock: SeliLockV2 | null;
  config: SeliConfigV2;
  resolved: ResolvedSnapshotV2;
  desiredEntries: DesiredEntry[];
  lockContent: SeliLockV2;
}
