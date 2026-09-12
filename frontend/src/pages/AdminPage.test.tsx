/*
This file tests the admin page: the bets waiting for approval, the user list, setting karma, banning, and karma history.
Edit this file when admin user tools or the bet approval queue change.
Copy a test pattern here when you add tests for another admin page.
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

import { AdminPage } from "./AdminPage";
import { answerByPath, makeBet, makeUser, renderWithAuth } from "../shared/testUtils";
import type { AdminUser } from "../shared/types";

const CREATED = "2026-09-01T10:00:00+00:00";
const users: AdminUser[] = [
  { id: 1, username: "admin", email: null, email_confirmed: false, is_admin: true, is_banned: false, karma: 0, created_at: CREATED },
  { id: 2, username: "alice", email: "alice@example.edu", email_confirmed: true, is_admin: false, is_banned: false, karma: -3, created_at: CREATED },
];

async function aliceRow() {
  const email = await screen.findByText("alice@example.edu");
  return within(email.closest("tr") as HTMLElement);
}

describe("AdminPage", () => {
  beforeEach(() => {
    postJson.mockReset();
    answerByPath(postJson, {
      "/admin/users/list": () => ({ users }),
      "/admin/bets/pending": () => ({ bets: [makeBet({ id: 8, title: "Will it snow?", creator_username: "alice", approval: "pending" })] }),
      "/admin/bets/approve": () => ({ bet_id: 8, approval: "approved", email_sent: true }),
      "/admin/bets/decline": () => ({ bet_id: 8, approval: "declined", email_sent: true }),
      "/admin/users/set-karma": () => ({ user_id: 2, karma: 10 }),
      "/admin/users/ban": () => ({ user_id: 2, banned: true }),
      "/admin/users/karma-history": () => ({
        changes: [{ id: 1, delta: -3, karma_after: -3, reason: "slots_stake", ref_id: 4, created_at: CREATED }],
      }),
    });
  });

  it("lists users with their email and status", async () => {
    renderWithAuth(<AdminPage />, { user: makeUser({ is_admin: true }) });
    const row = await aliceRow();
    expect(row.getByText("ok")).toBeInTheDocument();
    expect(row.getByLabelText("Karma for alice")).toHaveValue(-3);
  });

  it("sets karma and bans a user", async () => {
    renderWithAuth(<AdminPage />, { user: makeUser({ is_admin: true }) });
    const row = await aliceRow();
    await userEvent.clear(row.getByLabelText("Karma for alice"));
    await userEvent.type(row.getByLabelText("Karma for alice"), "10");
    await userEvent.click(row.getByRole("button", { name: "Set" }));
    expect(postJson).toHaveBeenCalledWith("/admin/users/set-karma", { user_id: 2, karma: 10 });
    expect(await screen.findByRole("status")).toHaveTextContent("Karma of alice was updated.");

    await userEvent.click(row.getByRole("button", { name: "Ban" }));
    expect(postJson).toHaveBeenCalledWith("/admin/users/ban", { user_id: 2, banned: true });
  });

  it("approves a waiting bet with a note for the creator", async () => {
    renderWithAuth(<AdminPage />, { user: makeUser({ is_admin: true }) });

    expect(await screen.findByRole("heading", { name: "Bets waiting for approval (1)" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Note for the creator (optional)"), "Nice one");
    await userEvent.click(screen.getByRole("button", { name: "Approve and publish" }));

    expect(postJson).toHaveBeenCalledWith("/admin/bets/approve", { bet_id: 8, note: "Nice one" });
    expect(await screen.findByRole("status")).toHaveTextContent('"Will it snow?" was approved and published. @alice got an email.');
  });

  it("declines a waiting bet", async () => {
    renderWithAuth(<AdminPage />, { user: makeUser({ is_admin: true }) });

    await userEvent.click(await screen.findByRole("button", { name: "Decline" }));

    expect(postJson).toHaveBeenCalledWith("/admin/bets/decline", { bet_id: 8, note: "" });
    expect(await screen.findByRole("status")).toHaveTextContent("was declined");
  });

  it("shows the karma history of a user", async () => {
    renderWithAuth(<AdminPage />, { user: makeUser({ is_admin: true }) });
    const row = await aliceRow();
    await userEvent.click(row.getByRole("button", { name: "History" }));
    expect(await screen.findByRole("heading", { name: "Karma history of alice" })).toBeInTheDocument();
    expect(screen.getByText("slots_stake #4")).toBeInTheDocument();
  });
});
