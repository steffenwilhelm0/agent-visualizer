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


const COLORS = { agent: '#58a6ff', subagent: '#79c0ff', mcp: '#3fb950', tool: '#f0883e', edge: '#8b949e', text: '#e6edf3', bg: '#0d1117' }
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Lays the agents out left to right by depth, each with its targets on a ring, and returns SVG markup. */
const drawGraph = (list: Agent[]) => {
  const ROW = 170
  const COL = 250
  const placed = new Map<string, { x: number; y: number; depth: number }>()
  let row = 0
  const place = (a: Agent, depth: number) => {
    placed.set(a.id, { x: 110 + depth * COL, y: 95 + row * ROW, depth })
    row++
    for (const kid of list.filter(k => k.parent === a.id && k.id !== 'main')) place(kid, depth + 1)
  }
  const main = list.find(a => a.id === 'main')
  if (main) place(main, 0)
  for (const a of list) if (!placed.has(a.id) && a.id !== 'main') place(a, 1)

  const maxDepth = Math.max(0, ...[...placed.values()].map(p => p.depth))
  const width = 220 + maxDepth * COL + 60
  const height = Math.max(190, row * ROW + 40)
  const out: string[] = []

  for (const a of list) {
    const at = placed.get(a.id)
    if (!at) continue
    const parent = a.parent ? placed.get(a.parent) : undefined
    if (parent) {
      out.push(
        `<line x1="${parent.x}" y1="${parent.y}" x2="${at.x}" y2="${at.y}" stroke="${COLORS.edge}" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="4 6"/>`,
      )
    }
    const targets = Object.entries(a.targets).sort((x, y) => y[1] - x[1])
    const shown = targets.slice(0, 7)
    shown.forEach(([key, count], i) => {
      const angle = (Math.PI * 2 * i) / Math.max(shown.length, 1) - Math.PI / 2 + 0.4
      const tx = at.x + Math.cos(angle) * 72
      const ty = at.y + Math.sin(angle) * 62
      const isMcp = key.startsWith('mcp:')
      const color = isMcp ? COLORS.mcp : COLORS.tool
      const label = esc(key.replace(/^(mcp|tool):/, ''))
      out.push(
        `<line x1="${at.x}" y1="${at.y}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${color}" stroke-opacity=".55" stroke-width="${(1 + Math.min(3, Math.log2(1 + count))).toFixed(1)}">` +
          (a.isDone ? '' : `<animate attributeName="stroke-opacity" values=".25;.8;.25" dur="2.4s" repeatCount="indefinite"/>`) +
          `</line>`,
      )
      out.push(
        isMcp
          ? `<rect x="${(tx - 11).toFixed(1)}" y="${(ty - 11).toFixed(1)}" width="22" height="22" rx="5" fill="${COLORS.bg}" stroke="${color}" stroke-width="2.5"><title>${label}: ${count} calls</title></rect>`
          : `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="9" fill="${COLORS.bg}" stroke="${color}" stroke-width="2.5"><title>${label}: ${count} calls</title></circle>`,
      )
      out.push(
        `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="${color}">${count}</text>`,
        `<text x="${tx.toFixed(1)}" y="${(ty + 25).toFixed(1)}" text-anchor="middle" font-size="10" fill="${COLORS.text}">${label.slice(0, 14)}</text>`,
      )
    })
    if (targets.length > shown.length) {
      out.push(`<text x="${at.x}" y="${at.y + 92}" text-anchor="middle" font-size="10" fill="${COLORS.edge}">+${targets.length - shown.length} more</text>`)
    }
    const color = a.id === 'main' ? COLORS.agent : COLORS.subagent
    if (!a.isDone) {
      out.push(
        `<circle cx="${at.x}" cy="${at.y}" r="20" fill="none" stroke="${color}" stroke-width="2"><animate attributeName="r" values="20;38" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite"/></circle>`,
      )
    }
    out.push(
      `<circle cx="${at.x}" cy="${at.y}" r="${a.id === 'main' ? 21 : 16}" fill="${color}" fill-opacity="${a.isDone ? 0.15 : 0.3}" stroke="${color}" stroke-width="3" stroke-opacity="${a.isDone ? 0.45 : 1}"><title>${esc(a.label)}${a.isDone ? ' (done)' : ''}</title></circle>`,
      `<text x="${at.x}" y="${at.y - 30}" text-anchor="middle" font-size="12" font-weight="600" fill="${COLORS.text}" fill-opacity="${a.isDone ? 0.5 : 1}">${esc(a.label.slice(0, 22))}</text>`,
    )
  }

  return {
    width,
    height,
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,system-ui,sans-serif"><rect width="100%" height="100%" rx="10" fill="${COLORS.bg}"/>${out.join('')}</svg>`,
  }
}

export const register: Register = on => {
  let isOpened = false
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agent-graph',
      description: 'Show agents, sub-agents, MCP servers and tools live in a pane',
    })
    await update($, agents, list => (list.some(a => a.id === 'main') ? list : [blank('main', 'main agent')]))
    isOpened = true
    void $.ui.open({ id: PANE, title: 'Agent graph' })

    return next(e)
  })

  on('command.run', { command: 'agent-graph' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agent graph' })

    return { text: 'Agent graph pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (!isOpened) {
      isOpened = true
      void $.ui.open({ id: PANE, title: 'Agent graph' })
    }
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
    const list = await read($, agents)
    if (e.surface !== 'terminal') {
      const { Svg } = $.ui.resolve(e)
      const g = drawGraph(list)
      return <Svg source={g.source} alt={`Agent graph: ${list.length} agents`} width={g.width} height={g.height} isInteractive />
    }
    const { Box, Text } = $.ui.resolve(e)
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
