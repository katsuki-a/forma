import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

test("FRM-010/011/016 実HTTPで項目を並べ、反映した記録を再読み込みする", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "アプリを作る", exact: true }).click();
  const name = `連絡帳-${testInfo.project.name}`;
  await page.getByLabel("アプリ名", { exact: true }).fill(name);
  await page.getByRole("button", { name: "項目を追加", exact: true }).click();
  await page.getByLabel("項目1の名前").fill("用件");
  await page.getByRole("button", { name: "項目を追加", exact: true }).click();
  await page.getByLabel("項目2の名前").fill("連絡先");
  await page.getByLabel("項目2の種類").selectOption("email");
  const rows = page
    .getByRole("region", { name: "項目の設定" })
    .getByRole("listitem");
  await page
    .getByLabel("連絡先をドラッグ", { exact: true })
    .dragTo(rows.first());
  await expect(page.getByLabel("項目1の名前")).toHaveValue("連絡先");
  await page.getByRole("button", { name: "アプリを作成", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "変更を反映", exact: true }).click();
  await page.getByRole("button", { name: "記録を追加", exact: true }).click();
  await page.getByLabel("用件", { exact: true }).fill("集合時間を確認する");
  await page.getByLabel("連絡先", { exact: true }).fill("sample@example.com");
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "集合時間を確認する", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "アプリの構造" })
    .getByRole("button", { name: `♧ ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "集合時間を確認する", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("records.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("非公開intentのファイルを配信しない", async ({ request }) => {
  // 公開CIにも存在する架空のファイルを使い、個人の非公開資料は読まない。
  await mkdir("docs", { recursive: true });
  const directory = await mkdtemp(resolve("docs/.access-check-"));
  try {
    const path = `${directory}/probe.txt`;
    await writeFile(path, "private access test fixture", { flag: "wx" });
    const response = await request.get(`/@fs${path}`);
    expect(response.status()).toBe(403);
  } finally {
    await rm(directory, { recursive: true });
  }
});
