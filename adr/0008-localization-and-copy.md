---
id: ADR-008
status: accepted
date: 2026-09-07
---

# 文字列リソースと日本語の編集

## 背景と判断

画面、契約の入力検証、ドメインのエラー、APIに日本語が直接書かれていた。JSXの語尾と変数、テンプレート文字列で文を組み立てる箇所もあり、語順の異なる翻訳や文言だけの修正が複数層に及んだ。INT-009を実現する実装手段としてi18nextを採用する。

2026-09-07に[i18nextの推奨事項](https://www.i18next.com/principles/best-practices)と[補間](https://www.i18next.com/translation-function/interpolation)、[Zodのエラーと国際化](https://zod.dev/error-customization)を確認した。固定文の断片を合成せず、実行時にしか決まらない名前・件数などを差し込む。Zodの既定の英語文面に依存せず、issueのキーと構造から表示する。

React固有のフックに共有契約を依存させず、独立したlocalization層を各層から参照する。この層からアプリの実装へは参照できない。i18nextの補間・複数形・フォールバックを使い、薄い型付きの関数でキーと引数を限定する。標準ライブラリだけで独自の複数形処理を持つ案より依存は増えるが、言語ごとの規則を実装し直さずに済む。使用版はlockfileで固定する。

エラーの判定用codeを保ち、翻訳キー・値と既定言語のmessageを送る。翻訳済みの文を識別子にしない。エラーに付ける項目名や記録番号も構造化し、翻訳後に表示する。日本語リテラルの混入をESLint、キーと必須引数をTypeScript、翻訳と通信をテストで確認する。依存検査はlocalizationへの参照だけを追加し、サーバー実装やNode依存の禁止は維持する。

## 日本語の参考Skill

2026-09-07のWeb取得では[stop-ai-slop-jp](https://github.com/iKora128/stop-ai-slop-jp)が448 stars、[kgraph57/humanizer-ja](https://github.com/kgraph57/humanizer-ja)と[tqkqt0/humanizer-jp](https://github.com/tqkqt0/humanizer-jp)が各0、[matsutouya/humanizer-ja](https://github.com/matsutouya/humanizer-ja)が1、[gonta223/humanizer-ja](https://github.com/gonta223/humanizer-ja)が139、[chezou/slop-nuki](https://github.com/chezou/slop-nuki)が2だった。検索で確認した候補内で最も多かったstop-ai-slop-jpを参考にした。GitHubの表示は取得時点の情報であり、日本語Skill全体で「最も有名」と証明するものではない。

[SKILL.md](https://github.com/iKora128/stop-ai-slop-jp/blob/main/SKILL.md)の具体的な記述・不要な修飾の削減・断片化の見直しをUIの説明に適用する。記事向けの皮肉・感情・語尾のばらつきはUIには持ち込まない。既存の情報共有という語彙と操作の意味を保つ。句読点の一律禁止や「AIらしさ」の自動採点は導入しない。リポジトリへのSkillの複製・常設インストールは行わず、参考元をここに記録する。

## 境界と見直し

提供言語は日本語のまま。翻訳サービス・切替UI・利用者の入力の自動翻訳は追加していない。初期テンプレートは日本語の利用者データとして生成する。追加言語が採択された時点でReactの言語状態、初期値の評価時期、日時表記、各言語のレビューを検討する。執筆と追加の手順は[文字列リソース](../src/localization/README.md)と[デザインシステム](../design/README.md)を参照する。
