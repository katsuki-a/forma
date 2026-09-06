import type { Application } from "../contracts/model.ts";
import type { Repository } from "../domain/repository.ts";

export function memoryRepository(): Repository {
  const apps = new Map<string, Application>();
  return {
    list() {
      return Promise.resolve(structuredClone([...apps.values()]));
    },
    get(id) {
      return Promise.resolve(structuredClone(apps.get(id) ?? null));
    },
    compareAndSwap(app, expected) {
      const current = apps.get(app.id);
      if (expected === null ? !!current : current?.revision !== expected)
        return Promise.resolve(false);
      apps.set(app.id, structuredClone(app));
      return Promise.resolve(true);
    },
  };
}
