import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

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
  plugins: [mcpPlugin()],
});
