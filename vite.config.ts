import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Sur Vercel (ou tout hébergeur non-Cloudflare), on désactive le plugin
// Cloudflare Workers et on construit un SPA pur. Le runtime serveur
// Cloudflare reste utilisé pour le déploiement Lovable / Cloudflare.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  tanstackStart: {
    server: { entry: "server" },
    spa: isVercel ? { enabled: true } : undefined,
  },
});
