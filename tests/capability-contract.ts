import { expect, test } from "vitest";
import type { Repository } from "../src/domain/repository.ts";
import { createService } from "../src/domain/service.ts";
import { type Values } from "../src/contracts/model.ts";

import { capabilityDefinition } from "./fixtures/capabilities.ts";

export function capabilityContract(factory: () => Promise<Repository>) {
  const setup = async () => {
    const repository = await factory();
    return {
      repository,
      service: createService(repository, {
        id: () => crypto.randomUUID(),
        now: () => "2026-09-06T00:00:00Z",
        actor: "local-user",
      }),
    };
  };
  test("FRM-013/014/015/017 選択・計算・任意の重複禁止・状態を保存できる", async () => {
    const { service, repository } = await setup();
    let app = await service.create(capabilityDefinition);
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, {
      title: "買い物",
      quantity: 2,
      price: 150,
      total: 999,
      members: ["aoi"],
      teams: ["home"],
      groups: ["shopping"],
    });
    expect(app.records[0].values.total).toBe(300);
    expect(app.records[0].workflow).toEqual({
      stateId: "todo",
      assigneeId: null,
    });
    expect(await repository.get(app.id)).toEqual(app);
    await expect(
      service.saveRecord(app.id, app.revision, { title: "買い物" }),
    ).rejects.toMatchObject({ code: "validation" });
    app = await service.saveRecord(
      app.id,
      app.revision,
      app.records[0].values,
      app.records[0].id,
    );
    app = await service.saveRecord(app.id, app.revision, { title: "" });
    app = await service.saveRecord(app.id, app.revision, { title: null });
    expect(app.records).toHaveLength(3);
    expect(app.records[1].values.total).toBeNull();
  });
  test("FRM-015 重複禁止を有効化する反映と同時登録の整合性", async () => {
    const { service, repository } = await setup();
    const definition = {
      ...capabilityDefinition,
      fields: [{ id: "title", label: "内容", type: "text" as const }],
    };
    let app = await service.create(definition);
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, { title: "重複" });
    app = await service.saveRecord(app.id, app.revision, { title: "重複" });
    app = await service.saveDraft(app.id, app.revision, {
      ...definition,
      fields: [{ ...definition.fields[0], unique: true }],
    });
    await expect(service.publish(app.id, app.revision)).rejects.toMatchObject({
      code: "incompatible_records",
    });
    expect(await repository.get(app.id)).toEqual(app);
    app = await service.deleteRecords(app.id, app.revision, [
      app.records[1].id,
    ]);
    app = await service.publish(app.id, app.revision);
    const results = await Promise.allSettled([
      service.saveRecord(app.id, app.revision, { title: "同時" }),
      service.saveRecord(app.id, app.revision, { title: "同時" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
  });
  test("FRM-013/014 不正な候補と計算失敗を拒否し保存内容を維持する", async () => {
    const { service, repository } = await setup();
    const definition = structuredClone(capabilityDefinition);
    definition.fields[3].formula = "[quantity] / [price]";
    let app = await service.create(definition);
    app = await service.publish(app.id, app.revision);
    await expect(
      service.saveRecord(app.id, app.revision, { quantity: 1, price: 0 }),
    ).rejects.toMatchObject({ code: "validation" });
    for (const values of [
      { members: ["missing"] },
      { teams: ["aoi"] },
      { groups: ["shopping", "shopping"] },
    ] as Values[]) {
      await expect(
        service.saveRecord(app.id, app.revision, values),
      ).rejects.toMatchObject({ code: "validation" });
    }
    expect(await repository.get(app.id)).toEqual(app);
    app = await service.saveRecord(app.id, app.revision, { members: ["aoi"] });
    definition.directory = { ...definition.directory!, users: [] };
    definition.workflow = undefined;
    app = await service.saveDraft(app.id, app.revision, definition);
    await expect(service.publish(app.id, app.revision)).rejects.toMatchObject({
      code: "incompatible_records",
    });
  });
  test("FRM-017 状態と担当者を変更し未定義遷移・担当者を拒否する", async () => {
    const { service, repository } = await setup();
    let app = await service.create(capabilityDefinition);
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, {
      title: "状態の確認",
    });
    const id = app.records[0].id;
    app = await service.updateWorkflow(app.id, app.revision, id, {
      assigneeId: "aoi",
    });
    expect(app.records[0].workflow?.assigneeId).toBe("aoi");
    await expect(
      service.updateWorkflow(app.id, app.revision, id, { assigneeId: "sora" }),
    ).rejects.toMatchObject({ code: "validation" });
    app = await service.updateWorkflow(app.id, app.revision, id, {
      transitionId: "complete",
      assigneeId: "sora",
    });
    expect(app.records[0].workflow).toEqual({
      stateId: "done",
      assigneeId: "sora",
    });
    await expect(
      service.updateWorkflow(app.id, app.revision, id, {
        transitionId: "complete",
      }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(await repository.get(app.id)).toEqual(app);
  });
  test("FRM-014/017 定義の反映で再計算し、計算不能や状態の喪失を拒否する", async () => {
    const { service, repository } = await setup();
    let app = await service.create(capabilityDefinition);
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, {
      quantity: 2,
      price: 5,
    });
    let draft = structuredClone(app.draft);
    draft.fields[3].formula = "[quantity] + [price]";
    app = await service.saveDraft(app.id, app.revision, draft);
    app = await service.publish(app.id, app.revision);
    expect(app.records[0].values.total).toBe(7);
    draft = structuredClone(app.draft);
    draft.fields[3].formula = "[quantity] / ([price] - 5)";
    app = await service.saveDraft(app.id, app.revision, draft);
    await expect(service.publish(app.id, app.revision)).rejects.toMatchObject({
      code: "incompatible_records",
    });
    expect(await repository.get(app.id)).toEqual(app);
    draft = structuredClone(app.published!);
    draft.workflow = undefined;
    app = await service.saveDraft(app.id, app.revision, draft);
    await expect(service.publish(app.id, app.revision)).rejects.toMatchObject({
      code: "incompatible_records",
    });
    expect(await repository.get(app.id)).toEqual(app);
  });
  test("FRM-015 対象型の完全一致と空値を区別し、解除後は重複を許す", async () => {
    const { service } = await setup();
    const definition = {
      ...capabilityDefinition,
      fields: [
        { id: "text", label: "文字列", type: "text" as const, unique: true },
        { id: "number", label: "数値", type: "number" as const, unique: true },
        { id: "url", label: "URL", type: "url" as const, unique: true },
        { id: "tel", label: "電話", type: "tel" as const, unique: true },
        { id: "email", label: "メール", type: "email" as const, unique: true },
      ],
    };
    let app = await service.create(definition);
    app = await service.publish(app.id, app.revision);
    const values = {
      text: "Memo",
      number: 0,
      url: "https://example.com",
      tel: "000-0000-0000",
      email: "sample@example.com",
    };
    app = await service.saveRecord(app.id, app.revision, values);
    for (const [field, value] of Object.entries(values)) {
      await expect(
        service.saveRecord(app.id, app.revision, { [field]: value }),
      ).rejects.toMatchObject({
        code: "validation",
        issues: [{ fieldId: field, code: "duplicate" }],
      });
    }
    app = await service.saveRecord(app.id, app.revision, { text: "memo" });
    app = await service.saveRecord(app.id, app.revision, { text: "Memo " });
    app = await service.saveRecord(app.id, app.revision, {});
    app = await service.saveRecord(app.id, app.revision, {});
    app = await service.saveDraft(app.id, app.revision, {
      ...definition,
      fields: definition.fields.map((field) => ({ ...field, unique: false })),
    });
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, values);
    expect(app.records).toHaveLength(6);
  });
  test("FRM-018 お知らせの登録・編集・競合・削除", async () => {
    const { service } = await setup();
    let news = await service.saveAnnouncement({
      title: "連絡",
      body: "集合は10時です。",
    });
    expect(await service.listAnnouncements()).toEqual([news]);
    const oldRevision = news.revision;
    news = await service.saveAnnouncement({
      id: news.id,
      revision: news.revision,
      title: "変更",
      body: "11時です。",
    });
    await expect(
      service.saveAnnouncement({
        id: news.id,
        revision: oldRevision,
        title: "競合",
        body: "",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.deleteAnnouncement(news.id, oldRevision),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await service.listAnnouncements()).toEqual([news]);
    await service.deleteAnnouncement(news.id, news.revision);
    expect(await service.listAnnouncements()).toEqual([]);
    await expect(
      service.saveAnnouncement({ title: " ", body: "本文" }),
    ).rejects.toMatchObject({ code: "validation" });
  });
}
