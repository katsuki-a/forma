import type { D1Database } from "@cloudflare/workers-types";
import type { Application } from "../contracts/model.ts";
import { appSchema, valuesSchema } from "../contracts/model.ts";
import type { Repository } from "../domain/repository.ts";

// 単一SELECTのスナップショットで定義と記録を読み、異なるリビジョンの混在を防ぐ。
const selectApplications = `
  SELECT a.id, a.revision, a.next_number, a.draft_json, a.published_json,
    r.id AS record_id, r.number, r.values_json,
    r.created_at, r.updated_at, r.created_by, r.updated_by
  FROM applications AS a
  LEFT JOIN records AS r ON r.app_id = a.id`;

type ApplicationRow = {
  id: string;
  revision: number;
  next_number: number;
  draft_json: string;
  published_json: string | null;
  record_id: string | null;
  number: number | null;
  values_json: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

function assemble(rows: ApplicationRow[]): Application[] {
  const apps = new Map<string, Application>();
  for (const row of rows) {
    let app = apps.get(row.id);
    if (!app) {
      app = appSchema.parse({
        id: row.id,
        revision: row.revision,
        nextNumber: row.next_number,
        draft: JSON.parse(row.draft_json) as unknown,
        published:
          row.published_json === null
            ? null
            : (JSON.parse(row.published_json) as unknown),
        records: [],
      });
      apps.set(row.id, app);
    }
    if (row.record_id !== null) {
      app.records.push({
        id: row.record_id,
        number: row.number as number,
        values: valuesSchema.parse(JSON.parse(row.values_json as string)),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        createdBy: row.created_by as string,
        updatedBy: row.updated_by as string,
      });
    }
  }
  return [...apps.values()].map((app) => appSchema.parse(app));
}

export function d1Repository(database: D1Database): Repository {
  return {
    async list() {
      const { results } = await database
        .prepare(`${selectApplications} ORDER BY a.rowid, r.number`)
        .all<ApplicationRow>();
      return assemble(results);
    },
    async get(id) {
      const { results } = await database
        .prepare(`${selectApplications} WHERE a.id = ? ORDER BY r.number`)
        .bind(id)
        .all<ApplicationRow>();
      return assemble(results)[0] ?? null;
    },
    async compareAndSwap(candidate, expected) {
      const app = appSchema.parse(candidate);
      // CAS成功時だけ同じbatch内の記録変更を許可する。一意なtokenにより
      // 古いrevisionや新規作成の競合でも、後続のDELETE/UPSERTは何も変更しない。
      const token = crypto.randomUUID();
      const draft = JSON.stringify(app.draft);
      const published =
        app.published === null ? null : JSON.stringify(app.published);
      const records = JSON.stringify(app.records);
      const statement =
        expected === null
          ? database
              .prepare(
                `
            INSERT INTO applications (id, revision, next_number, draft_json, published_json, write_token)
            VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
          `,
              )
              .bind(
                app.id,
                app.revision,
                app.nextNumber,
                draft,
                published,
                token,
              )
          : database
              .prepare(
                `
            UPDATE applications SET revision = ?, next_number = ?, draft_json = ?, published_json = ?, write_token = ?
            WHERE id = ? AND revision = ?
          `,
              )
              .bind(
                app.revision,
                app.nextNumber,
                draft,
                published,
                token,
                app.id,
                expected,
              );
      // D1 batchは全体をトランザクションとして実行する。記録の制約違反時は
      // 定義・採番・revisionもロールバックされる。変更のない記録は更新しない。
      const [result] = await database.batch([
        statement,
        database
          .prepare(
            `
          DELETE FROM records WHERE app_id = ?
            AND EXISTS (SELECT 1 FROM applications WHERE id = ? AND write_token = ?)
            AND id NOT IN (SELECT json_extract(value, '$.id') FROM json_each(?))
        `,
          )
          .bind(app.id, app.id, token, records),
        database
          .prepare(
            `
          INSERT INTO records (app_id, id, number, values_json, created_at, updated_at, created_by, updated_by)
          SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.number'),
            json_extract(value, '$.values'), json_extract(value, '$.createdAt'),
            json_extract(value, '$.updatedAt'), json_extract(value, '$.createdBy'), json_extract(value, '$.updatedBy')
          FROM json_each(?)
          WHERE EXISTS (SELECT 1 FROM applications WHERE id = ? AND write_token = ?)
          ON CONFLICT(app_id, id) DO UPDATE SET
            number = excluded.number, values_json = excluded.values_json,
            created_at = excluded.created_at, updated_at = excluded.updated_at,
            created_by = excluded.created_by, updated_by = excluded.updated_by
          WHERE records.number IS NOT excluded.number OR records.values_json IS NOT excluded.values_json
            OR records.created_at IS NOT excluded.created_at OR records.updated_at IS NOT excluded.updated_at
            OR records.created_by IS NOT excluded.created_by OR records.updated_by IS NOT excluded.updated_by
        `,
          )
          .bind(app.id, records, app.id, token),
      ]);
      return result.meta.changes === 1;
    },
  };
}
