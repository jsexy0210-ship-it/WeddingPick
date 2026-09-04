param(
  [switch]$Install,
  [switch]$BuildWeb
)

$ErrorActionPreference = 'Stop'

# GitHub Actions 결제/사용 한도와 무관하게 PO가 로컬에서 출시 게이트를 실행한다.
if ($Install) {
  npm ci
}

npm run typecheck
npm run lint
npm test

if ($BuildWeb) {
  npm run export:web --workspace @weddingpick/mobile
  npm run build --workspace @weddingpick/web
}

Write-Host 'Local CI passed. Render 배포 후 /health를 확인하세요.'
