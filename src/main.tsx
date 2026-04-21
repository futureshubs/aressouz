import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/index.css'
import { printAressoConsoleBrand, silenceAppConsole } from './app/utils/consoleBrand'
import { installClientHardening } from './app/utils/clientHardening'
import { initSentry } from './app/utils/sentry'
import { initTelegramMiniAppViewport } from './app/utils/telegramMiniApp'
import { initKeyboardViewportVars } from './app/utils/keyboardViewport'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

printAressoConsoleBrand()
initSentry()
silenceAppConsole()
installClientHardening()
// Telegram WebApp safe-area must be applied before first paint
initTelegramMiniAppViewport()
// Mobile keyboard + visual viewport vars (before first paint)
initKeyboardViewportVars()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
  