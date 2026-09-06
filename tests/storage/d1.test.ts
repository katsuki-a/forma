import { capabilityDefinition } from "../fixtures/capabilities.ts";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createService } from "../../src/domain/service.ts";
import { d1Repository } from "../../src/server/d1-repository.ts";
import { capabilityContract } from "../capability-contract.ts";
import { repositoryContract } from "../repository-contract.ts";

const persistence = mkdtempSync(join(tmpdir(), "forma-storage-test-"));
const createRuntime = () =>
  new Miniflare({
    cf: false,
    resourcePersistencePath: persistence,
    workers: [
      {
        config: {
          name: "storage-test",
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
          env: { DB: { type: "d1", id: "test-db" } },
        },
      },
    ],
  });
let runtime: Miniflare;
let database: D1Database;
beforeAll(async () => {
  runtime = createRuntime();
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
beforeEach(async () => {
  await database.prepare("DELETE FROM applications").run();
  await database.prepare("DELETE FROM announcements").run();
});
afterAll(async () => {
  await runtime?.dispose();
  rmSync(persistence, { recursive: true, force: true });
});
repositoryContract(() => Promise.resolve(d1Repository(database)));
capabilityContract(() => Promise.resolve(d1Repository(database)));
test("FRM-041 ランタイム再起動後も定義と記録が残る", async () => {
  const service = createService(d1Repository(database), {
    id: () => crypto.randomUUID(),
    now: () => "2026-09-06T00:00:00Z",
    actor: "test-user",
  });
  let app = await service.create(capabilityDefinition);
  app = await service.publish(app.id, app.revision);
  app = await service.saveRecord(app.id, app.revision, {
    title: "再起動後も残る",
  });
  const news = await service.saveAnnouncement({
    title: "再起動",
    body: "永続化",
  });
  await runtime.dispose();
  runtime = createRuntime();
  database = await runtime.getD1Database("DB");
  expect(await d1Repository(database).get(app.id)).toEqual(app);
  expect(await d1Repository(database).listAnnouncements()).toEqual([news]);
});
