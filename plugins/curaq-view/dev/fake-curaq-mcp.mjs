// Fake "curaq" stdio MCP server: exposes search_articles and answers with the
// exact shape CuraQ's remote server returns ({articles,count,query} as a text block).
// Used only to verify the curaq-view plugin's rendering without a valid CuraQ token.
import { createInterface } from 'node:readline';

const payload = {
  articles: [
    { id: 'a1', url: 'https://github.com/example/DiffusionGemma-as-Jev', title: 'DiffusionGemma-as-Jev', summary: 's', tags: ['AI', 'Diffusion', 'Agent'], reading_time_minutes: 5, content_type: 'article', read_at: '2026-09-01T00:00:00Z' },
    { id: 'a2', url: 'https://github.com/example/jev-ultrafast', title: 'jev-ultrafast', summary: 's', tags: ['Performance'], reading_time_minutes: 3, content_type: 'article', read_at: '2026-09-02T00:00:00Z' },
    { id: 'a3', url: 'https://github.com/example/NewsJack', title: 'NewsJack', summary: 's', tags: [], reading_time_minutes: 4, content_type: 'article', read_at: '2026-09-03T00:00:00Z' },
  ],
  count: 3,
};

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'curaq-fake', version: '0.0.1' } } });
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: [{
      name: 'search_articles',
      description: 'Search your archived articles. Returns {articles, count, query}.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
    }] } });
  } else if (method === 'tools/call') {
    const query = params?.arguments?.query ?? '';
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ...payload, query }) }] } });
  } else if (id !== undefined) {
    send({ jsonrpc: '2.0', id, result: {} });
  }
});
