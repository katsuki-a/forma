import { expect, expectTypeOf, test } from "vitest";
import { ESLint } from "eslint";
import { ja } from "../../src/localization/ja.ts";
import {
  createTranslator,
  describe,
  messageKey,
  t,
  translator,
  validateCatalog,
} from "../../src/localization/index.ts";
import {
  AppError,
  errorSchema,
  parseDefinition,
  prepareValues,
  templates,
} from "../../src/contracts/model.ts";
import { createClient } from "../../src/client/api-client.ts";
import { createApi } from "../../src/server/api.ts";
import { memoryRepository } from "../../src/server/memory-repository.ts";

// 検証用。製品の提供言語には含めない。
const english = createTranslator("en", {
  "portal.appCount_one": "{{count}} app",
  "portal.appCount_other": "{{count}} apps",
  "announcements.editNamed": "Edit {{title}}",
  "calculation.zero": "Cannot divide by zero.",
  "errors.fieldDetail": "{{detail}} Field: {{label}}",
  "errors.recordDetail": "{{detail}} Record: {{number}}",
});

test("FRM-022 文全体の語順と複数形を変更でき、欠落した翻訳は日本語に戻る", () => {
  expect(english.t("announcements.editNamed", { title: "予定" })).toBe(
    "Edit 予定",
  );
  expect(english.t("portal.appCount", { count: 0 })).toBe("0 apps");
  expect(english.t("portal.appCount", { count: 1 })).toBe("1 app");
  expect(english.t("portal.appCount", { count: 2 })).toBe("2 apps");
  expect(t("portal.appCount", { count: 0 })).toBe("0件");
  expect(english.t("common.cancel")).toBe("キャンセル");
  expect(t("announcements.editNamed", { title: "予定" })).toBe("予定を編集");
  expect(createTranslator("fr").t("common.cancel")).toBe("キャンセル");
});

test("FRM-022 リソースキーと差し込み値を検査する", () => {
  expect(validateCatalog(ja)).toEqual([]);
  expect(
    createTranslator("ja", { "common.cancel": "取り消す" }).t("common.cancel"),
  ).toBe("取り消す");
  expect(() => createTranslator("en", { unknown: "Unknown" })).toThrow(
    "Unknown message key",
  );
  expect(() =>
    createTranslator("en", { "announcements.editNamed": "Edit {{name}}" }),
  ).toThrow("Invalid message parameters");
  expect(() => createTranslator("en", { "common.cancel": "" })).toThrow();
  expect(translator.message({ messageKey: "missing.key" })).toBe(
    t("errors.unexpected"),
  );
  expect(
    translator.message({
      messageKey: "portal.appCount",
      messageParams: { count: "2" },
    }),
  ).toBe(t("errors.unexpected"));
  expect(translator.message({ messageKey: "announcements.editNamed" })).toBe(
    t("errors.unexpected"),
  );
  expect(
    english.message({
      messageKey: "announcements.editNamed",
      messageParams: { title: "{{count}} <b>メモ</b>", lng: "ja" },
    }),
  ).toBe("Edit {{count}} <b>メモ</b>");
});

test("FRM-022 キーと必須引数の誤りを型検査で拒否する", () => {
  function typeContract() {
    // @ts-expect-error 存在しないキー
    t("unknown");
    // @ts-expect-error 件数を省略できない
    t("portal.appCount");
    // @ts-expect-error 件数は文字列に変換せず渡す
    t("portal.appCount", { count: "2" });
    // @ts-expect-error 別名の値で代用しない
    t("announcements.editNamed", { name: "test" });
    // @ts-expect-error Zodの独自エラーキーも検査する
    messageKey("errors.unknown");
  }
  expectTypeOf(typeContract).toBeFunction();
});

test("FRM-022 Zodの既定英語文言を漏らさず、エラーにキーを持たせる", () => {
  try {
    parseDefinition({
      ...templates[0],
      name: "",
      fields: [{ id: "invalid id", label: "", type: "text" }],
    });
    expect.unreachable("Invalid definition accepted");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const parsed = errorSchema.parse(error);
    expect(parsed.messageKey).toBe("errors.definition");
    expect(parsed.issues.map((issue) => issue.messageKey)).toEqual([
      "errors.appName",
      "errors.identifier",
      "errors.requiredName",
    ]);
    expect(
      parsed.issues.every((issue) => !issue.message.includes("Invalid")),
    ).toBe(true);
  }
});

