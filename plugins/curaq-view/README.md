# curaq-view — CuraQ View PoC（Claude Mods / function hooks）

Claude Code から CuraQ の MCP で記事検索したとき、通常のテキスト回答に加えて
**CuraQ の検索結果カードを Claude Code の画面内に描く**ことを検証する PoC。

```
╭────────────────────────────────────────────────╮
│ CuraQ  Search results: "Jev" (3)               │
│                                                │
│  1. DiffusionGemma-as-Jev                      │
│     github.com/example/DiffusionGemma-as-Jev   │
│     AI / Diffusion / Agent                     │
│                                                │
│  2. jev-ultrafast                              │
│     github.com/example/jev-ultrafast           │
╰────────────────────────────────────────────────╯
```

製品実装ではない。Claude Code の function hooks は **EARLY ACCESS**（型定義のヘッダーに明記）で、
リリース間で API が変わりうる。

## 責務分離

| 役割 | 担当 |
|---|---|
| データ取得（検索・認証） | 既存の `curaq` プラグインの Remote MCP（`https://curaq.app/api/v1/mcp`、Bearer 認証） |
| 表示 | このプラグイン（hooks のみ。MCP 設定・スキル・API 呼び出しを持たない） |

このプラグインを外しても `curaq` プラグインは何も変わらない（触っていない）。

## 仕組み

```
Claude ─▶ mcp__curaq__search_articles / semantic_search_articles（既存 MCP）
              │
              ▼ tool.call フック: await next(e) で結果を覗く → 解析して tool_use_id で保持
              │                    （モデルに返す結果は無改変）
              ├─▶ ui.render(ToolUse) : そのツール行を CuraQ カードに置き換える（端末幅を問わない）
              └─▶ $.ui.open('curaq')  : Pane "CuraQ" にも同じカードを描く（144 列以上で自動配置）

Claude ─▶ mcp__curaq-view__show({ title, markdown })（このプラグインが登録するツール）
              └─▶ Pane "CuraQ" に Claude がまとめ直した Markdown を描く（リンクはクリックで開ける）
```

- `hooks/hooks.json` … `{"modules": ["./curaq-view.tsx"]}`（function hooks モジュールの宣言）
- `hooks/curaq-view.tsx` … `register(on)`。`session.start`（`show` ツール登録）・`tool.call`・`ui.render` のフック
- `hooks/parse.ts` … MCP 結果 → 表示用 `{ query, count, articles[{title,url,tags}] }` の純粋関数
- `tests/*.test.ts(x)` … `claude plugin test` で走るテスト（parse と描画）
- `dev/fake-curaq-mcp.mjs` … CuraQ トークンなしで描画を試すための偽 MCP サーバー

対象ツール名は `mcp__plugin_curaq_curaq__*`（プラグイン同梱 MCP）と `mcp__curaq__*`（ユーザー/プロジェクト設定の MCP）の両方。

## ローカルで試す

前提: Claude Code 2.1.278 以降、`curaq` プラグインがインストール済みで API Token が有効なこと
（`claude mcp list` で `curaq … ✔ Connected` になっていること。401 なら
https://curaq.app/settings/access-token でトークンを再発行して設定し直す）。

```bash
git clone git@github.com:curaq/claude-plugins.git ~/projects/claude-plugins
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ~/projects/claude-plugins/plugins/curaq-view
```

起動後に例えば:

> CuraQでAI Agentについて保存した記事を探して

Claude が `search_articles` / `semantic_search_articles` を呼ぶと、ツール行が CuraQ カードになる。
144 列以上の端末では Pane "CuraQ" も開く（`ctrl+x tab` でフォーカス、`ctrl+x x` または Esc で閉じる）。
Claude が結果をまとめ直して `mcp__curaq-view__show` を呼ぶと、Pane はそのまとめ（Markdown）に切り替わる。
Pane には最後に来たもの（検索結果 / まとめ）が出る。

Esc で閉じられるのは、Pane がフォーカスを持っているときか、プロンプトが空で待機中のとき
（入力中・ターン実行中は Esc はプロンプト側の操作になる）。

`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` について: 2.1.278 では function hooks は GrowthBook の
ロールアウトフラグ（`tengu_plugin_hooks_modules`、既定 off）で制御され、この環境変数がそれを上書きする。
手元の環境ではフラグなしでもモジュールがロードされたが、確実に有効化するため付けておく。

### トークンなしで描画だけ確認する（偽 MCP）

```bash
P=~/projects/claude-plugins/plugins/curaq-view
echo "{\"mcpServers\":{\"curaq\":{\"type\":\"stdio\",\"command\":\"node\",\"args\":[\"$P/dev/fake-curaq-mcp.mjs\"]}}}" > /tmp/fake-curaq.json
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir $P --mcp-config /tmp/fake-curaq.json --strict-mcp-config
```

> Call the MCP tool mcp__curaq__search_articles with query=Jev, then list the titles.

### 開発時のチェック

```bash
cd ~/projects/claude-plugins/plugins/curaq-view
claude plugin validate .        # エンジンが読むフック・呼び出しの一覧と拒否されるものを報告
claude plugin test .            # tests/ を実エンジンで実行
# 型定義: Claude Code のセッション内で /plugin-types .claude/types を実行してから
npx -y -p typescript@5 tsc -p tsconfig.json
```

うまく描かれないときは `claude --debug-file /tmp/cc.log …` で起動し、`cc.log` の
`curaq-view` 行（`hooks module … loaded`、`ui.open … placed|waits unplaced`、
`ui.render (...): a hook returned a tree that does not validate`）を見る。

## PoC の制約

- Pane は「プラグインが自発的に開いたもの」扱いのため、144 列未満の端末では配置されない（仕様）。
  インラインのカードは幅を問わず出る
- 検索結果カードは最大 10 件表示でリンクなし。クリックで開けるのは `show` で描いた Markdown のリンク
- `show` の markdown は 10000 文字まで（`Markdown` 要素の上限）。Pane が配置されない幅では `shown: false` を返し、Claude にチャットへ書かせる
- 端末では MCP ツール行は `ToolUse` として描かれ `ToolResult` は raise されない（実機確認）。
  `ToolResult` フックは他 surface 向けの保険
- 状態はセッション内メモリのみ。`/resume` 後の行は `props.output` から再解析する
- 型定義（`.claude/types/`）は `/plugin-types` の生成物で、Claude Code の更新ごとに再生成が要る
