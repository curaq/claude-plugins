import { expect, test } from 'claude-code/testing';
import { displayUrl, parseSearchResult } from '../hooks/parse';

// CuraQ本体 src/features/mcp/remote/server.ts の ok() が返す形をそのまま再現
const payload = {
  articles: [
    {
      id: 'a1',
      url: 'https://github.com/example/DiffusionGemma-as-Jev',
      title: 'DiffusionGemma-as-Jev',
      summary: '…',
      tags: ['AI', 'Diffusion', 'Agent'],
      reading_time_minutes: 5,
      content_type: 'article',
      read_at: '2026-09-01T00:00:00Z',
    },
    { id: 'a2', url: 'https://github.com/example/jev-ultrafast', title: 'jev-ultrafast', tags: [] },
    { id: 'a3', url: 'https://github.com/example/NewsJack', title: 'NewsJack', tags: null },
  ],
  count: 3,
  query: 'Jev',
};
const mcpResult = { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false };

test('parses the MCP CallToolResult shape (props.output / result)', async () => {
  const view = parseSearchResult(mcpResult);
  expect(view?.query).toBe('Jev');
  expect(view?.count).toBe(3);
  expect(view?.articles.map((a) => a.title)).toEqual(['DiffusionGemma-as-Jev', 'jev-ultrafast', 'NewsJack']);
  expect(view?.articles[0]?.tags).toEqual(['AI', 'Diffusion', 'Agent']);
  expect(view?.articles[2]?.tags).toEqual([]);
});

test('parses a bare content-block array (terminal ToolUse props.output)', async () => {
  const view = parseSearchResult(mcpResult.content);
  expect(view?.query).toBe('Jev');
  expect(view?.articles.length).toBe(3);
});

test('parses what tool.call next() resolves to ({ result, text })', async () => {
  const view = parseSearchResult({ ref: 1, result: mcpResult, text: JSON.stringify(payload) });
  expect(view?.articles.length).toBe(3);
});

test('parses a bare JSON string and a bare { articles } object', async () => {
  expect(parseSearchResult(JSON.stringify(payload))?.count).toBe(3);
  expect(parseSearchResult(payload)?.count).toBe(3);
});

test('returns undefined for anything that is not a search result', async () => {
  expect(parseSearchResult(undefined)).toBeUndefined();
  expect(parseSearchResult('not json')).toBeUndefined();
  expect(parseSearchResult({ content: [{ type: 'text', text: '{"error":"Invalid token"}' }] })).toBeUndefined();
  expect(parseSearchResult({ deny: 'no' })).toBeUndefined();
});

test('displayUrl strips scheme and trailing slash', async () => {
  expect(displayUrl('https://github.com/foo/bar/')).toBe('github.com/foo/bar');
  expect(displayUrl('http://example.com')).toBe('example.com');
});
