import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { d1Repository } from "../../src/server/d1-repository.ts";
import { createService } from "../../src/domain/service.ts";
import { templates } from "../../src/contracts/model.ts";
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
  await database.exec(
    readFileSync(
      new URL("../../migrations/0001-applications.sql", import.meta.url),
      "utf8",
    ).replaceAll("\n", " "),
  );
});
beforeEach(async () => {
  await database.prepare("DELETE FROM applications").run();
});
afterAll(async () => {
  await runtime?.dispose();
  rmSync(persistence, { recursive: true, force: true });
});
repositoryContract(() => Promise.resolve(d1Repository(database)));
test("FRM-041 ランタイム再起動後も定義と記録が残る", async () => {
  const service = createService(d1Repository(database), {
    id: () => crypto.randomUUID(),
    now: () => "2026-09-06T00:00:00Z",
    actor: "test-user",
  });
  let app = await service.create(templates[0]);
  app = await service.publish(app.id, app.revision);
  app = await service.saveRecord(app.id, app.revision, {
    title: "再起動後も残る",
  });
  await runtime.dispose();
  runtime = createRuntime();
  database = await runtime.getD1Database("DB");
  expect(await d1Repository(database).get(app.id)).toEqual(app);
});
