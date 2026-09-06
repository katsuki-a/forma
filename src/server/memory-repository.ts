import type { Application, Announcement } from "../contracts/model.ts";
import type { Repository } from "../domain/repository.ts";

export function memoryRepository(): Repository {
  const apps = new Map<string, Application>();
  const announcements = new Map<string, Announcement>();
  return {
    listAnnouncements: () =>
      Promise.resolve(structuredClone([...announcements.values()])),
    getAnnouncement: (id) =>
      Promise.resolve(structuredClone(announcements.get(id) ?? null)),
    compareAndSwapAnnouncement(announcement, expected) {
      const current = announcements.get(announcement.id);
      if (expected === null ? !!current : current?.revision !== expected)
        return Promise.resolve(false);
      announcements.set(announcement.id, structuredClone(announcement));
      return Promise.resolve(true);
    },
    deleteAnnouncement(id, expected) {
      if (announcements.get(id)?.revision !== expected)
        return Promise.resolve(false);
      return Promise.resolve(announcements.delete(id));
    },
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
