import type { Application } from '../contracts/model.ts';
import type { Repository } from '../domain/repository.ts';

export function memoryRepository(): Repository {
  const apps = new Map<string, Application>();
  return {
    async list() { return structuredClone([...apps.values()]); },
    async get(id) { return structuredClone(apps.get(id) ?? null); },
    async compareAndSwap(app, expected) {
      const current = apps.get(app.id);
      if (expected === null ? !!current : current?.revision !== expected) return false;
      apps.set(app.id, structuredClone(app));
      return true;
    },
  };
}
