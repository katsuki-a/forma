# 判断と調査の履歴

過去の判断と、その時点で確認できた事実を保存します。現行の製品契約は [spec](../spec/README.md) を参照してください。

- [ADR-001: ドキュメントの責務を分ける](0001-document-harness.md) — accepted
- [ADR-002: アプリケーションの技術構成](0002-application-stack.md) — accepted

- [ADR-003: アプリ定義を作成経路から独立させる](0003-schema-authoring-boundary.md) — proposed
- [ADR-004: 木を情報の構造として表す](0004-tree-design-system.md) — proposed

- [ADR-005: ローカルD1とDB非依存の検証](0005-local-runtime-and-tests.md) — accepted

- [ADR-006: 記録の分離とコード品質の検査](0006-storage-and-code-quality.md) — superseded

- [ADR-007: 開発時の初期化と標準ツール](0007-development-workflow.md) — accepted

## 記録形式

ファイル名は `NNNN-topic.md`、先頭のメタデータは `id: ADR-NNN`、`status:`、`date: YYYY-MM-DD` です。状態は `proposed` / `accepted` / `rejected` / `superseded` を使います。

本文には背景、判断または提案、比較とトレードオフ、根拠リンク、見直す条件を必要な分だけ書きます。調査は確認日と一次情報のURLを付けます。調査結果を採用しても、その資料に列挙した機能や案を一括承認したことにはなりません。

判断が置き換わったら `superseded-by:` に後継のIDを記載し、本文にもリンクを加えます。古い記録の結論を後知恵で書き換えません。
