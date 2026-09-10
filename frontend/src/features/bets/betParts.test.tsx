/*
This file tests the shared EPS-bet helpers: bet phases, status badges, and the pool bar.
Edit this file when bet phase rules or badge labels change.
Copy a test pattern here when you add tests for another small shared helper.
*/

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BetStatusBadge, betPhase, PoolBar } from "./betParts";
import { makeBet } from "../../shared/testUtils";

const NOW = Date.parse("2026-09-10T12:00:00Z");

describe("betParts", () => {
  it("finds the bet phase", () => {
    expect(betPhase({ status: "open", deadline_at: "2026-09-10T13:00:00+00:00" }, NOW)).toBe("betting");
    expect(betPhase({ status: "open", deadline_at: "2026-09-10T11:00:00+00:00" }, NOW)).toBe("waiting");
    expect(betPhase({ status: "refunded", deadline_at: "2026-09-10T13:00:00+00:00" }, NOW)).toBe("closed");
  });

  it("labels resolved and cancelled bets", () => {
    const { rerender } = render(<BetStatusBadge bet={makeBet({ status: "resolved", outcome: "no" })} />);
    expect(screen.getByText("Outcome: NO")).toBeInTheDocument();
    rerender(<BetStatusBadge bet={makeBet({ status: "cancelled" })} />);
    expect(screen.getByText("Cancelled, stakes refunded")).toBeInTheDocument();
  });

  it("shows YES and NO totals", () => {
    render(<PoolBar no={5} yes={15} />);
    expect(screen.getByText("YES · 15 karma")).toBeInTheDocument();
    expect(screen.getByText("NO · 5 karma")).toBeInTheDocument();
  });
});
