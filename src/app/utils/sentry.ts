/**
 * Sentry — faqat `VITE_SENTRY_DSN` berilganda yuklanadi (UI va API xatti-harakati o‘zgarmaydi).
 * Chunk alohida — asosiy bundle shart emas.
 */
export function initSentry(): void {
  const dsn = (import.meta as ImportMeta & { env?: { VITE_SENTRY_DSN?: string } }).env
    ?.VITE_SENTRY_DSN;
  if (!dsn || typeof dsn !== "string" || !dsn.trim()) return;

  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: dsn.trim(),
        environment: import.meta.env.MODE,
        tracesSampleRate: import.meta.env.PROD ? 0.08 : 1,
        beforeSend(event) {
          try {
            const req = event.request;
            if (req?.headers) {
              delete (req.headers as Record<string, string>)["Authorization"];
              delete (req.headers as Record<string, string>)["authorization"];
              delete (req.headers as Record<string, string>)["X-Access-Token"];
              delete (req.headers as Record<string, string>)["x-access-token"];
              delete (req.headers as Record<string, string>)["apikey"];
            }
            if (typeof event.request?.url === "string") {
              const u = event.request.url;
              if (/([?&])(access_?token|token|password|secret)=/i.test(u)) {
                event.request.url = u.replace(
                  /([?&])(access_?token|token|password|secret)=[^&]*/gi,
                  "$1$2=[redacted]",
                );
              }
            }
          } catch {
            /* ignore */
          }
          return event;
        },
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.category === "fetch" && breadcrumb.data?.url) {
            const u = String(breadcrumb.data.url);
            if (/access_?token|password|secret=/i.test(u)) {
              return { ...breadcrumb, data: { ...breadcrumb.data, url: "[redacted]" } };
            }
          }
          return breadcrumb;
        },
      });
    })
    .catch(() => {
      /* Sentry moduli yo‘q yoki tarmoq xatosi — ilova ishlashda davom etadi */
    });
}
