---
id: ADR-005
status: accepted
date: 2026-09-06
---

# ローカルD1とDB非依存の検証

## 判断と根拠

INT-005の承認によりHono＋Reactを使い、アプリ作成、項目編集、下書き／反映、記録CRUDを先行実装する。ローカルDBにはD1を使う。Dockerを導入してPostgreSQLを起動する案は、採用済みWorkersと異なるDBの運用を必要とするため今回採用しない。本番DBと認証方式の決定は含まない。

`contracts`はバージョン付き定義、入力・応答の型、構造化エラーを持つ。`domain`は保存インターフェースにだけ依存する。`server`にHonoとD1を置き、`client`は独立したHTTPクライアントを介して通信する。Honoのルーター型やD1型をFEに公開しない。ViteとWranglerを独立して起動・ビルドし、今回Cloudflare Vite pluginは導入しない。依存方向は構文木を使ってimport、export、動的import、型参照まで検査する。

保存はアプリ単位のJSON集約とし、リビジョン付きcompare-and-swapで下書き、反映、記録変更を原子的に扱う。メモリーとD1に同じ保存契約テストを適用する。記録を含む集約全体を読み書きする方式は基本版向けであり、大量データの検索やスケールの保証ではない。ページング、複数ユーザー、権限、移行要件が決まった時点で正規化や分割を検討する。

## 検証の分離

- 通常のcheck: 型、文書、非公開情報、デザイン、依存方向、ドメイン／API／保存契約のVitest、実Chromiumのコンポーネントテスト、FEとWorkerビルド、メモリーAPIのHTTP E2E。
- test:storage: MiniflareのローカルD1で保存契約と再起動後の永続化を確認する。通常のcheckでDBは起動しない。
- 時計・識別子・保存先・通信は差し替え可能。単体テストごとに状態を独立させ、E2Eは固有のアプリを作る。外部の認証・クラウド・業務データを使わない。
- UIは役割とラベルで操作し、自動待機する。固定時間のsleepやComputer Useには依存しない。失敗時の画像とトレースはローカルに保存する。CIに外部アップロードのステップを設けない。

ローカルの起動はloopbackに限定する。認証未実装のWorkerはLOCAL_MODEを明示しない場合503を返す。この値はローカルCLIにだけ渡し、配信用設定へ保存しない。開発モードの明示は認証の実装を意味しない。

## 一次情報

確認日: 2026-09-06。依存の正確な版はlockfileを正とする。

- [Vitest Browser Mode](https://vitest.dev/guide/browser/) — 実ブラウザーのコンポーネント検証とPlaywright provider。
- [Playwright best practices](https://playwright.dev/docs/best-practices) — 利用者に見える振る舞い、テストの分離、role locatorと自動待機。
- [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/) — ローカル実行と永続保存、Miniflareの検証。
- [Miniflare](https://github.com/cloudflare/workers-sdk/tree/main/packages/miniflare) — 導入版の型定義・READMEも確認し、v5のworkers/config/manifestとresourcePersistencePathを使用。
- [Babel parser](https://babeljs.io/docs/babel-parser) — TypeScript/JSX構文解析。TypeScript 7の不安定な構文木APIを境界検査に結び付けない。

画面の画像は広い画面・狭い画面の目視確認資料であり、フォント固定済みのピクセル単位の視覚回帰を保証しない。共有・認証・本番稼働は別途検証が必要。
