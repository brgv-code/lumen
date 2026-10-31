import { createRoot } from "react-dom/client";
import "../../lib/ui.css";
import { applyPageTheme } from "../../lib/theme";
import type { Settings } from "../../lib/types";
chrome.runtime.sendMessage({ type: "GET_SETTINGS" }).then((r: { settings: Settings }) => applyPageTheme(r?.settings?.theme ?? "system")).catch(() => applyPageTheme("system"));
chrome.storage.onChanged.addListener((c) => { const t = c.lumen_settings_v2?.newValue?.theme; if (t) applyPageTheme(t); });
import Panel from "./Panel";
createRoot(document.getElementById("root")!).render(<Panel />);
