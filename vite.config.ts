import fs from 'node:fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { publicAnonKey, supabaseUrl } from './utils/supabase/info'

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
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    appVersionPlugin(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
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
