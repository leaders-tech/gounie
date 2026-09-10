/*
This file tests one EPS-bet page: placing wagers, wager errors, revealing outcomes, admin tools, and the discussion.
Edit this file when the bet detail page behavior changes.
Copy a test pattern here when you add tests for another detail page with actions.
*/

import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { BetDetailPage } from "./BetDetailPage";
import { ApiError } from "../shared/api";
import { answerByPath, makeBet, makeUser, renderWithAuth } from "../shared/testUtils";
import type { Bet, BetComment, User, Wager } from "../shared/types";

const HOUR = 60 * 60 * 1000;
const future = () => new Date(Date.now() + HOUR).toISOString();
const past = () => new Date(Date.now() - HOUR).toISOString();

function details(bet: Partial<Bet> = {}, wagers: Wager[] = [], comments: BetComment[] = []) {
  return { bet: makeBet({ id: 4, creator_id: 9, deadline_at: future(), ...bet }), wagers, comments, server_now: new Date().toISOString() };
}

function renderBet(user: User, handlers: Record<string, (body: never) => unknown>) {
  answerByPath(postJson, handlers);
  return renderWithAuth(<BetDetailPage />, { user, path: "/eps-bet/4", routePath: "/eps-bet/:betId" });
}

describe("BetDetailPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("lets other users place a wager and updates their karma", async () => {
    const { auth } = renderBet(makeUser(), { "/bets/get": () => details(), "/bets/wager": () => ({ wager_id: 1, karma: -7 }) });

    expect(await screen.findByRole("heading", { name: "Will it rain?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "NO" }));
    await userEvent.clear(screen.getByLabelText("Stake (karma)"));
    await userEvent.type(screen.getByLabelText("Stake (karma)"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Place bet" }));

    await waitFor(() => expect(postJson).toHaveBeenCalledWith("/bets/wager", { bet_id: 4, side: "no", amount: 7 }));
    expect(auth.setKarma).toHaveBeenCalledWith(-7);
  });

  it("shows wager errors such as the karma floor", async () => {
    renderBet(makeUser(), {
      "/bets/get": () => details(),
      "/bets/wager": () => {
        throw new ApiError(400, "not_enough_karma", "Not enough karma. Your karma can't go below -50.");
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Place bet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not enough karma.");
  });

  it("does not let the creator bet before the deadline", async () => {
    renderBet(makeUser({ id: 9, username: "carol" }), { "/bets/get": () => details() });
    expect(await screen.findByText(/so you can't bet on it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Place bet" })).not.toBeInTheDocument();
  });

  it("lets the creator reveal the outcome after the deadline", async () => {
    renderBet(makeUser({ id: 9, username: "carol" }), { "/bets/get": () => details({ deadline_at: past() }), "/bets/resolve": () => ({}) });
    await userEvent.click(await screen.findByRole("button", { name: "It was YES" }));
    expect(postJson).toHaveBeenCalledWith("/bets/resolve", { bet_id: 4, outcome: "yes" });
  });

  it("shows your wager and payout on a closed bet", async () => {
    const wager: Wager = { id: 1, bet_id: 4, user_id: 2, username: "alice", side: "yes", amount: 10, payout: 20, created_at: "2026-09-01T10:00:00+00:00" };
    renderBet(makeUser(), { "/bets/get": () => details({ status: "resolved", outcome: "yes", deadline_at: past() }, [wager]) });
    expect(await screen.findByText(/You got 20 karma back/)).toBeInTheDocument();
    expect(screen.getByText("got back 20")).toBeInTheDocument();
  });

  it("shows the discussion and posts a message", async () => {
    const comment: BetComment = { id: 1, bet_id: 4, author_id: 3, author_username: "bob", text: "No chance", created_at: "2026-09-01T10:00:00+00:00" };
    renderBet(makeUser(), { "/bets/get": () => details({}, [], [comment]), "/bets/comment": () => ({ comment }) });
    expect(await screen.findByText("No chance")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Your message"), "I disagree");
    await userEvent.click(screen.getByRole("button", { name: "Post message" }));
    expect(postJson).toHaveBeenCalledWith("/bets/comment", { bet_id: 4, text: "I disagree" });
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("gives admins resolve, cancel, and comment delete tools", async () => {
    const comment: BetComment = { id: 8, bet_id: 4, author_id: 3, author_username: "bob", text: "rude", created_at: "2026-09-01T10:00:00+00:00" };
    renderBet(makeUser({ id: 1, username: "admin", is_admin: true }), {
      "/bets/get": () => details({}, [], [comment]),
      "/admin/bets/cancel": () => ({}),
      "/admin/comments/delete": () => ({}),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Cancel and refund" }));
    expect(postJson).toHaveBeenCalledWith("/admin/bets/cancel", { bet_id: 4 });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(postJson).toHaveBeenCalledWith("/admin/comments/delete", { id: 8 });
  });
});
