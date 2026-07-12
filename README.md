# CuraQ Claude Plugins

[CuraQ](https://curaq.app)（AI記事キュレーション）の公式Claude Codeプラグインです。
ブラウザを開かずに、ターミナルから記事のおすすめ・今週の学び・おすすめ書籍を利用できます。

## インストール

```
/plugin marketplace add curaq/claude-plugins
/plugin install curaq@curaq
```

インストール時に **CuraQ API Token** の入力を求められます。
トークンは [CuraQの設定画面](https://curaq.app/settings/access-token) で発行できます
（要CuraQアカウント）。

## 使い方

| スキル | 内容 |
|---|---|
| `/curaq:recommend-articles` | 読書傾向に合った記事のおすすめ |
| `/curaq:summarize-week` | 今週読んだ記事からの学びの要約（週1生成） |
| `/curaq:recommend-books` | 読書傾向に基づく書籍レコメンド（週1生成） |

スキルを使わずに「CuraQに保存して」「保存した記事を検索して」のように話しかけても、
接続されたMCPツール（記事の保存・検索・discovery等 計15ツール）が利用できます。

## 仕組み

分析・生成はすべてCuraQのサーバー側（Gemini）で実行済みです。プラグインのスキルは
生成済みの結果を整形表示するだけなので、お使いのClaudeのトークン消費は最小限です。

## License

MIT
