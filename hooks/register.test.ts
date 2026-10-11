import { test, expect } from 'claude-code/testing'

test('pane shows MCP and tool call counts on the main agent', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.tool.call({ tool: 'mcp__github__search_code' } as never)
  await $.tool.call({ tool: 'mcp__github__get_pr' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'agent-visualizer',
      surface,
      component: 'Pane',
      props: {} as never,
      requestId: 'agent-visualizer',
    })
    const text = JSON.stringify(await ui.drawn())
    expect(text).toContain('mcp:github×2')
    expect(text).toContain('tool:Bash×1')
  }
})
