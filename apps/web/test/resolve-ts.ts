// The worker imports siblings without extensions (Vite and wrangler resolve them); Node needs the .ts added.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".") || specifier.endsWith(".ts")) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
