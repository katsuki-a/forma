import type { D1Database } from "@cloudflare/workers-types";
import { announcementSchema } from "../contracts/model.ts";
import type { Repository } from "../domain/repository.ts";

export function d1Announcements(
  database: D1Database,
): Pick<
  Repository,
  | "listAnnouncements"
  | "getAnnouncement"
  | "compareAndSwapAnnouncement"
  | "deleteAnnouncement"
> {
  const select =
    "SELECT id, revision, title, body, created_at AS createdAt, updated_at AS updatedAt FROM announcements";
  return {
    async listAnnouncements() {
      const { results } = await database
        .prepare(`${select} ORDER BY rowid`)
        .all();
      return results.map((row) => announcementSchema.parse(row));
    },
    async getAnnouncement(id) {
      const row = await database
        .prepare(`${select} WHERE id = ?`)
        .bind(id)
        .first();
      return row ? announcementSchema.parse(row) : null;
    },
    async compareAndSwapAnnouncement(item, expected) {
      const statement =
        expected === null
          ? database
              .prepare(
                "INSERT INTO announcements (id, revision, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
              )
              .bind(
                item.id,
                item.revision,
                item.title,
                item.body,
                item.createdAt,
                item.updatedAt,
              )
          : database
              .prepare(
                "UPDATE announcements SET revision = ?, title = ?, body = ?, updated_at = ? WHERE id = ? AND revision = ?",
              )
              .bind(
                item.revision,
                item.title,
                item.body,
                item.updatedAt,
                item.id,
                expected,
              );
      return (await statement.run()).meta.changes === 1;
    },
    async deleteAnnouncement(id, revision) {
      return (
        (
          await database
            .prepare("DELETE FROM announcements WHERE id = ? AND revision = ?")
            .bind(id, revision)
            .run()
        ).meta.changes === 1
      );
    },
  };
}
