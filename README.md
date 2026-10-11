# agent-visualizer

A Claude Code mod that opens a live pane mapping your session: the main agent, sub-agents (nested under whoever spawned them), and per-agent counts of MCP-server and tool calls. Finished agents dim.

## Install

```
/plugin install agent-visualizer --marketplace steffenwilhelm0/agent-visualizer
```

Then run `/agent-graph` to open the pane.

## What it hooks

`tool.call` (counts `mcp:<server>` and `tool:<name>` per agent), `agent.spawn` (adds sub-agents), `turn.complete` (marks them done), `ui.render` (draws the pane). It only observes; it never changes or blocks a call.
