/**
 * Mobile keyboard + visual viewport helper.
 *
 * On iOS/Telegram WebApp the layout viewport (100vh/100dvh) can differ from the
 * visible viewport when the on-screen keyboard is open. We expose two CSS vars:
 * - `--app-viewport-height`: visible viewport height in px
 * - `--kb-inset`: estimated keyboard overlap at the bottom in px
 *
 * Consumers should use these vars to set max-heights and bottom paddings.
 */
export function initKeyboardViewportVars(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const root = document.documentElement;
  const vv = window.visualViewport;

  const apply = () => {
    try {
      if (!vv) {
        root.style.setProperty('--app-viewport-height', '100dvh');
        root.style.setProperty('--kb-inset', '0px');
        return;
      }

      // Visible viewport height (excludes keyboard and browser UI overlays).
      const h = Math.max(0, Math.round(vv.height));

      // Keyboard overlap estimate. On iOS, vv.height shrinks and offsetTop may change.
      // Using innerHeight as baseline works better than screen.height.
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0)));

      root.style.setProperty('--app-viewport-height', `${h}px`);
      root.style.setProperty('--kb-inset', `${overlap}px`);
    } catch {
      // Fail open: keep defaults
    }
  };

  apply();

  // VisualViewport events cover most mobile browsers. Fallback to window resize.
  const onResize = () => apply();
  if (vv) {
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
  }
  window.addEventListener('resize', onResize);

  // Re-apply on focus changes (some Android IMEs update late).
  window.addEventListener('focusin', onResize);
  window.addEventListener('focusout', onResize);
}

