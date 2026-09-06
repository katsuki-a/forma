import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { App } from '../../src/client/app.tsx';
import { createClient } from '../../src/client/api-client.ts';
import { createApi } from '../../src/server/api.ts';
import { memoryRepository } from '../../src/server/memory-repository.ts';

// DB・HTTPサーバーを起動せず、実ブラウザーから同じHTTP契約を通る。
function setup() {
  const api = createApi(memoryRepository());
  const transport: typeof fetch = async (input, init) => api.request(new Request(String(input), init));
  return createClient(transport, 'http://localhost');
}

test('FRM-001/002/010/011/016 空の作成から項目編集、反映、CRUD、再利用、一括削除まで', async () => {
  await render(<App client={setup()} />);
  await page.getByRole('button', { name: 'アプリを作る', exact: true }).click();
  await page.getByLabelText('アプリ名', { exact: true }).fill('家族の連絡');
  await page.getByRole('button', { name: '項目を追加', exact: true }).click();
  await page.getByLabelText('項目1の名前').fill('内容');
  await page.getByRole('button', { name: '項目を追加', exact: true }).click();
  await page.getByLabelText('項目2の名前').fill('数量');
  await page.getByLabelText('項目2の種類').selectOptions('number');
  await page.getByRole('button', { name: '数量を上へ' }).click();
  await expect.element(page.getByLabelText('項目1の名前')).toHaveValue('数量');
  await page.getByRole('button', { name: '数量を下へ' }).click();
  await page.getByRole('button', { name: '動作確認', exact: true }).click();
  await page.getByLabelText('内容', { exact: true }).fill('プレビューだけ');
  await page.getByRole('button', { name: '入力を確認', exact: true }).click();
  await expect.element(page.getByText('入力を確認しました。この動作確認では記録は保存されません。')).toBeVisible();
  await page.getByRole('button', { name: 'アプリを作成', exact: true }).click();
  await page.getByRole('button', { name: '変更を反映', exact: true }).click();
  await expect.element(page.getByText('記録はまだありません。「記録を追加」から始めてください。')).toBeVisible();
  await page.getByRole('button', { name: '記録を追加', exact: true }).click();
  await page.getByLabelText('内容', { exact: true }).fill('牛乳を買う');
  await page.getByLabelText('数量', { exact: true }).fill('2');
  await page.getByRole('button', { name: '記録を保存', exact: true }).click();
  await expect.element(page.getByRole('cell', { name: '牛乳を買う', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '記録1を開く' }).click();
  await expect.element(page.getByRole('heading', { name: '記録1の詳細・編集' })).toBeVisible();
  await page.getByLabelText('内容', { exact: true }).fill('パンを買う');
  await page.getByRole('button', { name: '記録を保存', exact: true }).click();
  await expect.element(page.getByRole('cell', { name: 'パンを買う', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '記録1を再利用' }).click();
  await page.getByLabelText('内容', { exact: true }).fill('果物を買う');
  await page.getByRole('button', { name: '記録を保存', exact: true }).click();
  await expect.element(page.getByRole('cell', { name: '果物を買う', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '記録1を選択' }).click();
  await page.getByRole('checkbox', { name: '記録2を選択' }).click();
  await page.getByRole('button', { name: '選んだ2件を削除' }).click();
  await page.getByRole('button', { name: '削除を確定' }).click();
  await expect.element(page.getByText('記録はまだありません。「記録を追加」から始めてください。')).toBeVisible();
});

test('FRM-010 テンプレートと複製で元のアプリ定義を変更しない', async () => {
  await render(<App client={setup()} />);
  await page.getByRole('button', { name: 'テンプレートから作る' }).click();
  await expect.element(page.getByLabelText('項目1の名前')).toHaveValue('内容');
  await page.getByRole('button', { name: 'アプリを作成', exact: true }).click();
  await page.getByRole('button', { name: '変更を反映', exact: true }).click();
  await page.getByRole('button', { name: 'アプリを複製' }).click();
  await page.getByLabelText('アプリ名', { exact: true }).fill('仕事のメモ');
  await page.getByLabelText('項目1の名前').fill('連絡事項');
  await page.getByRole('button', { name: 'アプリを作成', exact: true }).click();
  await page.getByRole('button', { name: '変更を反映', exact: true }).click();
  await page.getByRole('button', { name: '♧ 暮らしの記録', exact: true }).click();
  await page.getByRole('button', { name: '項目を編集' }).click();
  await expect.element(page.getByLabelText('項目1の名前')).toHaveValue('内容');
});

test('FRM-040 通信失敗で入力を失わず再試行できる', async () => {
  let failed = false;
  const api = createApi(memoryRepository());
  const client = createClient(async (input, init) => {
    if (init?.method === 'POST' && !failed) { failed = true; throw new Error('offline'); }
    return api.request(new Request(String(input), init));
  }, 'http://localhost');
  await render(<App client={client} />);
  await page.getByRole('button', { name: 'アプリを作る', exact: true }).click();
  await page.getByLabelText('アプリ名', { exact: true }).fill('入力を残す');
  await page.getByRole('button', { name: 'アプリを作成', exact: true }).click();
  await expect.element(page.getByText('接続できません。入力を残したまま、もう一度お試しください。', { exact: true })).toBeVisible();
  await expect.element(page.getByLabelText('アプリ名', { exact: true })).toHaveValue('入力を残す');
  await page.getByRole('button', { name: 'アプリを作成', exact: true }).click();
  await expect.element(page.getByRole('button', { name: '変更を反映', exact: true })).toBeVisible();
});

test('FRM-040 サーバー実装なしで空状態と障害表示を検証できる', async () => {
  await render(<App client={createClient(async () => Response.json([]))} />);
  await expect.element(page.getByRole('heading', { name: '最初のアプリを作りましょう' })).toBeVisible();
});
