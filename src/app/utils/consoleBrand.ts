/**
 * Loyihadagi `console.*` Vite `esbuild.drop` bilan olib tashlanadi.
 * Faqat shu funksiya `globalThis['console']['log']` orqali chaqiriladi — bunday yozuv drop qilinmaydi.
 * Ranglar: `src/styles/theme.css` (light) — primary #030213, brend aksenti teal.
 */
export function printAressoConsoleBrand(): void {
  if (typeof globalThis === 'undefined') return;
  try {
    const c = globalThis['console'] as Console;
    const log = c['log'] as (...args: unknown[]) => void;
    const accent = '#14b8a6';
    const ink = '#030213';
    log.call(
      c,
      '\n%cARESSO',
      [
        'font-size:112px',
        'line-height:1.02',
        'font-weight:900',
        'letter-spacing:0.14em',
        `color:${accent}`,
        `text-shadow:5px 5px 0 ${ink},0 0 48px rgba(20,184,166,0.45)`,
        'font-family:ui-sans-serif,system-ui,sans-serif',
        'padding:12px 0 8px',
      ].join(';'),
    );
    log.call(
      c,
      '%c ',
      [
        'display:block',
        'margin-top:10px',
        'padding:5px 0',
        'width:min(720px,96vw)',
        'border-radius:8px',
        'background:linear-gradient(90deg,#14b8a6,#6366f1)',
      ].join(';'),
    );
  } catch {
    /* ignore */
  }
}

const noopConsole = (..._args: unknown[]) => {};

/**
 * Brend chiqarilgach `console.log` / `info` / `debug` / `warn` / `error` ni no-op qiladi.
 * Ilova kodi konsolga yozolmaydi; tashqi kutubxonalar (masalan, `telegram-web-app.js`) o‘z loglarini saqlashi mumkin.
 */
export function silenceAppConsole(): void {
  if (typeof globalThis === 'undefined') return;
  try {
    const c = globalThis.console as Console;
    c.log = noopConsole as typeof console.log;
    c.debug = noopConsole as typeof console.debug;
    c.info = noopConsole as typeof console.info;
    c.warn = noopConsole as typeof console.warn;
    c.error = noopConsole as typeof console.error;
  } catch {
    /* ignore */
  }
}
