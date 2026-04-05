import fs from 'node:fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { publicAnonKey, supabaseUrl } from './utils/supabase/info'

/** Production `dist/sw.js` ga barcha asset URL larni yozadi — PWA oflayn / Lighthouse */
function precacheDistAssetsPlugin(): Plugin {
  const marker = /const BUILD_PRECACHE_URLS = \[\]; \/\/ AUTO-PRECACHE-DIST-ASSETS/

  function collectPrecacheUrls(distDir: string): string[] {
    const out: string[] = []
    const walk = (absDir: string, rel: string) => {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(absDir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const relPath = rel ? `${rel}/${e.name}` : e.name
        const full = path.join(absDir, e.name)
        if (e.isDirectory()) {
          walk(full, relPath)
          continue
        }
        if (e.name === 'sw.js') continue
        if (e.name.endsWith('.map')) continue
        if (!/\.(html|js|css|json|png|svg|jpe?g|webp|ico|woff2?|txt)$/i.test(e.name)) continue
        out.push('/' + relPath.replace(/\\/g, '/'))
      }
    }
    walk(distDir, '')
    return [...new Set(out)].sort()
  }

  return {
    name: 'precache-dist-assets-sw',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist')
      const swFile = path.join(dist, 'sw.js')
      if (!fs.existsSync(swFile)) {
        console.warn('[precache-dist-assets-sw] dist/sw.js topilmadi')
        return
      }
      const urls = collectPrecacheUrls(dist)
      let sw = fs.readFileSync(swFile, 'utf8')
      if (!marker.test(sw)) {
        console.warn('[precache-dist-assets-sw] sw.js da AUTO-PRECACHE marker yo‘q')
        return
      }
      sw = sw.replace(
        marker,
        `const BUILD_PRECACHE_URLS = ${JSON.stringify(urls)}; // AUTO-PRECACHE-DIST-ASSETS`,
      )
      fs.writeFileSync(swFile, sw, 'utf8')
      console.log(`[precache-dist-assets-sw] ${urls.length} ta fayl precache ro‘yxatiga qo‘shildi`)
    },
  }
}

/** Har production build uchun `dist/app-version.json` — DeployUpdateNotifier yangi versiyani yumshoq bildiradi */
function appVersionPlugin(): Plugin {
  let buildId = ''
  return {
    name: 'app-version-json',
    buildStart() {
      buildId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      const file = path.join(outDir, 'app-version.json')
      try {
        fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(file, JSON.stringify({ buildId }), 'utf8')
      } catch (e) {
        console.warn('[app-version-json] dist ga yozilmadi:', e)
      }
    },
  }
}

export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    appVersionPlugin(),
    precacheDistAssetsPlugin(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Bitta React nusxasi — aks holda ba'zi chunklarda "Invalid hook call" / useState null
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    proxy: {
      // Dev-only proxy to avoid browser CORS preflight issues with Supabase Edge Functions.
      // Frontend should call: /functions/v1/make-server-27d0d16c/...
      '/functions/v1': {
        target: supabaseUrl,
        changeOrigin: true,
        secure: true,
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
        },
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Avoid circular chunk graphs: keep large deps in vendor except a few leaf chunks.
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('sonner')) return 'toast';
          if (id.includes('html5-qrcode')) return 'qr';
          if (id.includes('html2canvas')) return 'canvas';
          return 'vendor';
        },
      },
    },
  },
})
