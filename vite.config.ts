import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./src/client", import.meta.url)),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.FORMA_UI_PORT ?? 3000),
    strictPort: true,
    proxy: { "/api/": "http://127.0.0.1:8787" },
    fs: {
      deny: [
        "**/docs/**",
        "**/.git/**",
        "**/.env*",
        "**/.dev.vars*",
        "**/*.pem",
        "**/*.key",
      ],
    },
  },
  build: { outDir: "../../dist/client", emptyOutDir: true },
});
