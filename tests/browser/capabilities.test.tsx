import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createClient } from "../../src/client/api-client.ts";
import { App } from "../../src/client/app.tsx";
import { createApi } from "../../src/server/api.ts";
import { memoryRepository } from "../../src/server/memory-repository.ts";
import { capabilityDefinition } from "../fixtures/capabilities.ts";

function client() {
  const api = createApi(memoryRepository());
  return createClient(
    async (input, init) => api.request(new Request(input, init)),
    "http://localhost",
  );
}

test("FRM-013/014/015/017 記録入力で候補名と計算結果を確認し、重複・状態を操作する", async () => {
  const api = client();
  const app = await api.create(capabilityDefinition);
  await api.publish(app.id, app.revision);
  await render(<App client={api} />);
  await page
    .getByRole("navigation", { name: "アプリの構造" })
    .getByRole("button", { name: "♧ 共有する用事", exact: true })
    .click();
  await page.getByRole("button", { name: "記録を追加", exact: true }).click();
  await page.getByLabelText("内容", { exact: true }).fill("買い物");
  await page.getByLabelText("数量", { exact: true }).fill("2");
  await page.getByLabelText("単価", { exact: true }).fill("150");
  await expect
    .element(page.getByLabelText("合計", { exact: true }))
    .toHaveValue("300");
  await expect
    .element(page.getByLabelText("合計", { exact: true }))
    .toHaveAttribute("readonly");
  await page.getByRole("checkbox", { name: "あおい", exact: true }).click();
  await page.getByRole("checkbox", { name: "家族", exact: true }).click();
  await page.getByRole("checkbox", { name: "買い物", exact: true }).click();
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await expect
    .element(page.getByRole("cell", { name: "あおい", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("cell", { name: "300", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "記録1を開く" }).click();
  await page.getByLabelText("担当者", { exact: true }).selectOptions("aoi");
  await page.getByRole("button", { name: "担当者を保存", exact: true }).click();
  await page.getByRole("button", { name: "記録1を開く" }).click();
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  await expect
    .element(page.getByRole("cell", { name: "完了", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "記録1を再利用" }).click();
  await page.getByRole("button", { name: "記録を保存", exact: true }).click();
  await expect.element(page.getByRole("alert")).toMatchTextContent("重複");
  await expect
    .element(page.getByLabelText("内容", { exact: true }))
    .toHaveValue("買い物");
});

test("FRM-013/014/015/017 項目編集でuniqueと式・候補・状態を設定して反映する", async () => {
  const api = client();
  const app = await api.create(capabilityDefinition);
  await render(<App client={api} />);
  await page
    .getByRole("navigation", { name: "アプリの構造" })
    .getByRole("button", { name: "♧ 共有する用事", exact: true })
    .click();
  await page.getByRole("button", { name: "項目を編集", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "内容の重複を禁止する" }))
    .toBeChecked();
  await page.getByRole("checkbox", { name: "内容の重複を禁止する" }).click();
  await page.getByLabelText("項目4の計算式").fill("[quantity] * [price] + 10");
  await page
    .getByText("ユーザー・組織・グループの候補", { exact: true })
    .click();
  await page.getByLabelText("ユーザー1の名前").fill("あおいさん");
  await page.getByText("状態と担当者の設定", { exact: true }).click();
  await page.getByLabelText("状態2の名前").fill("終了");
  await page.getByRole("button", { name: "変更を反映", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "記録を追加", exact: true }))
    .toBeVisible();
  const saved = await api.get(app.id);
  expect(saved.published?.fields[0].unique).toBe(false);
  expect(saved.published?.fields[3].formula).toBe("[quantity] * [price] + 10");
  expect(saved.published?.directory?.users[0].name).toBe("あおいさん");
  expect(saved.published?.workflow?.states[1].name).toBe("終了");
});

test("FRM-018 ポータルのお知らせを登録・編集・削除する", async () => {
  await render(<App client={client()} />);
  await page
    .getByRole("button", { name: "お知らせを追加", exact: true })
    .click();
  await page.getByLabelText("お知らせのタイトル").fill("週末の予定");
  await page
    .getByLabelText("お知らせの本文")
    .fill("10時に集合\n玄関で待ち合わせ");
  await page
    .getByRole("button", { name: "お知らせを保存", exact: true })
    .click();
  await expect
    .element(page.getByRole("heading", { name: "週末の予定", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "週末の予定を編集" }).click();
  await page.getByLabelText("お知らせのタイトル").fill("更新した予定");
  await page
    .getByRole("button", { name: "お知らせを保存", exact: true })
    .click();
  await page.getByRole("button", { name: "更新した予定を削除" }).click();
  await page.getByRole("button", { name: "お知らせの削除を確定" }).click();
  await expect
    .element(page.getByText("お知らせはまだありません。", { exact: true }))
    .toBeVisible();
});
