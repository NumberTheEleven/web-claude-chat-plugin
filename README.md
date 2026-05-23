# Web Claude Chat Plugin

Browser-based chat UI for [Claude Code](https://code.claude.com) sessions. Continue CLI conversations in a rich web interface.

## Features

- **Multi-tab project isolation** — each browser tab works with a different project via URL routing (`/project/<name>/`)
- **Full session history** — browse and search past conversations
- **Markdown rendering** — tables, code blocks with syntax highlighting, lists, blockquotes, headings
- **Todo tracking** — sticky-note style task list in the corner
- **Slash command autocomplete** — type `/` to discover and insert superpowers commands
- **CLI ↔ Web bridge** — `/web-claude-chat` command in CLI opens the same session in browser
- **Zero dependencies** — only Node.js required, no Java, no Spring Boot

## Requirements

- Node.js 18+
- Claude Code

## Commands

| Command | Description |
|---------|-------------|
| `/web-claude-chat start` | Start the server and open browser |
| `/web-claude-chat stop` | Stop the running server |
| `/web-claude-chat` | Open browser to current session |

## Install

```bash
claude plugin install web-claude-chat@eleven-marketplace
```

Or for local development:

```bash
claude plugin install /path/to/web-claude-chat-plugin
```

## How It Works

The plugin starts a local Node.js HTTP server on a free port (50000–60000 range). The server:

1. Serves the web UI (HTML/CSS/JS)
2. Provides REST APIs to read Claude Code session data from `~/.claude/projects/`
3. Bridges WebSocket messages to `claude -p` commands

When you type `/web-claude-chat` in the CLI:

1. The `UserPromptSubmit` hook intercepts the command
2. Reads the server port from `~/.claude/tmp/claude-chat.port`
3. Opens `http://localhost:<port>/project/<project>/?session=<uuid>`
4. The browser loads your full session history via API

## License

MIT
