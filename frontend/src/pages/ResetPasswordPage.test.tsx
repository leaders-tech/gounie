/*
This file tests the reset-password page: token from the link, matching passwords, and success.
Edit this file when the reset-password flow changes.
Copy a test pattern here when you add tests for another form that uses a token from a link.
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

import { ResetPasswordPage } from "./ResetPasswordPage";
import { renderWithAuth } from "../shared/testUtils";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("saves the new password with the token from the link", async () => {
    postJson.mockResolvedValue({ reset: true });
    renderWithAuth(<ResetPasswordPage />, { user: null, path: "/reset?token=tok123" });
    await userEvent.type(screen.getByLabelText("New password"), "newpassword1");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "newpassword1");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password was changed.");
    expect(postJson).toHaveBeenCalledWith("/auth/reset-password", { token: "tok123", password: "newpassword1" });
  });

  it("checks that passwords match", async () => {
    renderWithAuth(<ResetPasswordPage />, { user: null, path: "/reset?token=tok123" });
    await userEvent.type(screen.getByLabelText("New password"), "newpassword1");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "other");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(postJson).not.toHaveBeenCalled();
  });

  it("blocks the form when the link has no token", () => {
    renderWithAuth(<ResetPasswordPage />, { user: null, path: "/reset" });
    expect(screen.getByRole("alert")).toHaveTextContent("missing its token");
    expect(screen.getByRole("button", { name: "Save new password" })).toBeDisabled();
  });
});
