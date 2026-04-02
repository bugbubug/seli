import type { PolicyPlugin } from '../plugins/interfaces.js';

export class PolicyRegistry {
  private readonly plugins = new Map<string, PolicyPlugin>();

  register(plugin: PolicyPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Policy plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  getByKind(kind: PolicyPlugin['kind']): PolicyPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.kind === kind);
  }

  list(): string[] {
    return Array.from(this.plugins.keys()).sort();
  }
}
