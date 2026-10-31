import type { ReactNode } from "react";

/** The landing page's hero, scaled for the app: two tone headline on a surface card, with a
 *  halftone colour panel of floating glossy tiles on the right. */
export function PageHero({ pill, lead, pay, sub, mesh = "mesh-lamp", tiles, children, actions }: {
  pill: ReactNode;
  lead: string;
  pay: string;
  sub?: ReactNode;
  mesh?: "mesh-lamp" | "mesh-iris" | "mesh-mint" | "mesh-sky" | "mesh-peach";
  tiles: [string, ReactNode][]; // [tile class, icon]
  children?: ReactNode; // optional floating card in the art panel
  actions?: ReactNode;
}) {
  const spots = [
    { left: "12%", top: "18%", r: "-8deg", d: "0s", size: "tile--lg" },
    { left: "68%", top: "12%", r: "7deg", d: "-2s", size: "" },
    { left: "74%", top: "62%", r: "-5deg", d: "-4s", size: "tile--lg" },
    { left: "20%", top: "66%", r: "6deg", d: "-1s", size: "" },
  ];
  return (
    <section className="surface page-hero">
      <div className="page-hero__copy">
        <span className="label-pill">{pill}</span>
        <h1><span className="lead-in">{lead}</span> <span className="payoff">{pay}</span></h1>
        {sub && <div className="page-hero__sub">{sub}</div>}
        {actions && <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}>{actions}</div>}
      </div>
      <div className={`page-hero__art halftone ${mesh}`} aria-hidden="true">
        {tiles.slice(0, 4).map(([cls, icon], k) => (
          <span key={k} className="page-hero__float" style={{ left: spots[k].left, top: spots[k].top, ["--r" as string]: spots[k].r }}>
            <span className={`tile ${spots[k].size} ${cls} bob`} style={{ ["--delay" as string]: spots[k].d }}>{icon}</span>
          </span>
        ))}
        {children && <div className="page-hero__card">{children}</div>}
      </div>
    </section>
  );
}
