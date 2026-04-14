import type { Hono } from "npm:hono";
import * as r2 from "../r2-storage.tsx";
import {
  allowedOriginsRequired,
  edgeProductionCorsEnabled,
  isCorsRestricted,
  isHostedSupabaseProject,
  publicTestEndpointDetailed,
} from "../middlewares/cors-security.ts";

/** Health va test-deployment marshrutlari — javoblar `index.ts`dagi bilan identik. */
export function registerHealthRoutes(app: Hono): void {
  app.get("/make-server-27d0d16c/health", (c) => {
    const r2Config = r2.checkR2Config();
    const originsRaw = Boolean(Deno.env.get("ALLOWED_ORIGINS")?.trim());

    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Server ishlamoqda",
      r2: r2Config,
      security: {
        corsRestricted: isCorsRestricted(),
        allowedOriginsConfigured: originsRaw,
        allowedOriginsRequired: allowedOriginsRequired(),
        hostedSupabaseProject: isHostedSupabaseProject(),
        edgeProductionCors: edgeProductionCorsEnabled(),
        corsAllowsWildcard: !originsRaw && !allowedOriginsRequired(),
        publicTestEndpointDetailed: publicTestEndpointDetailed(),
      },
      features: {
        banners: true,
        restaurants: true,
        rentals: true,
        auctions: true,
        bonus: true,
      },
    });
  });

  app.get("/health", (c) => {
    const r2Config = r2.checkR2Config();
    const originsRaw = Boolean(Deno.env.get("ALLOWED_ORIGINS")?.trim());
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Server ishlamoqda",
      r2: r2Config,
      security: {
        corsRestricted: isCorsRestricted(),
        allowedOriginsConfigured: originsRaw,
        allowedOriginsRequired: allowedOriginsRequired(),
        hostedSupabaseProject: isHostedSupabaseProject(),
        edgeProductionCors: edgeProductionCorsEnabled(),
        corsAllowsWildcard: !originsRaw && !allowedOriginsRequired(),
        publicTestEndpointDetailed: publicTestEndpointDetailed(),
      },
      features: {
        banners: true,
        restaurants: true,
        rentals: true,
        auctions: true,
        bonus: true,
      },
    });
  });

  app.get("/make-server-27d0d16c/test-deployment", (c) => {
    if (!publicTestEndpointDetailed()) {
      return c.json({
        success: true,
        ok: true,
        timestamp: new Date().toISOString(),
      });
    }
    return c.json({
      success: true,
      message: "✅ Edge Functions are working!",
      timestamp: new Date().toISOString(),
      endpoints: {
        public: ["/health", "/test-deployment", "/public/branches", "/favorites"],
        auth: ["/auth/sms/send", "/auth/sms/signup", "/auth/sms/signin"],
        user: ["/user/profile", "/upload"],
        products: ["/products", "/foods"],
      },
    });
  });

  app.get("/test-deployment", (c) => {
    if (!publicTestEndpointDetailed()) {
      return c.json({
        success: true,
        ok: true,
        timestamp: new Date().toISOString(),
      });
    }
    return c.json({
      success: true,
      message: "✅ Edge Functions are working!",
      timestamp: new Date().toISOString(),
      endpoints: {
        public: ["/health", "/test-deployment", "/public/branches", "/favorites"],
        auth: ["/auth/sms/send", "/auth/sms/signup", "/auth/sms/signin"],
        user: ["/user/profile", "/upload"],
        products: ["/products", "/foods"],
      },
    });
  });
}
