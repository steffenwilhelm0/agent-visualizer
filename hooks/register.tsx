import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agent } from '../types'

const PANE = 'agent-visualizer'
const agents = atom({ plugin: 'agent-visualizer', key: 'agents' } as const, [] as Agent[])

const blank = (id: string, label: string, parent?: string): Agent => ({
  id,
  label,
  parent,
  isDone: false,
  targets: {},
  startedAt: Date.now(),
})

const targetOf = (tool: string) =>
  tool.startsWith('mcp__') ? `mcp:${tool.split('__')[1]}` : `tool:${tool}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-graph',
      description: 'Show agents, sub-agents, MCP servers and tools live in a pane',
    })
    await update($, agents, list => (list.some(a => a.id === 'main') ? list : [blank('main', 'main agent')]))

    return next(e)
  })

  on('command.run', { command: 'agent-graph' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agent graph' })

    return { text: 'Agent graph pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? 'main'
    const key = e.tool === 'Agent' ? undefined : targetOf(e.tool)
    if (key) {
      await update($, agents, list => {
        const base = list.some(a => a.id === id) ? list : [...list, blank(id, id)]
        return base.map(a =>
          a.id === id ? { ...a, targets: { ...a.targets, [key]: (a.targets[key] ?? 0) + 1 } } : a,
        )
      })
    }

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.agentId) {
      const sub = blank(started.agentId, e.subagentType, e.parentAgentId ?? 'main')
      await update($, agents, list => [...list.filter(a => a.id !== sub.id), sub].slice(-100))
    }

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      await update($, agents, list => list.map(a => (a.id === id ? { ...a, isDone: true } : a)))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, agents)
    const rows: { depth: number; agent: Agent }[] = []
    const walk = (parent: string | undefined, depth: number) => {
      for (const agent of list.filter(a => (a.parent ?? undefined) === parent && a.id !== 'main')) {
        rows.push({ depth, agent })
        walk(agent.id, depth + 1)
      }
    }
    const main = list.find(a => a.id === 'main')
    if (main) rows.push({ depth: 0, agent: main })
    walk('main', 1)

    const room = Math.max(1, (e.viewport?.rows ?? 24) - 3)
    const shown = rows.slice(0, room)

    return (
      <Box flexDirection="column">
        {shown.length === 0 && <Text dimColor>No agents yet.</Text>}
        {shown.map(({ depth, agent }) => {
          const pad = '  '.repeat(depth)
          const targets = Object.entries(agent.targets)
            .sort((x, y) => y[1] - x[1])
            .map(([k, n]) => `${k}×${n}`)
            .join('  ')
          return (
            <Box flexDirection="column">
              <Text dimColor={agent.isDone} bold>
                {pad}
                {agent.isDone ? '○' : '●'} {agent.label}
              </Text>
              {targets !== '' && (
                <Text dimColor>
                  {pad}  {targets}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
