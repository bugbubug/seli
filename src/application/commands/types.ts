import type { ParsedCliOptionsV2 } from '../../domain/contracts.js';
import type { RuntimeEnvironment } from '../runtime.js';

export interface CommandExecutionContext {
  args: ParsedCliOptionsV2;
  env: RuntimeEnvironment;
}

export interface CommandModule {
  id: string;
  description: string;
  run(context: CommandExecutionContext): unknown;
}
