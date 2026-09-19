// CuraQ View PoC — Claude Code function hooks（Claude Mods）モジュール。
//
// 責務分離:
//   CuraQ Remote MCP（curaq プラグイン）= データ取得。このモジュールは一切 API を叩かない。
//   このモジュール                        = presentation のみ。
//
// 流れ:
//   Claude → mcp__…curaq…__search_articles → tool.call フックが next(e) の結果を覗く
//         → 解析結果を tool_use_id で保持（モデルに返す結果は無改変）
//         → ui.render(ToolUse) がそのツール行を CuraQ カードに置き換える（端末幅を問わず出る）
//         → 併せて Pane "CuraQ" を開き、同じカードを描く（144 列以上の端末で自動配置される）
//
//   Claude が検索結果をまとめ直したら mcp__curaq-view__show(markdown) を呼ぶ
//         → Pane "CuraQ" にそのまとめを Markdown で描く（リンクはクリックで開ける）
//
// Pane は最後に来たもの（検索結果 / まとめ）を描く。Esc で閉じられる（closeOnEscape）。
import type { BoxProps, ElementConstructor, Register, RenderElement, TextProps } from 'claude-code';
import { displayUrl, parseSearchResult, type SearchView } from './parse';

// curaq プラグイン同梱の MCP は mcp__plugin_curaq_curaq__<tool>、
// ユーザー/プロジェクト設定の MCP（名前 curaq）は mcp__curaq__<tool> になる。両方拾う。
const SEARCH_TOOL = /^mcp__(plugin_curaq_curaq|curaq)__(semantic_)?search_articles$/;
const SHOW_TOOL_NAME = 'show';
const SHOW_TOOL = 'mcp__curaq-view__show';
const PANE_ID = 'curaq';
const MAX_ROWS = 10;
// Markdown 要素が描ける上限（MarkdownProps.text）
const MAX_MARKDOWN = 10000;

type PaneContent =
  | { kind: 'search'; view: SearchView }
  | { kind: 'markdown'; title: string; markdown: string };

