/*
This file tests the account page and its change-password form.
Edit this file when account page behavior changes.
Copy a test pattern here when you add tests for another settings form.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { AccountPage } from "./AccountPage";
import { ApiError } from "../shared/api";
import { makeUser, renderWithAuth } from "../shared/testUtils";

async function fill(current: string, next: string, repeat: string) {
  await userEvent.type(screen.getByLabelText("Current password"), current);
  await userEvent.type(screen.getByLabelText("New password"), next);
  await userEvent.type(screen.getByLabelText("Repeat new password"), repeat);
  await userEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("AccountPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("shows the plain avatar, nickname, and karma", () => {
    renderWithAuth(<AccountPage />, { user: makeUser({ username: "alice", karma: 4 }) });
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText(/4 karma/)).toBeInTheDocument();
  });

  it("changes the password", async () => {
    postJson.mockResolvedValue({ changed: true });
    renderWithAuth(<AccountPage />);
    await fill("password1", "newpassword1", "newpassword1");
    expect(await screen.findByRole("status")).toHaveTextContent("Your password was changed.");
    expect(postJson).toHaveBeenCalledWith("/auth/change-password", { old_password: "password1", new_password: "newpassword1" });
  });

  it("shows mismatch and server errors", async () => {
    renderWithAuth(<AccountPage />);
    await fill("password1", "newpassword1", "other");
    expect(screen.getByRole("alert")).toHaveTextContent("New passwords do not match.");

    postJson.mockRejectedValue(new ApiError(400, "wrong_password", "Your current password is wrong."));
    await userEvent.clear(screen.getByLabelText("Repeat new password"));
    await userEvent.type(screen.getByLabelText("Repeat new password"), "newpassword1");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Your current password is wrong.")).toBeInTheDocument();
  });
});
