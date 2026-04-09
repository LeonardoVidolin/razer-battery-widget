# Run from the repository root with GitHub CLI signed in (`gh auth login`).
# Updates PR #1 title/body (already merged; updates GitHub history only) and creates the v1.1.0 release with the installer.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$title = 'Release v1.1.0 — Windows audio, Synapse 3/4 battery fixes, always-on-top'
$bodyFile = Join-Path $root 'scripts\pr-1-body.md'
$notesFile = Join-Path $root 'scripts\release-notes-v1.1.md'
$setup = Join-Path $root 'dist\Razer Battery Widget Setup 1.1.0.exe'

Write-Host '>> gh pr edit 1 (title + description)'
gh pr edit 1 --title $title --body-file $bodyFile

if (-not (Test-Path $setup)) {
  Write-Error "Installer not found: $setup — run npm run dist first."
}

if (-not (git tag -l 'v1.1.0')) {
  Write-Host '>> git tag v1.1.0'
  git tag -a v1.1.0 -m 'v1.1.0'
  git push origin v1.1.0
} else {
  Write-Host '>> tag v1.1.0 already exists locally; skipped creating it.'
}

Write-Host '>> gh release create v1.1.0 (uses existing remote tag v1.1.0)'
gh release create v1.1.0 $setup --title 'Razer Battery Widget v1.1.0' --notes-file $notesFile --verify-tag

Write-Host 'Done.'
