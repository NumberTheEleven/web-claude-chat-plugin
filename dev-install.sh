#!/usr/bin/env bash
# dev-install.sh — Register this repo as the live plugin path for Claude Code
# Run once after cloning. After that, all source changes take effect immediately.
#
# Usage: bash dev-install.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
PLUGINS_JSON="$HOME/.claude/plugins/installed_plugins.json"

if [ ! -f "$PLUGINS_JSON" ]; then
    echo "ERROR: $PLUGINS_JSON not found. Is Claude Code installed?"
    exit 1
fi

echo "Repo root: $REPO_ROOT"
echo "Plugins config: $PLUGINS_JSON"

# Use node to update JSON (available on all Claude Code installations)
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$PLUGINS_JSON', 'utf-8'));
const key = 'web-claude-chat@eleven-marketplace';
const entry = config.plugins[key];

if (!entry) {
    console.error('ERROR: \"' + key + '\" not found in installed_plugins.json. Install the plugin first.');
    process.exit(1);
}

const oldPath = entry[0].installPath;
entry[0].installPath = '$REPO_ROOT';
entry[0].lastUpdated = new Date().toISOString();

fs.writeFileSync('$PLUGINS_JSON', JSON.stringify(config, null, 2), 'utf-8');

console.log('');
console.log('Done!');
console.log('  Old path:', oldPath);
console.log('  New path:', '$REPO_ROOT');
console.log('');
console.log('The web-claude-chat plugin now runs directly from this source directory.');
console.log('Any changes to server/, web/, skills/ take effect immediately.');
"
