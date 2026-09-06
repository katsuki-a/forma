import assert from "node:assert/strict";
import test from "node:test";
import { checkDocuments as validate } from "./check-docs.ts";

const checkDocuments = (files: Map<string, string>) =>
  validate(files, { local: true });

function requiredDocument(files: Map<string, string>, path: string): string {
  const document = files.get(path);
  assert.notEqual(document, undefined, `Fixture missing: ${path}`);
  return document as string;
}

function fixture(): Map<string, string> {
  return new Map([
    ["README.md", "# forma\n"],
    ["AGENTS.md", "# Rules\n"],
    ["docs/README.md", "# Intent\n"],
    ["spec/README.md", "# Contract\n"],
    ["adr/README.md", "# Decisions\n"],
    [
      "docs/0001-intent.md",
      "---\nid: INT-001\nstatus: accepted\ndate: 2026-09-06\napproved-by: PdM\napproval-evidence: Initial request\n---\n# Intent\n",
    ],
    [
      "spec/0001-core.md",
      "---\nid: SPEC-001\nstatus: active\n---\n# Core\n\n## FRM-001: Shared data\n\nUsers share records.\n\n根拠: INT-001\n\n確認条件: Another user can read the record.\n",
    ],
  ]);
}

const cases: [string, (files: Map<string, string>) => void, RegExp][] = [
  [
    "unapproved intent",
    (files) =>
      files.set(
        "docs/0001-intent.md",
        requiredDocument(files, "docs/0001-intent.md").replace(
          "status: accepted",
          "status: proposed",
        ),
      ),
    /accepted intent/,
  ],
  [
    "missing approval evidence",
    (files) =>
      files.set(
        "docs/0001-intent.md",
        requiredDocument(files, "docs/0001-intent.md").replace(
          "approval-evidence: Initial request\n",
          "",
        ),
      ),
    /approval evidence missing/,
  ],
  [
    "broken relative link",
    (files) => files.set("README.md", "# forma\n[Missing](missing.md)\n"),
    /missing or non-relative link/,
  ],
  [
    "duplicate requirement",
    (files) =>
      files.set(
        "spec/0002-copy.md",
        requiredDocument(files, "spec/0001-core.md").replace(
          "SPEC-001",
          "SPEC-002",
        ),
      ),
    /duplicate requirement id/,
  ],
  [
    "duplicate document",
    (files) =>
      files.set(
        "docs/0002-copy.md",
        requiredDocument(files, "docs/0001-intent.md"),
      ),
    /duplicate document id/,
  ],
  [
    "missing acceptance criteria",
    (files) =>
      files.set(
        "spec/0001-core.md",
        requiredDocument(files, "spec/0001-core.md").replace(
          "確認条件:",
          "Note:",
        ),
      ),
    /acceptance criteria missing/,
  ],
  [
    "mislabelled intent link",
    (files) =>
      files.set(
        "spec/0001-core.md",
        requiredDocument(files, "spec/0001-core.md").replace(
          "INT-001",
          "INT-999",
        ),
      ),
    /accepted intent/,
  ],
  [
    "missing intent link",
    (files) =>
      files.set(
        "spec/0001-core.md",
        requiredDocument(files, "spec/0001-core.md").replace("根拠:", "Note:"),
      ),
    /intent reference missing/,
  ],
  [
    "obsolete intent",
    (files) =>
      files.set(
        "docs/0001-intent.md",
        requiredDocument(files, "docs/0001-intent.md").replace(
          "status: accepted",
          "status: superseded",
        ),
      ),
    /valid successor missing/,
  ],
  [
    "public comparison",
    (files) => files.set("README.md", "# forma\nkintoneのようなアプリ\n"),
    /belongs in docs/,
  ],
  [
    "public personal motivation",
    (files) => files.set("README.md", "# forma\n学習のために作成\n"),
    /belongs in docs/,
  ],
  [
    "missing core document",
    (files) => {
      files.delete("spec/README.md");
    },
    /required document missing/,
  ],
];

void test("accepts a minimal specification backed by an accepted intent", () => {
  assert.equal(checkDocuments(fixture()).ok, true);
});

for (const [name, change, error] of cases) {
  void test(`rejects ${name}`, () => {
    const files = fixture();
    change(files);
    const result = checkDocuments(files);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), error);
  });
}

void test("allows research and personal motivation in docs", () => {
  const files = fixture();
  files.set(
    "docs/0001-intent.md",
    `${files.get("docs/0001-intent.md")}\nkintoneの比較。学習のため。\n`,
  );
  assert.equal(checkDocuments(files).ok, true);
});

void test("ignores inline-code link examples", () => {
  const files = fixture();
  files.set("README.md", "# forma\nExample: `[name](path/to/file.md)`\n");
  assert.equal(checkDocuments(files).ok, true);
});

void test("public checks work without private docs and report approval is not checked", () => {
  const files = fixture();
  for (const path of files.keys())
    if (path.startsWith("docs/")) files.delete(path);
  const result = validate(files);
  assert.equal(result.ok, true);
  assert.equal(result.intentValidation, "not-run");
  assert.equal(checkDocuments(files).ok, false);
});

void test("public document cannot link to a private file, even when locally present", () => {
  const files = fixture();
  files.set("README.md", "# forma\n[Intent](docs/0001-intent.md)\n");
  assert.equal(validate(files).ok, false);
});
