export type Agent = {
  id: string
  label: string
  parent?: string
  isDone: boolean
  /** Call counts keyed `mcp:<server>` or `tool:<name>`. */
  targets: Record<string, number>
  startedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-visualizer': { agents: Agent[] }
  }
}
