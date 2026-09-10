/*
This file tests the slots page: pay table without odds, spinning, showing the win, karma updates, and the karma floor error.
Edit this file when the slots page behavior changes.
Copy a test pattern here when you add tests for another animated page.
*/

import "@testing-library/jest-dom/vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { SlotsPage } from "./SlotsPage";
import { ApiError } from "../shared/api";
import { answerByPath, renderWithAuth } from "../shared/testUtils";

const info = {
  pay_table: [
    { name: "diamonds", label: "💎 💎 💎", multiplier: 50 },
    { name: "two_cherries", label: "🍒 🍒 + any", multiplier: 1 },
  ],
  karma_floor: -50,
};

describe("SlotsPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("shows the payouts but never the odds or that players lose", async () => {
    answerByPath(postJson, { "/slots/info": () => info });
    const { container } = renderWithAuth(<SlotsPage />);
    expect(await screen.findByText("50×")).toBeInTheDocument();
    expect(screen.getByText(/can't go below -50/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/%/);
    expect(container).not.toHaveTextContent(/payback|lose|always wins/i);
  });

  it("spins, stops on the result, and updates karma", async () => {
    answerByPath(postJson, {
      "/slots/info": () => info,
      "/slots/spin": () => ({ reels: ["💎", "💎", "💎"], win: "diamonds", multiplier: 50, payout: 250, karma: 245 }),
    });
    const { auth } = renderWithAuth(<SlotsPage />);
    await userEvent.click(screen.getByRole("button", { name: "SPIN" }));

    expect(await screen.findByText("🎉 You won 250 karma!", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledWith("/slots/spin", { stake: 5 });
    expect(auth.setKarma).toHaveBeenCalledWith(245);
    expect(within(screen.getByTestId("reels")).getAllByText("💎")).toHaveLength(3);
    expect(within(screen.getByTestId("spin-history")).getByText("+245")).toBeInTheDocument();
  });

  it("shows a neutral message when a spin does not win", async () => {
    answerByPath(postJson, {
      "/slots/info": () => info,
      "/slots/spin": () => ({ reels: ["🍋", "🔔", "⭐"], win: null, multiplier: 0, payout: 0, karma: -5 }),
    });
    renderWithAuth(<SlotsPage />);
    await userEvent.click(screen.getByRole("button", { name: "SPIN" }));
    expect(await screen.findByText("No win this time.", {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it("shows the karma floor error", async () => {
    answerByPath(postJson, {
      "/slots/info": () => info,
      "/slots/spin": () => {
        throw new ApiError(400, "not_enough_karma", "Not enough karma. Your karma can't go below -50.");
      },
    });
    renderWithAuth(<SlotsPage />);
    await userEvent.click(screen.getByRole("button", { name: "SPIN" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not enough karma.");
    expect(screen.getByRole("button", { name: "SPIN" })).toBeEnabled();
  });
});
