import { expect, test } from "vitest";
import { createClient } from "../../src/client/api-client.ts";
import { templates } from "../../src/contracts/model.ts";
import { createApi } from "../../src/server/api.ts";
import { memoryRepository } from "../../src/server/memory-repository.ts";

const setup = () => {
  const api = createApi(memoryRepository());
  const client = createClient(
    async (input, init) => api.request(new Request(input, init)),
    "http://localhost",
  );
  return { api, client };
};
test("FRM-040 HTTP通信契約で作成・反映・CRUD・競合まで実行する", async () => {
  const { client } = setup();
  let app = await client.create(templates[0]);
  app = await client.publish(app.id, app.revision);
  app = await client.saveRecord(app.id, app.revision, { title: "共有メモ" });
  expect((await client.list())[0].records[0].values.title).toBe("共有メモ");
  const oldRevision = app.revision;
  app = await client.saveRecord(
    app.id,
    app.revision,
    { title: "修正" },
    app.records[0].id,
  );
  await expect(
    client.deleteRecords(app.id, oldRevision, [app.records[0].id]),
  ).rejects.toMatchObject({ code: "conflict" });
  app = await client.deleteRecords(app.id, app.revision, [app.records[0].id]);
  expect(app.records).toEqual([]);
});
test("FRM-011 既存記録を壊す反映を拒否し、利用中の定義を維持する", async () => {
  const { client } = setup();
  let app = await client.create(templates[0]);
  app = await client.publish(app.id, app.revision);
  app = await client.saveRecord(app.id, app.revision, { title: "残す記録" });
  app = await client.saveDraft(app.id, app.revision, {
    ...app.draft,
    fields: [],
  });
  await expect(client.publish(app.id, app.revision)).rejects.toMatchObject({
    code: "incompatible_records",
  });
  const current = await client.get(app.id);
  expect(current.published?.fields[0].id).toBe("title");
  expect(current.records[0].values.title).toBe("残す記録");
});
test("不正JSON・未知API・不正形式は制御されたエラーになる", async () => {
  const { api } = setup();
  for (const body of ["{", "null", '{"version":7}']) {
    const response = await api.request("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(response.status).toBe(400);
  }
  expect((await api.request("/api/missing")).status).toBe(404);
  expect(
    (await api.request("/api/apps", { method: "POST", body: "{}" })).status,
  ).toBe(415);
  expect(
    (
      await api.request("/api/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://example.com",
        },
        body: "{}",
      })
    ).status,
  ).toBe(403);
});
test("応答が壊れていてもUIへ構造化エラーを返す", async () => {
  await expect(
    createClient(() => Promise.resolve(Response.json({ broken: true }))).list(),
  ).rejects.toMatchObject({ code: "protocol" });
  await expect(
    createClient(() => Promise.reject(new Error("offline"))).list(),
  ).rejects.toMatchObject({ code: "network" });
});

test("不正Originを内部エラーにせず拒否する", async () => {
  const { api } = setup();
  const response = await api.request("/api/apps", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "null" },
    body: "{}",
  });
  expect(response.status).toBe(403);
});

test("FRM-017/018 状態とお知らせをHTTP契約経由で操作する", async () => {
  const { client, api } = setup();
  const { capabilityDefinition } = await import("../fixtures/capabilities.ts");
  let app = await client.create(capabilityDefinition);
  app = await client.publish(app.id, app.revision);
  app = await client.saveRecord(app.id, app.revision, {
    title: "HTTP",
    quantity: 2,
    price: 100,
  });
  app = await client.updateWorkflow(app.id, app.revision, app.records[0].id, {
    transitionId: "complete",
  });
  expect(app.records[0].workflow?.stateId).toBe("done");
  expect(app.records[0].values.total).toBe(200);
  const news = await client.saveAnnouncement({
    title: "集合",
    body: "10時\n玄関",
  });
  expect(await client.listAnnouncements()).toEqual([news]);
  expect(
    (
      await api.request(
        `/api/apps/${app.id}/records/${app.records[0].id}/workflow`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: app.revision, stateId: "todo" }),
        },
      )
    ).status,
  ).toBe(400);
  await client.deleteAnnouncement(news.id, news.revision);
  expect(await client.listAnnouncements()).toEqual([]);
});
