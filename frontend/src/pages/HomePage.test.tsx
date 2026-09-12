/*
This file tests the home page: the greeting and cards for logged-in users, and the login form for visitors.
Edit this file when the home page cards, greeting, or visitor login form change.
Copy a test pattern here when you add tests for another page that looks different for visitors.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";
import { makeUser, renderWithAuth } from "../shared/testUtils";

describe("HomePage", () => {
  it("greets the user and links to every page", () => {
    renderWithAuth(<HomePage />, { user: makeUser({ username: "alice", karma: 12 }) });
    expect(screen.getByRole("heading", { name: "hi, alice 👋" })).toBeInTheDocument();
    expect(screen.getByText("12 karma")).toBeInTheDocument();
    const expected = {
      "/friday": /Is it Friday yet\?/,
      "/wall": /The Wall/,
      "/eps-bet": /EPS-bet/,
      "/urls": /the great url collection/,
      "/slots": /slots/,
    };
    for (const [href, name] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("shows visitors a login form and only the pages that work without an account", () => {
    renderWithAuth(<HomePage />, { user: null });
    expect(screen.getByRole("heading", { name: "gounie" })).toBeInTheDocument();
    const expected = {
      "/friday": /Is it Friday yet\?/,
      "/eps-bet": /EPS-bet/,
      "/urls": /the great url collection/,
    };
    for (const [href, name] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.queryByRole("link", { name: /The Wall/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /slots/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
  });

  it("logs visitors in from the home page", async () => {
    const { auth } = renderWithAuth(<HomePage />, { user: null });
    await userEvent.type(screen.getByLabelText("Nickname"), "alice");
    await userEvent.type(screen.getByLabelText("Password"), "password1");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(auth.login).toHaveBeenCalledWith("alice", "password1");
  });

  it("shows a login error on the home page", async () => {
    const { auth } = renderWithAuth(<HomePage />, { user: null });
    auth.login.mockRejectedValue(new Error("Wrong nickname or password."));
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong nickname or password.");
  });
});
