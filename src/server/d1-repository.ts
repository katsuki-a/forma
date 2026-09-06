import type { D1Database } from "@cloudflare/workers-types";
import { appSchema } from "../contracts/model.ts";
import type { Repository } from "../domain/repository.ts";

export function d1Repository(database: D1Database): Repository {
  return {
    async list() {
      const { results } = await database
        .prepare("SELECT data FROM applications ORDER BY rowid")
        .all<{ data: string }>();
      return results.map((row) => appSchema.parse(JSON.parse(row.data)));
    },
    async get(id) {
      const row = await database
        .prepare("SELECT data FROM applications WHERE id = ?")
        .bind(id)
        .first<{ data: string }>();
      return row ? appSchema.parse(JSON.parse(row.data)) : null;
    },
    async compareAndSwap(app, expected) {
      const statement =
        expected === null
          ? database
              .prepare(
                "INSERT INTO applications (id, revision, data) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING",
              )
              .bind(app.id, app.revision, JSON.stringify(app))
          : database
              .prepare(
                "UPDATE applications SET revision = ?, data = ? WHERE id = ? AND revision = ?",
              )
              .bind(app.revision, JSON.stringify(app), app.id, expected);
      return (await statement.run()).meta.changes === 1;
    },
  };
}
