/*
This file tests the login page form, the resend-confirmation button, and login-page redirects.
Edit this file when login form behavior or login-page routing changes.
Copy a test pattern here when you add tests for another page with a form.
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

import { LoginPage } from "./LoginPage";
import { ApiError } from "../shared/api";
import { makeUser, renderWithAuth } from "../shared/testUtils";

describe("LoginPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("starts with empty nickname and password fields", () => {
    renderWithAuth(<LoginPage />, { user: null });
    expect(screen.getByLabelText("Nickname")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("submits nickname and password through auth context", async () => {
    const { auth } = renderWithAuth(<LoginPage />, { user: null });
    await userEvent.type(screen.getByLabelText("Nickname"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(auth.login).toHaveBeenCalledWith("alice", "password1");
  });

  it("offers to resend the confirmation email when the email is not confirmed", async () => {
    const { auth } = renderWithAuth(<LoginPage />, { user: null });
    auth.login.mockRejectedValue(new ApiError(403, "email_not_confirmed", "Please confirm your email first. Check your inbox."));
    postJson.mockResolvedValue({ sent: true });

    await userEvent.type(screen.getByLabelText("Nickname"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please confirm your email first.");
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(postJson).toHaveBeenCalledWith("/auth/resend-confirmation", { username: "alice" });
    expect(await screen.findByRole("status")).toHaveTextContent("We sent you a new confirmation email.");
  });

  it("does not offer resend for a wrong password", async () => {
    const { auth } = renderWithAuth(<LoginPage />, { user: null });
    auth.login.mockRejectedValue(new ApiError(401, "invalid_credentials", "Wrong nickname or password."));
    await userEvent.type(screen.getByLabelText("Nickname"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong nickname or password.");
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).not.toBeInTheDocument();
  });

  it("redirects logged-in users away from the login page", () => {
    renderWithAuth(<LoginPage />, { user: makeUser() });
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
  });
});
