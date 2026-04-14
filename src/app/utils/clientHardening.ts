/**
 * Prod rejimida umumiy DevTools qisqa tugmalari va sahifa ustidagi o‘ng tugma menyusini cheklaydi.
 * Brauzer menyusi (⋮) orqali DevTools ochish, Network / Sources va boshqa tablar — brauzer nazoratida;
 * bu faqat tasodifiy F12 / Ctrl+Shift+I va hokazo bilan tez ochilishni qiyinlashtiradi.
 */
export function installClientHardening(): void {
  if (!import.meta.env.PROD || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blockDevShortcuts = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;

    const k = e.key;
    if (k === "F12") {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey && e.shiftKey) {
      if (k === "I" || k === "J" || k === "C" || k === "K") {
        e.preventDefault();
        return;
      }
    }

    if (e.metaKey && e.altKey && (k === "I" || k === "J" || k === "C")) {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey && !e.shiftKey && !e.altKey && (k === "u" || k === "U")) {
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", blockDevShortcuts, true);

  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
    },
    true,
  );
}
