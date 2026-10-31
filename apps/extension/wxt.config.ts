import { defineConfig } from "wxt";

// `npm run build:store` sets LUMEN_STORE=1: no fixed key (the Chrome Web Store assigns the id and
// rejects a key on first upload) and no localhost origins.
const STORE = process.env.LUMEN_STORE === "1";
const DEV_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjfebb4JAs0K8ouxFm4bwltGuYlOvYdZ/uVfmW3uHrhARynIWqjmQ7TrsM0+7gWuBM1IPSK2+GpG+R6ylCDkpMwIhcHR6HLBbO7e5dZ2cxE80OEPO3vP3MaFWa2uEb47zILzXPveoah9rE4W21HaediTDzS6aGG4oFbC0k0nLHPRvcPNyrA6FCbBAfqU4fxB5cGDxgvJ7Kf+pNex2kTcjysAevUju5JfSF2s/A72GD40bH1ZvWbXir98kSnIFFfOG8JQJOH3XfCagIldqT2xwuoqiy8uQI62YoOTxoHw7yo7HCs1Jd3iirirlu+C9KU+G2wXCieNvfsovr4baG+yn6wIDAQAB";
const SITES = ["https://lumen.brgv95.workers.dev/*"];
const DEV_SITES = ["http://localhost:8787/*", "http://localhost:5173/*"];

export default defineConfig({
  srcDir: "src",
  // keep the store build apart, so the unpacked dev build in .output is never overwritten by it
  outDir: STORE ? ".output-store" : ".output",
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Lumen",
    description: "Highlight, ask and send what you read to Obsidian, Notion or markdown.",
    version: "2.6.0",
    // Unpacked builds keep the id ffjconacpmnbadoeegamifkellcddfja so the dashboard can connect in one click.
    ...(STORE ? {} : { key: DEV_KEY }),
    // The floating panel is the side panel page, framed inside the page by the content script.
    web_accessible_resources: [{ resources: ["sidepanel.html", "chunks/*", "assets/*", "icons/*"], matches: ["<all_urls>"] }],
    externally_connectable: {
      matches: STORE ? SITES : [...SITES, ...DEV_SITES],
    },
    permissions: ["storage", "contextMenus", "alarms", "notifications", "sidePanel", "tabs", "scripting"],
    // only for the local Claude helper; requested when Claude is picked in settings
    optional_permissions: ["nativeMessaging"],
    host_permissions: ["<all_urls>"],
    action: {
      default_popup: "popup.html",
      default_icon: { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
    },
    options_ui: { page: "options.html", open_in_tab: true },
    icons: { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
    commands: {
      "highlight-selection": { suggested_key: { default: "Alt+Shift+H" }, description: "Highlight the selection" },
      "save-page": { suggested_key: { default: "Alt+Shift+S" }, description: "Save this page to Lumen" },
      "open-panel": { suggested_key: { default: "Alt+Shift+L" }, description: "Open the Lumen panel" },
    },
  },
});
