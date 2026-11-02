import type { ReactNode } from "react";

/** Page header: a small context line, a two tone title, one line of detail and the page's actions. */
export function PageHero({ pill, lead, pay, sub, actions }: {
  pill: ReactNode;
  lead: string;
  pay: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-hero">
      <span className="page-hero__pill">{pill}</span>
      <h1><span className="lead-in">{lead}</span> <span className="payoff">{pay}</span></h1>
      {sub && <div className="page-hero__sub">{sub}</div>}
      {actions && <div className="row page-hero__actions">{actions}</div>}
    </header>
  );
}
