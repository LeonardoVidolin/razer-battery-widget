# Executar na raiz do repositório com GitHub CLI autenticado (`gh auth login`).
# Atualiza título/corpo do PR #1 (já mergeado, só histórico no GitHub) e cria a release v1.1.0 com o instalador.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$title = 'Release v1.1.0 — áudio Windows, bateria Synapse 3/4, always-on-top'
$bodyFile = Join-Path $root 'scripts\pr-1-body.md'
$notesFile = Join-Path $root 'scripts\release-notes-v1.1.md'
$setup = Join-Path $root 'dist\Razer Battery Widget Setup 1.1.0.exe'

Write-Host '>> gh pr edit 1 (título + descrição)'
gh pr edit 1 --title $title --body-file $bodyFile

if (-not (Test-Path $setup)) {
  Write-Error "Instalador não encontrado: $setup — rode npm run dist antes."
}

if (-not (git tag -l 'v1.1.0')) {
  Write-Host '>> git tag v1.1.0'
  git tag -a v1.1.0 -m 'v1.1.0'
  git push origin v1.1.0
} else {
  Write-Host '>> tag v1.1.0 já existe; não recriei.'
}

Write-Host '>> gh release create v1.1.0 (usa a tag v1.1.0 já existente no remoto)'
gh release create v1.1.0 $setup --title 'Razer Battery Widget v1.1.0' --notes-file $notesFile --verify-tag

Write-Host 'Concluído.'
