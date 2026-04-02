import type { ProviderPlugin } from '../plugins/interfaces.js';

export class ProviderRegistry {
  private readonly plugins = new Map<string, ProviderPlugin>();

  register(plugin: ProviderPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Provider plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  get(id: string): ProviderPlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new Error(`Unknown provider plugin: ${id}`);
    }
    return plugin;
  }

  list(): string[] {
    return Array.from(this.plugins.keys()).sort();
  }
}
