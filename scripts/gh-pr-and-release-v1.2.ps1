# Run from the repository root with GitHub CLI signed in (`gh auth login`).
# After PR is merged: tag v1.2.0, push tag, build installer, then create the GitHub release.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$notesFile = Join-Path $root 'scripts\release-notes-v1.2.md'
$setup = Join-Path $root 'dist\Razer Battery Widget Setup 1.2.0.exe'

if (-not (Test-Path $setup)) {
  Write-Error "Installer not found: $setup — run npm run dist (or dist:fresh) after merging v1.2.0."
}

if (-not (git tag -l 'v1.2.0')) {
  Write-Host '>> git tag v1.2.0'
  git tag -a v1.2.0 -m 'v1.2.0'
  git push origin v1.2.0
} else {
  Write-Host '>> tag v1.2.0 already exists locally; skipped creating it.'
}

Write-Host '>> gh release create v1.2.0'
gh release create v1.2.0 $setup --title 'Razer Battery Widget v1.2.0' --notes-file $notesFile --verify-tag

Write-Host 'Done.'
