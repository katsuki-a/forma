import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, expect, test } from "vitest";
import { templates } from "../../src/contracts/model.ts";
import { createService } from "../../src/domain/service.ts";
import { d1Repository } from "../../src/server/d1-repository.ts";

let runtime: Miniflare;
let database: D1Database;
const context = {
  id: () => crypto.randomUUID(),
  now: () => "2026-09-06T00:00:00Z",
  actor: "test-user",
};
const service = () => createService(d1Repository(database), context);

beforeEach(async () => {
  runtime = new Miniflare({
    cf: false,
    workers: [
      {
        config: {
          name: "schema-test",
          type: "worker",
          compatibilityDate: "2026-09-06",
          manifest: {
            mainModule: "worker.js",
            modules: {
              "worker.js": {
                type: "esm",
                contents:
                  'export default {fetch() {return new Response("ok")}}',
              },
            },
          },
          env: { DB: { type: "d1", id: "schema-db" } },
        },
      },
    ],
  });
  database = await runtime.getD1Database("DB");
  const statements = readFileSync(
    new URL("../../db/schema.sql", import.meta.url),
    "utf8",
  )
    .split(";")
    .map((sql) => sql.trim())
    .filter(Boolean);
  await database.batch(statements.map((sql) => database.prepare(sql)));
});
afterEach(async () => {
  await runtime?.dispose();
});

test("FRM-042 記録の番号・所属・JSON構造をDB制約で守る", async () => {
  let app = await service().create(templates[0]);
  app = await service().publish(app.id, app.revision);
  app = await service().saveRecord(app.id, app.revision, {
    title: "制約の確認",
  });
  const insert = (appId: string, number: number, values: string) =>
    database
      .prepare(
        "INSERT INTO records (app_id, id, number, values_json, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        appId,
        crypto.randomUUID(),
        number,
        values,
        context.now(),
        context.now(),
        context.actor,
        context.actor,
      )
      .run();
  await expect(insert(app.id, 1, "{}")).rejects.toThrow();
  await expect(insert("missing-app", 2, "{}")).rejects.toThrow();
  await expect(insert(app.id, 0, "{}")).rejects.toThrow();
  await expect(insert(app.id, 1.5, "{}")).rejects.toThrow();
  await expect(insert(app.id, 2, "[]")).rejects.toThrow();
  await expect(insert(app.id, 2, "invalid")).rejects.toThrow();
  expect(await d1Repository(database).get(app.id)).toEqual(app);
  const columns = await database
    .prepare("PRAGMA table_info(applications)")
    .all<{ name: string }>();
  expect(columns.results.map((column) => column.name)).not.toContain("data");
});

test.each(["追加", "上書き", "削除"] as const)(
  "FRM-042 CASに敗れた操作で記録を%sしない",
  async (operation) => {
    const repository = d1Repository(database);
    let app = await service().create(templates[0]);
    app = await service().publish(app.id, app.revision);
    app = await service().saveRecord(app.id, app.revision, { title: "元の値" });
    const stale = structuredClone(app);
    app = await service().saveRecord(
      app.id,
      app.revision,
      { title: "勝った値" },
      app.records[0].id,
    );
    stale.revision++;
    if (operation === "削除") stale.records = [];
    else if (operation === "上書き")
      stale.records[0].values = { title: "保存してはいけない値" };
    else
      stale.records.push({
        ...stale.records[0],
        id: context.id(),
        number: stale.nextNumber++,
      });
    expect(await repository.compareAndSwap(stale, stale.revision - 1)).toBe(
      false,
    );
    expect(await repository.compareAndSwap(stale, null)).toBe(false);
    expect(await repository.get(app.id)).toEqual(app);
  },
);

test("FRM-042 記録の制約違反で定義とリビジョンもロールバックする", async () => {
  let app = await service().create(templates[0]);
  app = await service().publish(app.id, app.revision);
  app = await service().saveRecord(app.id, app.revision, { title: "残す値" });
  const invalid = structuredClone(app);
  invalid.revision++;
  invalid.draft.name = "保存されない名前";
  invalid.nextNumber++;
  invalid.records.push({ ...invalid.records[0], id: context.id() });
  await expect(
    d1Repository(database).compareAndSwap(invalid, app.revision),
  ).rejects.toThrow();
  expect(await d1Repository(database).get(app.id)).toEqual(app);
});

test("FRM-042 下書き保存と他の記録の更新で変更のない記録を書き直さない", async () => {
  let app = await service().create(templates[0]);
  app = await service().publish(app.id, app.revision);
  app = await service().saveRecord(app.id, app.revision, {
    title: "触らない値",
  });
  const protectedId = app.records[0].id;
  // UPDATE/DELETEが実行されたこと自体を検出する。値の同一性だけでは全件書き直しを見逃す。
  await database.exec(
    `CREATE TRIGGER protect_record_update BEFORE UPDATE ON records WHEN OLD.id = '${protectedId}' BEGIN SELECT RAISE(ABORT, 'unchanged record updated'); END;`,
  );
  await database.exec(
    `CREATE TRIGGER protect_record_delete BEFORE DELETE ON records WHEN OLD.id = '${protectedId}' BEGIN SELECT RAISE(ABORT, 'unchanged record deleted'); END;`,
  );
  try {
    app = await service().saveDraft(app.id, app.revision, {
      ...app.draft,
      name: "下書きのみ変更",
    });
    app = await service().saveRecord(app.id, app.revision, {
      title: "別の記録",
    });
    app = await service().saveRecord(
      app.id,
      app.revision,
      { title: "別の記録を編集" },
      app.records[1].id,
    );
    app = await service().deleteRecords(app.id, app.revision, [
      app.records[1].id,
    ]);
    expect(await d1Repository(database).get(app.id)).toEqual(app);
  } finally {
    await database.exec(
      "DROP TRIGGER protect_record_update; DROP TRIGGER protect_record_delete;",
    );
  }
});

test("FRM-042 同じ記録ID・番号を持つ別アプリへ変更を波及させない", async () => {
  let app = await service().create(templates[0]);
  app = await service().publish(app.id, app.revision);
  app = await service().saveRecord(app.id, app.revision, {
    title: "元のアプリ",
  });
  const other = { ...structuredClone(app), id: context.id(), revision: 0 };
  expect(await d1Repository(database).compareAndSwap(other, null)).toBe(true);
  app = await service().deleteRecords(app.id, app.revision, [
    app.records[0].id,
  ]);
  expect((await d1Repository(database).get(app.id))?.records).toEqual([]);
  expect(await d1Repository(database).get(other.id)).toEqual(other);
  expect(await d1Repository(database).get("missing")).toBeNull();
});

test("FRM-042 アプリ別の記録取得と番号順の走査に索引を使える", async () => {
  const plan = await database
    .prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM records WHERE app_id = ? ORDER BY number",
    )
    .bind("example")
    .all<{ detail: string }>();
  expect(
    plan.results.some((row) => /SEARCH records USING INDEX/.test(row.detail)),
  ).toBe(true);
  expect(plan.results.some((row) => /TEMP B-TREE/.test(row.detail))).toBe(
    false,
  );
});
