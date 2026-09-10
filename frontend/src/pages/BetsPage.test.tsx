/*
This file tests the EPS-bet list page: grouping bets by phase and creating a new bet.
Edit this file when the bet list or new bet form changes.
Copy a test pattern here when you add tests for another list page with a create form.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { BetsPage } from "./BetsPage";
import { answerByPath, makeBet, renderWithAuth } from "../shared/testUtils";

const HOUR = 60 * 60 * 1000;

describe("BetsPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("groups bets into open, waiting, and closed", async () => {
    answerByPath(postJson, {
      "/bets/list": () => ({
        bets: [
          makeBet({ id: 1, title: "Open one", deadline_at: new Date(Date.now() + HOUR).toISOString() }),
          makeBet({ id: 2, title: "Waiting one", deadline_at: new Date(Date.now() - HOUR).toISOString() }),
          makeBet({ id: 3, title: "Done one", status: "resolved", outcome: "yes", deadline_at: new Date(Date.now() - HOUR).toISOString() }),
        ],
      }),
    });
    renderWithAuth(<BetsPage />);

    expect(await screen.findByRole("heading", { name: "Open for bets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Waiting for the outcome" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Closed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open one/ })).toHaveAttribute("href", "/eps-bet/1");
    expect(screen.getByRole("link", { name: /Done one/ })).toHaveTextContent("Outcome: YES");
  });

  it("creates a bet and opens it", async () => {
    answerByPath(postJson, {
      "/bets/list": () => ({ bets: [] }),
      "/bets/create": () => ({ bet: makeBet({ id: 5 }) }),
    });
    renderWithAuth(
      <Routes>
        <Route element={<BetsPage />} path="/eps-bet" />
        <Route element={<p>Bet page</p>} path="/eps-bet/:betId" />
      </Routes>,
      { path: "/eps-bet" },
    );

    expect(await screen.findByText("No bets yet. Start the first one!")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ New bet" }));
    await userEvent.type(screen.getByLabelText("Question"), "Will it rain?");
    await userEvent.click(screen.getByRole("button", { name: "Create bet" }));

    expect(await screen.findByText("Bet page")).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledWith("/bets/create", {
      title: "Will it rain?",
      description: "",
      deadline_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/),
    });
  });
});
