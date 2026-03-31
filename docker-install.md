# 🐳 Docker O'rnatish Yo'llari

## 📋 Masala
Supabase CLI Docker talab qiladi, lekin o'rnatilmagan.

## 🛠️ Yechim Usullari

### 1. Docker Desktop O'rnatish (Tavsiya)
1. https://www.docker.com/products/docker-desktop ga kiring
2. **Download Docker Desktop for Windows** tugmasini bosing
3. Installer ni yuklab oling
4. O'rnating va kompyuterni restart qiling
5. Docker Desktop ni oching

### 2. WSL2 orqali (Windows 11)
```bash
# PowerShell da
wsl --install
# Restart qiling
```

### 3. Manual O'rnatish
- Windows 10/11 uchun Docker Desktop
- WSL2 talab qilinadi

## ✅ O'rnatgandan Keyin
1. Docker Desktop ni oching
2. Status tekshiring: `docker --version`
3. Qaytadan deploy qiling:
```bash
npx supabase functions deploy make-server-27d0d16c --no-verify-jwt
```

## 🎯 Alternativ (Docker siz)
Agar Docker o'rnatish mumkin bo'lmasa:
1. Supabase Dashboard orqali deploy qiling
2. GitHub Actions bilan CI/CD qo'shing
3. Vercel/Netlify kabi platformalarda deploy qiling

## 📊 Holat
- Backend kod tayyor ✅
- Project mavjud ✅  
- Login qilindi ✅
- Function papkasi bor ✅
- Docker kerak 🔄

**Docker o'rnatib, qaytadan deploy qiling!** 🚀
