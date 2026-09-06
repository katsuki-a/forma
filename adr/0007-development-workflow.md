---
id: ADR-007
status: accepted
date: 2026-09-06
---

# 開発時の初期化と標準ツール

## 判断

INT-007に基づき、[ADR-006](0006-storage-and-code-quality.md)の移行・lint・formatの判断を置き換える。アプリと記録の分離、制約・索引・CASとD1 batchの原子性は維持する。APIが集約全体を読み出す限界も変わらない。

開発速度を優先してマイグレーション履歴と旧形式の移行テストを削除し、現行のDDLを`db/schema.sql`だけに定義する。`db:init`は新規のローカルDBに適用する。既存のデータは自動削除しない。製品の定義反映時に既存記録の適合性を確認する契約は、DBのDDL移行とは別であり維持する。

lintはESLintのflat config、typescript-eslintのrecommendedTypeChecked、React公式のHooks recommendedを使う。Prettierは既定値を基本にし、EditorConfigの空白2文字・LFと合わせる。eslint-config-prettierで競合する整形規則を解除し、lintとformatは別のコマンド・CI検査にする。独自の規則セットや全体的な警告抑制は追加しない。

確認時点でtypescript-eslintはTypeScript 6.1未満に対応するため、コンパイラーを対応範囲の6.0.3に固定する。7系専用の構文・APIに依存していないことを型検査・ビルド・既存テストで確認する。未対応peer依存の強制無視はしない。対応範囲が更新されたときに再評価する。

## 一次情報

確認日: 2026-09-06。正確な版はlockfileを参照。

- [typescript-eslintの対応版](https://typescript-eslint.io/users/dependency-versions/)
- [typescript-eslintの型付きlint](https://typescript-eslint.io/getting-started/typed-linting/)
- [React公式のHooks lint](https://react.dev/reference/eslint-plugin-react-hooks)
- [Prettierとlinterの併用](https://prettier.io/docs/integrating-with-linters)

通常のcheckにlint・format・型・文書・API・UI・ビルド・E2Eを含め、D1での初期化・保存・競合・原子性はtest:storageで分離して確認する。
