import { expect, test } from "@playwright/test";
import { appSchema } from "../../src/contracts/model.ts";
import { capabilityDefinition } from "../fixtures/capabilities.ts";

test("FRM-013/014/015/017/018 実HTTPで候補・計算・状態・お知らせを操作する", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const name = `共有する用事-${testInfo.project.name}`;
  const created = await request.post("/api/apps", {
    data: { ...capabilityDefinition, name },
  });
  expect(created.status()).toBe(201);
  const app = appSchema.parse(await created.json());
  const published = await request.post(`/api/apps/${app.id}/publish`, {
    data: { revision: app.revision },
  });
  expect(published.ok()).toBe(true);
  await page.goto("/");
  await page
    .getByRole("button", { name: "お知らせを追加", exact: true })
    .click();
  const newsTitle = `週末の連絡-${testInfo.project.name}`;
  await page.getByLabel("お知らせのタイトル").fill(newsTitle);
  await page
    .getByLabel("お知らせの本文")
    .fill("10時に集合します。\n持ち物を確認してください。");
  await page
    .getByRole("button", { name: "お知らせを保存", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: newsTitle, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("portal.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "アプリの構造" })
    .getByRole("button", { name: `♧ ${name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "記録を追加", exact: true }).click();
  await page.getByLabel("内容", { exact: true }).fill("買い物");
  await page.getByLabel("数量", { exact: true }).fill("2");
  await page.getByLabel("単価", { exact: true }).fill("150");
  await page.getByRole("checkbox", { name: "あおい", exact: true }).check();
  await page.getByRole("checkbox", { name: "家族", exact: true }).check();
  await page.getByRole("checkbox", { name: "買い物", exact: true }).check();
  await expect(page.getByLabel("合計", { exact: true })).toHaveValue("300");
  await expect(page.getByLabel("合計", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await page.screenshot({
    path: testInfo.outputPath("record-form.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await page.getByRole("button", { name: "記録1を開く", exact: true }).click();
  await page.getByLabel("担当者", { exact: true }).selectOption("aoi");
  await page.getByRole("button", { name: "担当者を保存", exact: true }).click();
  await page.getByRole("button", { name: "記録1を開く", exact: true }).click();
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "完了", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "アプリの構造" })
    .getByRole("button", { name: `♧ ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "完了", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "あおい", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "記録1を再利用", exact: true })
    .click();
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("重複");
  await expect(page.getByLabel("内容", { exact: true })).toHaveValue("買い物");
  await page.screenshot({
    path: testInfo.outputPath("duplicate.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "項目を編集", exact: true }).click();
  await page
    .getByText("ユーザー・組織・グループの候補", { exact: true })
    .click();
  await page.getByText("状態と担当者の設定", { exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("settings.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
