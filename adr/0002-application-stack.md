---
id: ADR-002
status: proposed
date: 2026-09-06
---

# アプリケーションの技術構成

## 確定している制約

TypeScriptとCloudflare Workersを使う。INT-001（非公開intent） に基づく。以下のフレームワーク構成は提案であり、未実装。

## 提案

HonoをAPIに、React + ViteをUIに使い、Cloudflare Vite pluginでWorkersとフロントエンドを開発・ビルドする。初期候補はReact SPAと同一オリジンのAPIを一つのWorkerで配信する構成。

HonoはWeb標準のRequest/Responseを中心に扱い、Workers向けの公式導入手順を持つ。CloudflareはReact + ViteとAPI Workerを組み合わせる公式ガイドを提供している。これらは構成の実現可能性の根拠であり、formaでの動作確認の代わりにはならない。

## 比較とトレードオフ

| 候補 | 利点 | 留意点 |
| --- | --- | --- |
| Hono + React SPA | APIとUIの責務を分けやすく、Workers向けの導入経路がある | ルーティング、認証、データ取得の設計が別途必要 |
| Workersのfetchハンドラー + React SPA | バックエンドのフレームワーク依存を減らせる | エンドポイントが増えるとルーティングや共通処理の整理が必要 |
| React Routerなどのフルスタック構成 | Cloudflareが公式の導入経路を提供している | SSRや統合されたデータ取得が今回必要かを先に判断する必要がある |

初期段階ではフレームワークの人気順位を採用根拠にせず、Workersへの適合性とformaの要件で比較する。認証、DB、ORM、ファイルストレージは機能範囲が決まってから選ぶ。

## 採択・見直しの条件

PdMによる構成の採択後、最小のUI/API疎通とWorkersでのビルドを確認する。SSRの必要性、データの永続化、認証要件が構成に影響すると判明したら再検討する。

## 一次情報

確認日: 2026-09-06。

- [Hono: Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Cloudflare: React + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare: Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
