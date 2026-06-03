import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Sur Vercel (ou tout hébergeur non-Cloudflare), on désactive le plugin
// Cloudflare Workers et on construit un SPA pur. Le runtime serveur
// Cloudflare reste utilisé pour le déploiement Lovable / Cloudflare.
//
// Important : on force la "shell page" SPA à être écrite directement
// dans `dist/client/index.html` (outputPath '/'), pour que Vercel puisse
// servir `index.html` comme fallback de TOUTES les routes côté client.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  tanstackStart: {
    server: { entry: "server" },
    spa: isVercel
      ? {
          enabled: true,
          maskPath: "/",
          prerender: { outputPath: "/" },
        }
      : undefined,
  },
});
