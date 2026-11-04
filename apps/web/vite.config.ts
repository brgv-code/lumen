import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { createRequire } from "node:module";
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

/** pdf.js's character maps, standard fonts and image decoders under /pdfjs/, served from the package in dev and copied on build. */
function pdfjsAssets(): Plugin {
  const root = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  // quickjs runs JavaScript embedded in a PDF, which the reader never turns on.
  const files = ["cmaps", "standard_fonts", "wasm"].flatMap((folder) => fs.readdirSync(path.join(root, folder)).filter((name) => !name.startsWith("quickjs")).map((name) => `${folder}/${name}`));
  return {
    name: "lumen-pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs", (req, res, next) => {
        const file = decodeURIComponent((req.url ?? "").split("?")[0].slice(1));
        if (!files.includes(file)) return next();
        if (file.endsWith(".wasm")) res.setHeader("content-type", "application/wasm");
        res.end(fs.readFileSync(path.join(root, file)));
      });
    },
    generateBundle() {
      for (const file of files) this.emitFile({ type: "asset", fileName: `pdfjs/${file}`, source: fs.readFileSync(path.join(root, file)) });
    },
  };
}

export default defineConfig({
  plugins: [react(), siteCss(), pdfjsAssets()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787", "/auth": "http://127.0.0.1:8787", "/mcp": "http://127.0.0.1:8787" },
  },
});
