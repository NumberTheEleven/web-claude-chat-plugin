---
name: web-claude-chat
description: Open current CLI session in the browser-based chat UI. Use when user wants to switch from terminal to web interface, start the chat server, or stop it.
allowed-tools: [Bash]
---

# Web Claude Chat

Browser-based chat UI for Claude Code sessions. Single command — always does the right thing.

## /web-claude-chat

Opens the current session in browser. Auto-starts the server if it's not running.

0. **Auto-detect source vs cache mode:**
   - Check if `$PWD` is the plugin source repo: test if `$PWD/.claude-plugin/plugin.json` exists AND contains `"name": "claude-chat"`.
   - **If $PWD is the plugin source repo** → dev mode:
     - Server directory = `$PWD/server/` (live source)
   - **If $PWD is NOT the plugin source repo** → normal mode:
     - The cache is a git clone of the plugin repo. Pull latest from remote first:
       Run `git -C <plugin-root> fetch origin master && git -C <plugin-root> reset --hard origin/master`. If it fails (no network, etc.), continue with existing cache — it's still functional.
     - Server directory = `../../server/` relative to this SKILL.md (cache, now up-to-date)

1. **Check if server is already running:**
   - Read port from `$USERPROFILE/.claude/tmp/claude-chat.port` if it exists
   - If the file exists, curl `http://localhost:<port>/` — if it returns 200, skip to step 3 (open browser)

2. **Start server (server directory resolved in step 0):**
   - `cd` to the server directory
   - If `node_modules` doesn't exist, run `npm install`
   - Start the server as a background task via Bash with `run_in_background: true`: `node server.mjs`
   - Wait up to 3 seconds for the port file `$USERPROFILE/.claude/tmp/claude-chat.port` to appear
   - Read the port from that file

3. **Open browser:**
   - Construct URL: `http://localhost:<port>/?session=$CLAUDE_CODE_SESSION_ID`
   - Run `powershell -NoProfile -Command "Start-Process '<url>'"`
