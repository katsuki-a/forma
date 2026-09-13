import { test, expect } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createTranslator } from "../../src/localization/index.ts";
import { App } from "../../src/client/app.tsx";
import { createClient } from "../../src/client/api-client.ts";

test("FRM-022 名前の補間をHTMLとして解釈しない", async () => {
  const english = createTranslator("en", {
    "announcements.editNamed": "Edit {{title}}",
  });
  const title = '<img src=x onerror="alert(1)"> {{count}}';
  const label = english.t("announcements.editNamed", { title });
  await render(<button aria-label={label}>{label}</button>);
  await expect
    .element(page.getByRole("button", { name: `Edit ${title}`, exact: true }))
    .toHaveTextContent(`Edit ${title}`);
  expect(document.querySelector("img")).toBeNull();
});

test("FRM-023 入口の説明は具体的な操作を伝える", async () => {
  await render(
    <App client={createClient(() => Promise.resolve(Response.json([])))} />,
  );
  await expect
    .element(
      page.getByText("家族の予定や仲間とのメモをアプリで整理できます。", {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("heading", { name: "アプリはまだありません" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "アプリを作る", exact: true }))
    .toBeEnabled();
});
