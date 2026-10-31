import type { ReactNode } from "react";
import { BarChart3, Radar, Sparkles } from "lucide-react";
import { useApp } from "./Layout";
import { ProLock } from "../../components/Pro";

const COPY = {
  spark: { name: "Spark", blurb: "Spark turns your highlights into writing ideas with sources.", icon: <Sparkles />, mesh: "mesh-peach" },
  radar: { name: "Radar", blurb: "Radar watches trending stories in the topics you read about.", icon: <Radar />, mesh: "mesh-sky" },
  analytics: { name: "Analytics", blurb: "Twelve weeks of your reading: what you finish, what you read about, and when.", icon: <BarChart3 />, mesh: "mesh-iris" },
} as const;

export function ProGate({ feature, children }: { feature: keyof typeof COPY; children: ReactNode }) {
  const { user } = useApp();
  if (user.pro) return <>{children}</>;
  const c = COPY[feature];
  return <div className="page"><ProLock feature={c.name} blurb={c.blurb} icon={c.icon} mesh={c.mesh} /></div>;
}
