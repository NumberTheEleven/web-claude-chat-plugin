---
name: web-claude-chat
description: Open current CLI session in the browser-based chat UI. Use when user wants to switch from terminal to web interface, start the chat server, or stop it.
argument-hint: "[start|stop|open]"
allowed-tools: [Bash]
---

# Web Claude Chat

Browser-based chat UI for Claude Code sessions. Three sub-commands:

## /web-claude-chat start

Starts the chat server on a free port and opens the browser.

0. **Check if already running first:**
   - Read port from `$USERPROFILE/.claude/tmp/claude-chat.port` if it exists
   - If the file exists, curl `http://localhost:<port>/` — if it returns 200, skip steps 1-6 and go straight to step 7 (open browser)
1. The server directory is at `<plugin_cache>/eleven-marketplace/web-claude-chat/0.1.0/server/` (resolve from this skill's own path: the SKILL.md is at `<plugin_cache>/eleven-marketplace/web-claude-chat/0.1.0/skills/web-claude-chat/SKILL.md`, so `../../server/` relative to this file)
2. `cd` to the server directory
3. If `node_modules` doesn't exist, run `npm install`
4. Start the server as a background task via Bash with `run_in_background: true`: `node server.mjs`
5. Wait up to 3 seconds for the port file `$USERPROFILE/.claude/tmp/claude-chat.port` to appear
6. Read the port from that file
7. Open browser: `powershell -NoProfile -Command "Start-Process 'http://localhost:<port>/project/<encoded-cwd>/?session=$CLAUDE_CODE_SESSION_ID'"`
   - Encode cwd: replace `:`, `\`, `/` with `-`

## /web-claude-chat stop

Stops the running chat server.

1. Read port from `$USERPROFILE/.claude/tmp/claude-chat.port` — if file doesn't exist, say "Server not running."
2. Find and kill the Node.js process on that port:
   ```powershell
   $owner = (Get-NetTCPConnection -LocalPort <port> -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
   if ($owner) { Stop-Process -Id $owner -Force }
   ```
3. Remove the port file: `rm "$USERPROFILE/.claude/tmp/claude-chat.port"`

## /web-claude-chat (or /web-claude-chat open)

Opens browser to the current session. If server is not running, auto-starts it first.

1. **Check if server is already running:**
   - Read port from `$USERPROFILE/.claude/tmp/claude-chat.port` if it exists
   - If the file exists, curl `http://localhost:<port>/` — if it returns 200, skip to step 3 (open browser)
2. **Auto-start (server not running or dead):**
   - Resolve the server directory from this skill's own path: the SKILL.md is at `<plugin_cache>/eleven-marketplace/web-claude-chat/0.1.0/skills/web-claude-chat/SKILL.md`, so `../../server/` relative to this file
   - `cd` to the server directory
   - If `node_modules` doesn't exist, run `npm install`
   - Start the server as a background task via Bash with `run_in_background: true`: `node server.mjs`
   - Wait up to 3 seconds for the port file `$USERPROFILE/.claude/tmp/claude-chat.port` to appear
   - Read the port from that file
3. **Open browser:**
   - Construct URL: `http://localhost:<port>/project/<encoded-cwd>/?session=$CLAUDE_CODE_SESSION_ID`
     - Encode cwd: replace `:`, `\`, `/` with `-`
   - Run `powershell -NoProfile -Command "Start-Process '<url>'"`
