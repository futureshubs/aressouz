@echo off
REM VAPID kalitlari — PowerShell policy kerak emas
cd /d "%~dp0.."
if not exist "node_modules\web-push" (
  echo web-push o'rnatilmoqda...
  call npm install web-push --no-save
)
echo.
node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log('');console.log('=== Supabase Edge Function ===');console.log('VAPID_PUBLIC_KEY='+k.publicKey);console.log('VAPID_PRIVATE_KEY='+k.privateKey);console.log('VAPID_SUBJECT=mailto:support@aresso.app');console.log('');console.log('=== Vercel / .env ===');console.log('VITE_VAPID_PUBLIC_KEY='+k.publicKey);console.log('');console.log('Private kalitni GitHubga yubormang!');"
echo.
pause
