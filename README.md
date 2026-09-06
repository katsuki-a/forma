# forma

**情報にかたちを。家族と、仲間と。**

formaは、コードを書かずにデータ項目を定義し、自分たちに合うアプリで情報を整理するソフトウェアです。暮らしの記録から仲間とのメモまで、共通の操作で扱えます。

## 実装状況

ローカルで動く基本版です。今回の実装は次を含みます。

- 空のアプリ・テンプレート・既存の定義の複製からの作成。
- 項目の追加・変更・削除、ドラッグ＆ドロップとキーボードで操作できる上下ボタンによる並べ替え。
- 名前・説明・アイコン・テーマ、下書きの保存、入力の動作確認、変更の反映。
- 一行／複数行テキスト、数値、単一／複数選択、日付・時刻・日時、URL・電話番号・メールアドレス。
- 記録の登録・一覧・詳細・編集・削除・再利用・一括削除、番号と作成／更新情報。
- ローカルD1への永続保存。既存記録に適合しない定義の反映を拒否し、同時更新の競合を検出。

認証・複数ユーザーでの共有、ユーザー／組織／グループ参照、計算、重複禁止、状態遷移、お知らせは未実装です。作成者・更新者はローカル利用者を表す固定識別子です。初期仕様全体が完成したという意味ではありません。外部へ公開するサービスとしてはまだ利用できません。

## ローカルで起動する

Node.js 22.14以上の22系とnpmを使います。Cloudflareへのログイン、Docker、リモートDBは不要です。

```sh
npm ci
npm run db:init
npm run dev
```

[ローカル画面](http://127.0.0.1:3000/)を開きます。APIは127.0.0.1:8787、UIは127.0.0.1:3000で起動します。3000番が使用中の場合は`FORMA_UI_PORT=3002 npm run dev`でUIのポートを変更できます。終了はCtrl+Cです。DBは`.wrangler/`内に保存され、起動し直しても残ります。DBファイルを削除するとローカルデータが失われます。

`npm run dev:api`と`npm run dev:ui`で別々に起動することもできます。共通部品の見本は`npm run dev:design`で確認できます（アプリ本体と同じ3000番ポートのため、同時には起動しません）。

## 検証する

初回はテスト用Chromiumをインストールします。CI/Linuxでは`npx playwright install --with-deps chromium`を使います。

```sh
npm run test:install
npm run check
npm run check:local
```

`check`は外部DBなしでlint・整形・型・文書・非公開情報・デザイン・依存方向、単体/API、実ブラウザーUI、実HTTP E2E、FE/Workerビルドを検証します。`check:local`はこれに非公開intentの承認照合を加えます。公開CIでは非公開資料を使いません。

| コマンド               | 用途                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `npm run lint`         | ESLint・型付きTypeScript・React Hooksの推奨lint            |
| `npm run format:check` | Prettierの整形を変更せず検査                               |
| `npm run format`       | Prettier標準設定でコード・公開文書を整形                   |
| `npm run lint:fix`     | ESLintが提供する自動修正                                   |
| `npm run test:unit`    | ドメイン、通信契約、メモリー保存、依存境界                 |
| `npm run test:ui`      | DB・HTTPサーバーなしのChromium UI検証                      |
| `npm run test:e2e`     | メモリーAPI＋Viteを起動する広い／狭い画面のHTTP検証        |
| `npm run test:watch`   | 単体テストを変更時に再実行                                 |
| `npm run test:storage` | 通常検証と分離したローカルD1保存・制約・原子性・再起動検証 |
| `npm run build`        | FEのビルドとWorkerのdry-run。デプロイはしない              |

UIテストの失敗画像は`.vitest/`、E2Eの結果・画像・失敗トレースは`test-results/`に出力します。どちらもGit対象外です。テスト時間は環境によって変わります。

## 構成

```text
client ─── contracts ◀── domain
  │                        ▲
 HTTP                    Repository
  │                        │
server（Hono） ─────────────┘
  ├─ メモリー（通常テスト）
  └─ D1（ローカル実行・結合テスト）
```

FEはReact＋Vite、BEはHono＋Workersです。通信契約を共有し、FEからサーバー実装を参照しません。手動編集・テンプレート・将来の生成候補は同じ定義と検証を通ります。AIの生成サービスやSDKは未導入です。構成の判断と制約は[ADR-005](adr/0005-local-runtime-and-tests.md)にまとめています。

D1はアプリと記録を別テーブルに保存し、所属・番号の制約と索引を持ちます。可変の定義・入力値にはJSONを使い、未変更の記録は書き直しません。開発段階では旧DBの移行を行わず、`npm run db:init`で新規DBを作ります。既存DBへは実行せず、スキーマ変更後は開発サーバーを停止して`.wrangler/`を退避し、新規DBで起動してください。この変更で検索・ページングは追加しておらず、APIは引き続きアプリ全体を読み出します。[設計と限界](adr/0007-development-workflow.md)を参照してください。

## ドキュメント

- [作業規約](AGENTS.md)
- [現行仕様](spec/README.md)
- [判断と調査の履歴](adr/README.md)
- [デザインシステム](design/README.md)

PdMのintentはローカルの`docs/`に置き、Git管理・公開対象に含めません。

## ライセンス

ライセンスは未設定です。
