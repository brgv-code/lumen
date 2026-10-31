import type { CSSProperties } from "react";
import { colorVar } from "@lumen/core";

/** Inline style for <mark className="hl">: works for palette names and custom hex colours. */
export function hlStyle(color: string | null | undefined): CSSProperties {
  return { ["--hl" as string]: colorVar(color) } as CSSProperties;
}
