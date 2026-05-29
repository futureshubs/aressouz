# VAPID kalitlari — Web Push (panel bildirishnomalari)
# Ishlatish: powershell -File scripts/generate-vapid-keys.ps1

$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot

if (-not (Test-Path 'node_modules/web-push')) {
  Write-Host 'web-push o‘rnatilmoqda...'
  npm install web-push --no-save 2>&1 | Out-Null
}

$out = node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log(JSON.stringify(k));"
$keys = $out | ConvertFrom-Json

Write-Host ''
Write-Host '=== Supabase Edge Function (make-server-27d0d16c) ===' -ForegroundColor Cyan
Write-Host "VAPID_PUBLIC_KEY=$($keys.publicKey)"
Write-Host "VAPID_PRIVATE_KEY=$($keys.privateKey)"
Write-Host 'VAPID_SUBJECT=mailto:support@aresso.app'
Write-Host ''
Write-Host '=== Vercel / .env (frontend) ===' -ForegroundColor Cyan
Write-Host "VITE_VAPID_PUBLIC_KEY=$($keys.publicKey)"
Write-Host ''
Write-Host 'Edge function ni qayta deploy qiling. Foydalanuvchilar PWA ni yangilab, «Yoqish» tugmasini bosing.' -ForegroundColor Yellow

Pop-Location
