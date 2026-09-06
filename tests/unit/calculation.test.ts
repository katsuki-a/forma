import { expect, test } from "vitest";
import { evaluateFormula } from "../../src/contracts/calculation.ts";
import {
  definitionSchema,
  prepareValues,
  templates,
} from "../../src/contracts/model.ts";

test.each([
  ["2 + 3 * 4", 14],
  ["(2 + 3) * 4", 20],
  ["10 - 3 - 2", 5],
  ["12 / 3 / 2", 2],
  ["-[quantity] + +2", -1],
  [".5 * 1e2", 50],
])("FRM-014 演算の優先順位と結合順 %s", (formula, result) => {
  expect(evaluateFormula(formula, { quantity: 3 })).toBe(result);
});
test.each([
  "1/0",
  "1e308 * 10",
  "Math.random()",
  "1; alert(1)",
  "2 ** 3",
  "(1+2",
  "1 +",
  "",
])("FRM-014 不正な計算を実行しない %s", (formula) => {
  expect(() => evaluateFormula(formula, {})).toThrow();
});
test("FRM-014 未入力は空、外部入力の計算結果は再計算する", () => {
  const definition = {
    ...templates[0],
    fields: [
      { id: "quantity", label: "数量", type: "number" as const },
      {
        id: "total",
        label: "合計",
        type: "calculation" as const,
        formula: "[quantity] * 2",
      },
    ],
  };
  expect(prepareValues(definition, { total: 999 }).values.total).toBeNull();
  expect(
    prepareValues(definition, { quantity: 4, total: "fake" }).values.total,
  ).toBe(8);
});
test.each([
  {
    fields: [
      { id: "text", label: "文字列", type: "text" },
      { id: "total", label: "計算", type: "calculation", formula: "[text]" },
    ],
  },
  {
    fields: [
      { id: "total", label: "計算", type: "calculation", formula: "[total]" },
    ],
  },
  {
    fields: [
      { id: "total", label: "計算", type: "calculation", formula: "[missing]" },
    ],
  },
  { fields: [{ id: "memo", label: "メモ", type: "textarea", unique: true }] },
  {
    directory: {
      users: [
        { id: "same", name: "A" },
        { id: "same", name: "B" },
      ],
      organizations: [],
      groups: [],
    },
  },
  {
    workflow: {
      initialState: "missing",
      states: [{ id: "todo", name: "未着手", assignees: [] }],
      transitions: [],
    },
  },
])("FRM-013/014/015/017 不正な定義を受理しない %#", (patch) => {
  expect(
    definitionSchema.safeParse({ ...templates[0], ...patch }).success,
  ).toBe(false);
});

test("FRM-014 未入力の参照がある式は途中の演算によらず空値になる", () => {
  expect(evaluateFormula("[quantity] + (1 / 0)", {})).toBeNull();
  expect(evaluateFormula("(1 / 0) + [quantity]", { quantity: "" })).toBeNull();
  expect(() =>
    evaluateFormula("[quantity] + (1 / 0)", { quantity: 2 }),
  ).toThrow();
});
