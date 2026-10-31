import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

/** One stable stylesheet for the server rendered pages, built from the same token files. */
function siteCss(): Plugin {
  const files = ["tokens.css", "base.css", "footer.css", "seo.css"].map((f) => path.resolve(__dirname, "src/client/styles", f));
  return {
    name: "lumen-site-css",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "site.css", source: files.map((f) => fs.readFileSync(f, "utf8")).join("\n") });
    },
  };
}

export default defineConfig({
  plugins: [react(), siteCss()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787", "/auth": "http://127.0.0.1:8787", "/mcp": "http://127.0.0.1:8787" },
  },
});
