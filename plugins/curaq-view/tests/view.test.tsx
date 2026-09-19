import { expect, test } from 'claude-code/testing';

const PLUGIN = 'curaq-view';
const SURFACES = ['terminal', 'desktop'] as const;

const payload = {
  articles: [
    { id: 'a1', url: 'https://github.com/example/DiffusionGemma-as-Jev', title: 'DiffusionGemma-as-Jev', tags: ['AI', 'Diffusion', 'Agent'] },
    { id: 'a2', url: 'https://github.com/example/jev-ultrafast', title: 'jev-ultrafast', tags: [] },
    { id: 'a3', url: 'https://github.com/example/NewsJack', title: 'NewsJack', tags: [] },
  ],
  count: 3,
  query: 'Jev',
};
const mcpResult = { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false };

test('ToolUse row of a CuraQ search (terminal shape: output is the block array) draws the card', async ($) => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'ToolUse',
      requestId: 'toolu_use_1',
      props: {
        tool_use_id: 'toolu_use_1',
        tool: 'mcp__curaq__search_articles',
        input: { query: 'Jev' },
        isRunning: false,
        isErrored: false,
        isInterrupted: false,
        output: mcpResult.content,
      },
      viewport: { columns: 80, rows: 24 },
    });
    expect(await ui.find({ type: 'Text', text: /Search results: "Jev"/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'DiffusionGemma-as-Jev' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'AI / Diffusion / Agent' })).toBeDefined();
    await ui.unmount();
  }
});

test('ToolUse row still running is left to the engine', async ($, on) => {
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>engine row</Text>;
  });
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_running',
      tool: 'mcp__curaq__search_articles',
      input: { query: 'Jev' },
      isRunning: true,
      isErrored: false,
      isInterrupted: false,
    },
  });
  expect(await ui.find({ type: 'Text', text: 'engine row' })).toBeDefined();
  await ui.unmount();
});

test('ToolResult row of a CuraQ search draws the CuraQ card from props.output', async ($) => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'ToolResult',
      requestId: 'toolu_view_1',
      props: { tool_use_id: 'toolu_view_1', tool: 'mcp__curaq__search_articles', output: mcpResult, isErrored: false },
      viewport: { columns: 120, rows: 40 },
    });
    expect(await ui.find({ type: 'Text', text: 'CuraQ' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Search results: "Jev"/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'DiffusionGemma-as-Jev' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'github.com/example/jev-ultrafast' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'AI / Diffusion / Agent' })).toBeDefined();
    await ui.unmount();
  }
});

test('ToolResult row of another tool is left to the engine', async ($, on) => {
  // テストでは engine の描画が無いので、プラグインの下に座る描画で代用する
  on('ui.render', { component: 'ToolResult' }, ($, e) => {
    const { Text } = $.ui.resolve(e);
    return <Text>engine row</Text>;
  });
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'ToolResult',
      props: { tool_use_id: 'toolu_other', tool: 'mcp__curaq__get_article', output: mcpResult, isErrored: false },
    });
    expect(await ui.find({ type: 'Text', text: 'engine row' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Search results/ })).toBeUndefined();
    await ui.unmount();
  }
});

test('semantic_search_articles from the plugin-bundled MCP name is also matched', async ($) => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolResult',
    props: {
      tool_use_id: 'toolu_sem',
      tool: 'mcp__plugin_curaq_curaq__semantic_search_articles',
      output: mcpResult,
      isErrored: false,
    },
  });
  expect(await ui.find({ type: 'Text', text: 'NewsJack' })).toBeDefined();
  await ui.unmount();
});

test('tool.call hook observes the MCP result and feeds the CuraQ pane', async ($, on) => {
  // MCP サーバーの代わり: プラグインの下に座るフックが検索結果を返す
  on('tool.call', { tool: 'mcp__curaq__search_articles' }, () => ({ result: mcpResult }));

  const r = await $.tool.call({ tool: 'mcp__curaq__search_articles', query: 'Jev', limit: 10 });
  // モデルへ返る結果は無改変
  expect(r.result).toEqual(mcpResult);

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'Pane',
      requestId: 'curaq',
      props: { title: 'CuraQ', isFocused: false, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    });
    expect(await ui.find({ type: 'Text', text: 'DiffusionGemma-as-Jev' })).toBeDefined();
    await ui.unmount();
  }
});

test('show tool draws the model-written markdown in the CuraQ pane', async ($) => {
  const markdown = '**Skills と MCP**\n- [AIエージェントのための検索](https://speakerdeck.com/example/search)';
  const r = await $.tool.call({ tool: 'mcp__curaq-view__show', title: 'AI Agent の保存記事', markdown });
  expect(typeof r.result).toBe('string');

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'Pane',
      requestId: 'curaq',
      props: { title: 'CuraQ', isFocused: false, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    });
    expect(await ui.find({ type: 'Text', text: 'AI Agent の保存記事' })).toBeDefined();
    expect(await ui.find({ type: 'Markdown', text: markdown })).toBeDefined();
    await ui.unmount();
  }
});

test('show tool refuses an empty markdown', async ($) => {
  const r = await $.tool.call({ tool: 'mcp__curaq-view__show', markdown: '' });
  expect(r.deny).toBe('markdown が空です');
});
