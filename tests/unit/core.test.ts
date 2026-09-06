import { describe, expect, test } from "vitest";
import { definitionSchema, validateValues } from "../../src/contracts/model.ts";
import { createService } from "../../src/domain/service.ts";
import { memoryRepository } from "../../src/server/memory-repository.ts";

const definition = {
  version: 1 as const,
  name: "家の記録",
  description: "",
  icon: "tree",
  theme: "forest" as const,
  fields: [
    { id: "title", label: "内容", type: "text" as const },
    { id: "count", label: "数量", type: "number" as const },
  ],
};
const setup = () =>
  createService(memoryRepository(), {
    id: (() => {
      let n = 0;
      return () => `id-${++n}`;
    })(),
    now: () => "2026-09-06T00:00:00.000Z",
    actor: "local-user",
  });

describe("FRM-030 共通の定義と検証", () => {
  test("手動・テンプレート・生成候補を同じ定義として検証する", () => {
    for (const candidate of [
      definition,
      structuredClone(definition),
      JSON.parse(JSON.stringify(definition)),
    ]) {
      expect(definitionSchema.parse(candidate)).toEqual(definition);
    }
    for (const bad of [
      { ...definition, version: 2 },
      { ...definition, fields: [{ id: "x", label: "x", type: "code" }] },
      { ...definition, fields: [definition.fields[0], definition.fields[0]] },
    ])
      expect(definitionSchema.safeParse(bad).success).toBe(false);
  });
  test("項目IDを返し型の不一致、未知の項目、不正な日付を拒否する", () => {
    expect(validateValues(definition, { count: "2" })).toContainEqual(
      expect.objectContaining({ fieldId: "count" }),
    );
    expect(validateValues(definition, { unknown: "x" })).toContainEqual(
      expect.objectContaining({ fieldId: "unknown" }),
    );
    expect(
      validateValues(
        {
          ...definition,
          fields: [{ id: "date", label: "日付", type: "date" }],
        },
        { date: "2026-02-30" },
      ),
    ).not.toHaveLength(0);
    expect(validateValues(definition, { title: "連絡", count: 2 })).toEqual([]);
  });
});

describe("FRM-010/011/016 アプリと記録", () => {
  test("下書きと反映を分離し、複製は独立する", async () => {
    const service = setup();
    const app = await service.create(definition);
    expect(app.published).toBeNull();
    await expect(
      service.saveRecord(app.id, app.revision, { title: "未反映" }),
    ).rejects.toMatchObject({ code: "not_published" });
    const published = await service.publish(app.id, app.revision);
    const draft = await service.saveDraft(app.id, published.revision, {
      ...definition,
      name: "新しい名前",
    });
    expect(draft.published?.name).toBe("家の記録");
    expect(draft.draft.name).toBe("新しい名前");
    const copy = await service.create({ ...draft.draft, name: "複製" });
    expect(copy.id).not.toBe(app.id);
    expect((await service.get(app.id)).draft.name).toBe("新しい名前");
  });
  test("CRUD、再利用、一括削除、システム項目を保存する", async () => {
    const service = setup();
    let app = await service.create(definition);
    app = await service.publish(app.id, app.revision);
    app = await service.saveRecord(app.id, app.revision, {
      title: "買い物",
      count: 1,
    });
    const first = app.records[0];
    expect(first).toMatchObject({
      number: 1,
      createdBy: "local-user",
      updatedBy: "local-user",
    });
    app = await service.saveRecord(
      app.id,
      app.revision,
      { ...first.values, count: 3 },
      first.id,
    );
    app = await service.saveRecord(app.id, app.revision, app.records[0].values);
    expect(app.records.map((r) => r.number)).toEqual([1, 2]);
    expect(app.records[1].id).not.toBe(first.id);
    app = await service.deleteRecords(
      app.id,
      app.revision,
      app.records.map((r) => r.id),
    );
    expect(app.records).toEqual([]);
    app = await service.saveRecord(app.id, app.revision, { title: "次の記録" });
    expect(app.records[0].number).toBe(3);
  });
  test("不正入力と競合で保存済みの値を変えない", async () => {
    const service = setup();
    let app = await service.create(definition);
    app = await service.publish(app.id, app.revision);
    await expect(
      service.saveRecord(app.id, app.revision, { count: "wrong" }),
    ).rejects.toMatchObject({ code: "validation" });
    expect((await service.get(app.id)).revision).toBe(app.revision);
    const results = await Promise.allSettled([
      service.saveRecord(app.id, app.revision, { count: 1 }),
      service.saveRecord(app.id, app.revision, { count: 2 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await service.get(app.id)).records).toHaveLength(1);
  });
});

describe("FRM-013 入力型の保存契約", () => {
  const cases = [
    ["text", "連絡", 4],
    ["textarea", "一行目\n二行目", []],
    ["number", 1.5, "1.5"],
    ["radio", "a", "unknown"],
    ["select", "b", ["b"]],
    ["checkbox", ["a", "b"], ["a", "a"]],
    ["multiselect", ["a"], ["unknown"]],
    ["date", "2024-02-29", "2026-02-29"],
    ["time", "23:59:59", "24:00"],
    ["datetime", "2026-09-06T12:30:15", "2026-09-06T12:30T"],
    ["url", "https://example.com", "javascript:alert(1)"],
    ["tel", "+81-00-0000-0000", 123],
    ["email", "sample@example.com", "broken"],
  ] as const;
  test.each(cases)(
    "%sの値を保存し、型不一致を拒否する",
    async (type, valid, invalid) => {
      const service = setup();
      const candidate = {
        ...definition,
        fields: [
          {
            id: "value",
            label: "値",
            type,
            ...(["radio", "select", "checkbox", "multiselect"].includes(type)
              ? { options: ["a", "b"] }
              : {}),
          },
        ],
      };
      let app = await service.create(candidate);
      app = await service.publish(app.id, app.revision);
      const value = typeof valid === "object" ? [...valid] : valid;
      app = await service.saveRecord(app.id, app.revision, { value });
      expect(app.records[0].values.value).toEqual(valid);
      expect(validateValues(app.published!, { value: invalid })).not.toEqual(
        [],
      );
    },
  );
});
