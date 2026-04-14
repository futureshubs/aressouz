import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/index.css'
import { printAressoConsoleBrand, silenceAppConsole } from './app/utils/consoleBrand'
import { installClientHardening } from './app/utils/clientHardening'
import { initSentry } from './app/utils/sentry'

printAressoConsoleBrand()
initSentry()
silenceAppConsole()
installClientHardening()

createRoot(document.getElementById('root')!).render(<App />)
  