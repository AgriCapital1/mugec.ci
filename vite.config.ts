import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Sur Vercel (ou tout hébergeur non-Cloudflare), on désactive le plugin
// Cloudflare Workers et on construit un SPA pur. Le runtime serveur
// Cloudflare reste utilisé pour le déploiement Lovable / Cloudflare.
//
// Important : TanStack Start écrit le shell SPA sous `${outputPath}.html`.
// Donc `outputPath: "/index"` produit exactement `dist/client/index.html`,
// que Vercel peut servir comme fallback de TOUTES les routes côté client.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: isVercel
      ? {
          enabled: true,
          maskPath: "/",
          prerender: { outputPath: "/index" },
        }
      : undefined,
  },
});