export const register: Register = (on) => {
  // tool_use_id → 解析済み検索結果。ToolResult の requestId は tool_use_id と同じ値
  const views = new Map<string, SearchView>();
  let latest: PaneContent | undefined;

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: SHOW_TOOL_NAME,
      description:
        'CuraQ の記事検索結果を、Claude がまとめ直した Markdown として Claude Code の CuraQ ペインに表示する。' +
        'search_articles / semantic_search_articles の結果をテーマ分けなどで整理して回答するときに使う。' +
        '各記事は [タイトル](URL) のリンクで書く（ペインではクリックで開ける）。' +
        `markdown は ${MAX_MARKDOWN} 文字まで。` +
        '表示できたら、チャットでは同じ一覧を繰り返さず、要点や補足だけを短く返す。' +
        '表示できなかった場合（戻り値が shown: false）は、一覧をチャットに書く。',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'ペインの見出し（例: "AI Agent の保存記事"）' },
          markdown: { type: 'string', description: '表示する Markdown 本文' },
        },
        required: ['markdown'],
      },
    });
    return next(e);
  });

  on('tool.call', { tool: SHOW_TOOL }, async ($, e) => {
    const input = e as { title?: unknown; markdown?: unknown };
    if (typeof input.markdown !== 'string' || input.markdown.length === 0) {
      return { deny: 'markdown が空です' };
    }
    if (input.markdown.length > MAX_MARKDOWN) {
      return { deny: `markdown は ${MAX_MARKDOWN} 文字までです（${input.markdown.length} 文字）` };
    }
    const title = typeof input.title === 'string' && input.title ? input.title : 'CuraQ';
    latest = { kind: 'markdown', title, markdown: input.markdown };
    await $.ui.open({ id: PANE_ID, title: 'CuraQ', closeOnEscape: true }).catch(() => {});
    $.ui.invalidate('ui.render');
    // 144 列未満の端末では Pane が配置されない。モデルにチャットへ書かせる
    const pane = (await $.ui.panes().catch(() => [])).find((p) => p.id === PANE_ID);
    const shown = pane?.isPlaced === true;
    return {
      result: JSON.stringify(
        shown
          ? { shown: true }
          : {
              shown: false,
              reason: '端末幅が足りずペインを表示できません。一覧をチャットに書いてください',
            }
      ),
    };
  });

  on('tool.call', { tool: SEARCH_TOOL }, async ($, e, next) => {
    const r = await next(e);
    try {
      const view = parseSearchResult(r);
      if (view) {
        views.set(e.tool_use_id, view);
        latest = { kind: 'search', view };
        $.ui.log(`curaq-view: ${view.count} articles for "${view.query}"`, { to: 'debug' });
        // 自発的に開く Pane は 144 列未満の端末では描画待ちになる（PaneOpenArgs の仕様）。
        // 開けなくても ToolResult 側のカードは出るので失敗は無視する。
        await $.ui.open({ id: PANE_ID, title: 'CuraQ', closeOnEscape: true }).catch(() => {});
        $.ui.invalidate('ui.render');
      }
    } catch (err) {
      $.ui.log(`curaq-view: parse failed: ${String(err)}`, { to: 'debug' });
    }
    // モデルが読む結果は MCP が返したものそのまま（ref を保ったまま core に返す）
    return r;
  });

  // 端末では MCP ツールの行は ToolUse として描かれ、結果は props.output に
  // content ブロック配列で入る（ToolResult は MCP 行には raise されない — 実機で確認済み）。
  // 実行中・エラー・未解析の行はエンジンの描画に任せる。
  on('ui.render', { component: 'ToolUse', props: { tool: SEARCH_TOOL } }, ($, e, next) => {
    if (e.props.isRunning || e.props.isErrored || e.props.isInterrupted) return next(e);
    // 再開したセッション等で tool.call を経ていない行は props.output から直接読む
    const view = views.get(e.requestId) ?? parseSearchResult(e.props.output);
    if (!view) return next(e);
    return card($.ui.resolve(e), view, e.viewport?.columns, { framed: true });
  });

  // ToolResult を raise する surface 向け（端末以外の保険。描く内容は同じ）
  on('ui.render', { component: 'ToolResult', props: { tool: SEARCH_TOOL } }, ($, e, next) => {
    const view = views.get(e.requestId) ?? parseSearchResult(e.props.output);
    if (!view || e.props.isErrored) return next(e);
    return card($.ui.resolve(e), view, e.viewport?.columns, { framed: true });
  });

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e);
    const { Box, Text, Markdown } = $.ui.resolve(e);
    if (!latest) {
      return (
        <Box paddingX={1}>
          <Text dimColor>CuraQ で記事を検索すると、ここに結果が表示されます</Text>
        </Box>
      );
    }
    if (latest.kind === 'markdown') {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box gap={1}>
            <Text bold color="cyan">
              CuraQ
            </Text>
            <Text>{latest.title}</Text>
          </Box>
          <Box marginTop={1}>
            <Markdown text={latest.markdown} />
          </Box>
        </Box>
      );
    }
    return card($.ui.resolve(e), latest.view, e.props.bodyColumns, { framed: false });
  });
};

// Box と Text はどの surface の表にもある。カードはその2つだけで描く
type CardElements = {
  Box: ElementConstructor<BoxProps>;
  Text: ElementConstructor<TextProps>;
};

function card(
  { Box, Text }: CardElements,
  view: SearchView,
  columns: number | undefined,
  opts: { framed: boolean }
): RenderElement {
  const shown = view.articles.slice(0, MAX_ROWS);
  const rest = view.articles.length - shown.length;
  const frame: BoxProps = opts.framed ? { borderStyle: 'round', borderColor: 'cyan' } : {};
  const width: BoxProps = columns ? { width: Math.min(columns, 100) } : {};

  return (
    <Box flexDirection="column" paddingX={1} {...frame} {...width}>
      <Box gap={1}>
        <Text bold color="cyan">
          CuraQ
        </Text>
        <Text>Search results: "{view.query}"</Text>
        <Text dimColor>({view.count})</Text>
      </Box>
      {shown.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No articles found.</Text>
        </Box>
      ) : (
        shown.map((a, i) => (
          <Box flexDirection="column" marginTop={1}>
            <Box gap={1}>
              <Text dimColor>{String(i + 1).padStart(2)}.</Text>
              <Text bold wrap="truncate-end">
                {a.title}
              </Text>
            </Box>
            {a.url ? (
              <Box paddingLeft={4}>
                <Text dimColor wrap="truncate-end">
                  {displayUrl(a.url)}
                </Text>
              </Box>
            ) : null}
            {a.tags.length ? (
              <Box paddingLeft={4}>
                <Text color="magenta" wrap="truncate-end">
                  {a.tags.join(' / ')}
                </Text>
              </Box>
            ) : null}
          </Box>
        ))
      )}
      {rest > 0 ? (
        <Box marginTop={1}>
          <Text dimColor>… and {rest} more</Text>
        </Box>
      ) : null}
    </Box>
  );
}
