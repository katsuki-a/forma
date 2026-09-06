import { expect, test } from "vitest";
import { checkDependencies } from "../../scripts/check-boundaries.ts";

test("FRM-040 実装参照の混入をimport・再export・動的import・型で検出する", () => {
  for (const code of [
    "import { createApi } from '../server/api.ts'",
    "export * from '../server/api.ts'",
    "import('../server/api.ts')",
    "type Server = import('../server/api.ts')",
    "require('../server/api.ts')",
  ]) {
    expect(checkDependencies("src/client/app.tsx", code)).not.toEqual([]);
  }
  expect(
    checkDependencies(
      "src/client/app.tsx",
      "import { appSchema } from '../contracts/model.ts'",
    ),
  ).toEqual([]);
  expect(
    checkDependencies("src/domain/service.ts", "import fs from 'node:fs'"),
  ).not.toEqual([]);
});
