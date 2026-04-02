import type { DoctorCheckPlugin } from '../plugins/interfaces.js';

export class DoctorRegistry {
  private readonly plugins = new Map<string, DoctorCheckPlugin>();

  register(plugin: DoctorCheckPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Doctor check plugin already registered: ${plugin.id}`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  list(): string[] {
    return Array.from(this.plugins.keys()).sort();
  }

  all(): DoctorCheckPlugin[] {
    return this.list().map(id => this.plugins.get(id) as DoctorCheckPlugin);
  }
}
