import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import tailwindStyles from "./style.css?inline";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "manual",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "lumen-root",
      position: "overlay",
      anchor: "body",
      onMount(container, shadow) {
        // Inject Tailwind styles into shadow root
        const style = document.createElement("style");
        style.textContent = tailwindStyles;
        shadow.prepend(style);

        const root = ReactDOM.createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
