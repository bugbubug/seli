import type { RenderPlugin } from '../plugins/interfaces.js';

export class RendererRegistry {
  private readonly plugins = new Map<string, RenderPlugin>();

  register(plugin: RenderPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Render plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  list(): string[] {
    return Array.from(this.plugins.keys()).sort();
  }

  all(): RenderPlugin[] {
    return this.list().map(id => this.plugins.get(id) as RenderPlugin);
  }
}