test("FRM-022 計算エラーの原因と項目名を保持し、表示時に別言語へ復元する", () => {
  const definition = {
    ...templates[0],
    fields: [
      { id: "amount", label: "金額", type: "number" as const },
      {
        id: "total",
        label: "合計",
        type: "calculation" as const,
        formula: "[amount] / 0",
      },
    ],
  };
  const original = structuredClone(definition);
  const issue = prepareValues(definition, { amount: 2 }).issues[0];
  expect(issue.messageKey).toBe("calculation.zero");
  expect(issue.message).toBe("合計: 0で割ることはできません。");
  expect(english.message({ ...issue, recordNumber: 7 })).toBe(
    "Cannot divide by zero. Field: 合計 Record: 7",
  );
  expect(definition).toEqual(original);
});

test("FRM-022 APIの翻訳キーと値を使い、サーバーの文言変更で判定を変えない", async () => {
  const api = createApi(memoryRepository());
  const response = await api.request("http://localhost/api/apps/missing");
  expect(response.status).toBe(404);
  const payload = errorSchema.parse(await response.json());
  expect(payload).toMatchObject({
    code: "not_found",
    messageKey: "errors.appNotFound",
  });
  const client = createClient(() =>
    Promise.resolve(
      Response.json(
        { ...payload, message: "changed server copy" },
        { status: 404 },
      ),
    ),
  );
  await expect(client.get("missing")).rejects.toMatchObject({
    code: "not_found",
    messageKey: "errors.appNotFound",
    message: t("errors.appNotFound"),
  });
  const unknown = createClient(() =>
    Promise.resolve(
      Response.json(
        {
          code: "future",
          message: "unknown server text",
          messageKey: "future.key",
          issues: [],
        },
        { status: 400 },
      ),
    ),
  );
  await expect(unknown.list()).rejects.toMatchObject({
    code: "future",
    message: t("errors.unexpected"),
  });
});

test("FRM-022 API経由でも検証エラーの値を保持し、入力データを書き換えない", async () => {
  const api = createApi(memoryRepository());
  const client = createClient(
    async (input, init) => api.request(new Request(input, init)),
    "http://localhost",
  );
  let app = await client.create({
    ...templates[0],
    name: "My 予定 {{count}}",
    fields: [{ id: "amount", label: "金額", type: "number" }],
  });
  app = await client.publish(app.id, app.revision);
  await expect(
    client.saveRecord(app.id, app.revision, { amount: "bad" }),
  ).rejects.toMatchObject({
    code: "validation",
    issues: [
      expect.objectContaining({
        messageKey: "errors.fieldValue.number",
        messageParams: { label: "金額" },
        message: "金額には数値を入力してください。",
      }),
    ],
  });
  expect((await client.get(app.id)).draft.name).toBe("My 予定 {{count}}");
  expect((await client.get(app.id)).records).toEqual([]);
});

test("FRM-022 lintは文字列・JSX・テンプレートの直書きを検出し、コメントは許容する", async () => {
  const eslint = new ESLint();
  for (const source of [
    "export const Label = () => <p>日本語</p>;",
    'export const Label = () => <input aria-label="日本語" />;',
    'export const label = "日本語";',
    "export const label = `日本語${1}`;",
  ]) {
    const [result] = await eslint.lintText(source, {
      filePath: "src/client/main.tsx",
    });
    expect(
      result.messages.some(
        (message) => message.ruleId === "no-restricted-syntax",
      ),
    ).toBe(true);
  }
  const [result] = await eslint.lintText(
    '// 日本語のコメント\nexport const Label = () => <p>{t("common.cancel")}</p>;',
    { filePath: "src/client/main.tsx" },
  );
  expect(
    result.messages.filter(
      (message) => message.ruleId === "no-restricted-syntax",
    ),
  ).toEqual([]);
});

test("FRM-022 descriptorは判定用のコードから独立している", () => {
  expect(
    describe("errors.duplicateValue", {
      label: "内容",
      previous: 1,
      number: 2,
    }),
  ).toMatchObject({
    messageKey: "errors.duplicateValue",
    messageParams: { label: "内容", previous: 1, number: 2 },
  });
});
