// CuraQ Remote MCP の search_articles / semantic_search_articles の結果を
// 表示用の形に落とす純粋関数。サーバー側は
//   { content: [{ type: 'text', text: JSON.stringify({ articles, count, query }) }] }
// を返す（CuraQ本体 src/features/mcp/remote/server.ts の ok()）。
// フックが受け取る形は経路によって揺れる（tool.call の next() 結果 / ToolResult の
// props.output / テスト時の手書き結果）ので、どの包み方でも同じ JSON に辿り着けるようにする。

export type ArticleView = {
  title: string;
  url: string;
  tags: string[];
};

export type SearchView = {
  query: string;
  count: number;
  articles: ArticleView[];
};

type Unknown = Record<string, unknown>;

const isObject = (v: unknown): v is Unknown => typeof v === 'object' && v !== null;

/** MCP の content ブロック配列から text を連結する */
function textOfBlocks(blocks: unknown): string | undefined {
  if (!Array.isArray(blocks)) return undefined;
  const texts = blocks
    .filter((b): b is Unknown => isObject(b) && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string);
  return texts.length ? texts.join('\n') : undefined;
}

/** 文字列なら JSON として読む。読めなければ undefined */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** { articles, count, query } の形を検証して SearchView にする */
function toSearchView(data: unknown): SearchView | undefined {
  if (!isObject(data) || !Array.isArray(data.articles)) return undefined;
  const articles = data.articles.filter(isObject).map((a) => ({
    title: typeof a.title === 'string' && a.title ? a.title : '(untitled)',
    url: typeof a.url === 'string' ? a.url : '',
    tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string') : [],
  }));
  return {
    query: typeof data.query === 'string' ? data.query : '',
    count: typeof data.count === 'number' ? data.count : articles.length,
    articles,
  };
}

/**
 * 検索結果らしきものを受け取り SearchView を返す。判定順:
 *   1. 文字列 → JSON
 *   2. content ブロック配列そのもの（端末の ToolUse 行の props.output はこの形）
 *   3. { articles } そのもの
 *   4. { content: [...] }（MCP の CallToolResult）
 *   5. { text }（tool.call の next() が返す { result, text }）
 *   6. { result }（さらに包まれている場合）
 * 何にも当たらなければ undefined（フックは next(e) に流す）。
 */
export function parseSearchResult(input: unknown, depth = 0): SearchView | undefined {
  if (depth > 4 || input === undefined || input === null) return undefined;
  if (typeof input === 'string') return toSearchView(parseJson(input));
  if (Array.isArray(input)) {
    const text = textOfBlocks(input);
    return text === undefined ? undefined : toSearchView(parseJson(text));
  }
  if (!isObject(input)) return undefined;
  if (Array.isArray(input.articles)) return toSearchView(input);
  const fromBlocks = textOfBlocks(input.content);
  if (fromBlocks !== undefined) return toSearchView(parseJson(fromBlocks));
  if (typeof input.text === 'string') {
    const v = toSearchView(parseJson(input.text));
    if (v) return v;
  }
  if ('result' in input) return parseSearchResult(input.result, depth + 1);
  return undefined;
}

/** 表示用: "https://github.com/foo/bar" → "github.com/foo/bar" */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
