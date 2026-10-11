export type Agent = {
  id: string
  label: string
  parent?: string
  isDone: boolean
  /** Call counts keyed `mcp:<server>` or `tool:<name>`. */
  targets: Record<string, number>
  startedAt: number
}

export type LogEntry = { t: number; agent: string; text: string; ms?: number; isError?: boolean }
export type Stats = { calls: number; errors: number; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-visualizer': { agents: Agent[]; log: LogEntry[]; stats: Stats }
  }
}
