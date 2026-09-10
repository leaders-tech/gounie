/*
This file keeps small shared EPS-bet pieces: the bet phase helper, the status badge, and the YES/NO pool bar.
Edit this file when bet phases, status labels, or the pool bar look changes.
Copy a component pattern here when you add another small shared bet display piece.
*/

import type { Bet } from "../../shared/types";

export type BetPhase = "betting" | "waiting" | "closed";

export function betPhase(bet: Pick<Bet, "status" | "deadline_at">, now = Date.now()): BetPhase {
  if (bet.status !== "open") {
    return "closed";
  }
  return new Date(bet.deadline_at).getTime() > now ? "betting" : "waiting";
}

export function BetStatusBadge({ bet }: { bet: Bet }) {
  let label = "Waiting for the outcome";
  let color = "bg-sky-300";
  if (bet.status === "resolved") {
    label = `Outcome: ${bet.outcome === "yes" ? "YES" : "NO"}`;
    color = bet.outcome === "yes" ? "bg-lime-300" : "bg-rose-300";
  } else if (bet.status === "cancelled") {
    label = "Cancelled, stakes refunded";
    color = "bg-stone-200";
  } else if (bet.status === "refunded") {
    label = "Never revealed, stakes refunded";
    color = "bg-stone-200";
  } else if (betPhase(bet) === "betting") {
    label = "Open for bets";
    color = "bg-yellow-300";
  }
  return <span className={`inline-block shrink-0 rounded-full border-2 border-stone-900 px-2 py-0.5 text-xs font-bold ${color}`}>{label}</span>;
}

export function PoolBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const yesPercent = total ? Math.round((yes / total) * 100) : 50;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full border-2 border-stone-900">
        <div className="bg-lime-400" style={{ width: `${yesPercent}%` }} />
        <div className="flex-1 bg-rose-400" />
      </div>
      <div className="mt-1 flex justify-between text-xs font-bold">
        <span>YES · {yes} karma</span>
        <span>NO · {no} karma</span>
      </div>
    </div>
  );
}
