import type { CommandModule } from './types.js';

export class CommandRegistry {
  private readonly modules = new Map<string, CommandModule>();

  register(module: CommandModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Command already registered: ${module.id}`);
    }
    this.modules.set(module.id, module);
  }

  get(id: string): CommandModule {
    const module = this.modules.get(id);
    if (!module) {
      throw new Error(`Unknown command module: ${id}`);
    }
    return module;
  }

  list(): string[] {
    return Array.from(this.modules.keys()).sort();
  }
}
