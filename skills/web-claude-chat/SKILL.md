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

1. Find the server directory:
   ```powershell
   $serverDir = (Get-ChildItem -Recurse "$env:USERPROFILE\.claude\plugins\cache" -Filter "server.mjs" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*claude-chat*" }).DirectoryName | Select-Object -First 1
   if (-not $serverDir) { Write-Error "Plugin not found"; exit 1 }
   ```
2. `cd` to the server directory
3. If `node_modules` doesn't exist, run `npm install`
4. Start the server detached: `Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "server.mjs"`
5. Wait up to 3 seconds for the port file `$env:USERPROFILE\.claude\tmp\claude-chat.port` to appear
6. Read the port from that file
7. Open browser: `Start-Process "http://localhost:<port>/project/<encoded-cwd>/?session=$env:CLAUDE_CODE_SESSION_ID"`
   - Encode cwd: replace `:`, `\`, `/` with `-`

## /web-claude-chat stop

Stops the running chat server.

1. Read port from `$env:USERPROFILE\.claude\tmp\claude-chat.port`
2. Find and kill the Node.js process on that port:
   ```powershell
   $pid = (Get-NetTCPConnection -LocalPort <port> -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
   if ($pid) { Stop-Process -Id $pid -Force }
   ```
3. Remove the port file

## /web-claude-chat (or /web-claude-chat open)

Opens browser to the current session. Server must already be running (use `start` first).

1. Read port from `$env:USERPROFILE\.claude\tmp\claude-chat.port`
2. If port file doesn't exist, say "Server not running. Use /web-claude-chat start to start it."
3. Construct URL: `http://localhost:<port>/project/<encoded-cwd>/?session=$env:CLAUDE_CODE_SESSION_ID`
   - Encode cwd: replace `:`, `\`, `/` with `-`
4. Run `Start-Process "<url>"`
