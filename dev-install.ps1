# dev-install.ps1 — Register this repo as the live plugin path for Claude Code
# Run once after cloning. After that, all source changes take effect immediately.
#
# Usage: .\dev-install.ps1

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$pluginsJsonPath = "$env:USERPROFILE\.claude\plugins\installed_plugins.json"

if (-not (Test-Path $pluginsJsonPath)) {
    Write-Host "ERROR: $pluginsJsonPath not found. Is Claude Code installed?" -ForegroundColor Red
    exit 1
}

Write-Host "Repo root: $repoRoot" -ForegroundColor Cyan
Write-Host "Plugins config: $pluginsJsonPath" -ForegroundColor Cyan

# Read current config
$config = Get-Content $pluginsJsonPath -Raw | ConvertFrom-Json -Depth 10

# Find and update web-claude-chat plugin entry
$key = "web-claude-chat@eleven-marketplace"
$entry = $config.plugins.$key

if (-not $entry) {
    Write-Host "ERROR: '$key' not found in installed_plugins.json. Install the plugin first." -ForegroundColor Red
    exit 1
}

$oldPath = $entry[0].installPath
$entry[0].installPath = $repoRoot
$entry[0].lastUpdated = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")

# Save
$config | ConvertTo-Json -Depth 10 | Set-Content $pluginsJsonPath -Encoding UTF8

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  Old path: $oldPath" -ForegroundColor DarkGray
Write-Host "  New path: $repoRoot" -ForegroundColor Green
Write-Host ""
Write-Host "The web-claude-chat plugin now runs directly from this source directory." -ForegroundColor Green
Write-Host "Any changes to server/, web/, skills/ take effect immediately." -ForegroundColor Green
