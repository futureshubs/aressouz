import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { ErrorBoundary, router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { DeployUpdateNotifier } from './components/DeployUpdateNotifier';
import { installVisibilityRefetchBroadcast } from './utils/visibilityRefetch';
import { initTelegramMiniAppViewport } from './utils/telegramMiniApp';
import { Toaster } from 'sonner';

function ThemeAwareToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      expand={true}
      richColors
      closeButton
      duration={3000}
      offset={{ top: 'var(--app-safe-top)' }}
      mobileOffset={{ top: 'var(--app-safe-top)' }}
    />
  );
}

export default function App() {
  useEffect(() => {
    initTelegramMiniAppViewport();
    // PWA: viewport / theme / Apple meta (manifest + sw — index.html)
    const setViewport = () => {
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
      }
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    };

    // Set theme-color meta tag
    const setThemeColor = () => {
      let themeColor = document.querySelector('meta[name="theme-color"]');
      if (!themeColor) {
        themeColor = document.createElement('meta');
        themeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(themeColor);
      }
      themeColor.setAttribute('content', '#14b8a6');
    };

    // Set apple-mobile-web-app-capable
    const setAppleMeta = () => {
      let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
      if (!appleMeta) {
        appleMeta = document.createElement('meta');
        appleMeta.setAttribute('name', 'apple-mobile-web-app-capable');
        document.head.appendChild(appleMeta);
      }
      appleMeta.setAttribute('content', 'yes');

      let appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!appleStatus) {
        appleStatus = document.createElement('meta');
        appleStatus.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(appleStatus);
      }
      appleStatus.setAttribute('content', 'black-translucent');
    };

    setViewport();
    setThemeColor();
    setAppleMeta();

    // Prevent zoom on double tap (but allow scrolling)
    let lastTouchEnd = 0;
    const preventZoom = (e: TouchEvent) => {
      const now = Date.now();
      const timeSinceLastTouch = now - lastTouchEnd;
      
      // Only prevent if double-tap detected (within 300ms)
      if (timeSinceLastTouch > 0 && timeSinceLastTouch <= 300 && e.cancelable) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // Prevent pinch zoom (2+ fingers)
    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
      }
    };

    // Add event listeners with proper options
    document.addEventListener('touchend', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener('touchend', preventZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
    };
  }, []);

  useEffect(() => {
    return installVisibilityRefetchBroadcast(12_000);
  }, []);

  useEffect(() => {
    const w = window as Window & {
      launchQueue?: { setConsumer: (cb: (params: { targetURL?: string }) => void) => void };
    };
    if (!w.launchQueue?.setConsumer) return;
    w.launchQueue.setConsumer((launchParams) => {
      try {
        const url = launchParams?.targetURL;
        if (!url) return;
        const u = new URL(url);
        if (u.origin === window.location.origin) {
          window.location.href = url;
        }
      } catch {
        /* protocol / launch URL parse */
      }
    });
  }, []);

  // Auth + Theme must wrap RouterProvider so barcha marshrutlar bitta React context bilan ishlaydi
  // (aks holda ayrim chunk/HMR holatlarida useTheme / useAuth "provider yo‘q" deb qulashi mumkin).
  return (
    <>
      <DeployUpdateNotifier />
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider>
            <RouterProvider router={router} />
            <ThemeAwareToaster />
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </>
  );
}