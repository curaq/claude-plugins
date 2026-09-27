# CuraQ Claude Plugins

[CuraQ](https://curaq.app)（AI記事キュレーション）の公式Claude Codeプラグインです。
ブラウザを開かずに、ターミナルから記事のおすすめ・今週の学び・おすすめ書籍を利用できます。

## インストール

```
/plugin marketplace add curaq/claude-plugins
/plugin install curaq@curaq
```

インストール後、Claude Code で `/mcp` → `plugin:curaq:curaq` → Authenticate を選ぶと
ブラウザでCuraQの同意画面が開きます（要CuraQアカウント）。許可すると接続されます。
接続中のAIは [CuraQの設定画面](https://curaq.app/settings/access-token) で確認・解除できます。

### トークン方式で接続する場合

OAuthを使わずにアクセストークンで接続することもできます。
[CuraQの設定画面](https://curaq.app/settings/access-token) でトークンを発行し、次を実行してください。

```
claude mcp add --transport http curaq https://curaq.app/api/v1/mcp --header "Authorization: Bearer <発行したトークン>"
```

## 使い方

| スキル | 内容 |
|---|---|
| `/curaq:recommend-articles` | 読書傾向に合った記事のおすすめ |
| `/curaq:summarize-week` | 今週読んだ記事からの学びの要約（週1生成） |
| `/curaq:recommend-books` | 読書傾向に基づく書籍レコメンド（週1生成） |

スキルを使わずに「CuraQに保存して」「保存した記事を検索して」のように話しかけても、
接続されたMCPツール（記事・ノートの検索、記事の保存、discovery等）が利用できます。
OAuth接続では記事の削除など削除系のツールは提供されません。

## 仕組み

分析・生成はすべてCuraQのサーバー側（Gemini）で実行済みです。プラグインのスキルは
生成済みの結果を整形表示するだけなので、お使いのClaudeのトークン消費は最小限です。

## License

MIT
