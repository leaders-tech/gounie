/*
This file tests the main app router, header, and route guards.
Edit this file when top-level routes, navigation, or auth redirects change.
Copy a test pattern here when you add another route or route guard.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../pages/AdminPage", () => ({
  AdminPage: () => <h2>Admin page</h2>,
}));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson: vi.fn().mockResolvedValue({}) };
});

import { App } from "./App";
import { makeUser, renderWithAuth } from "../shared/testUtils";

describe("App routes", () => {
  it("redirects anonymous users to login", () => {
    renderWithAuth(<App />, { user: null, path: "/" });
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });

  it("redirects normal users away from the admin page", () => {
    renderWithAuth(<App />, { user: makeUser({ username: "alice" }), path: "/admin" });
    expect(screen.getByRole("heading", { name: "hi, alice 👋" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows the admin link and page for admins", () => {
    renderWithAuth(<App />, { user: makeUser({ username: "admin", is_admin: true }), path: "/admin" });
    expect(screen.getByRole("heading", { name: "Admin page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
  });

  it("shows navigation, nickname, and karma in the header", () => {
    renderWithAuth(<App />, { user: makeUser({ karma: -12 }), path: "/" });
    expect(screen.getByTestId("header-karma")).toHaveTextContent("-12 karma");
    for (const name of ["Friday?", "The Wall", "EPS-bet", "URLs", "Slots", "Account"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("sends unknown paths to the home page", () => {
    renderWithAuth(<App />, { user: makeUser({ username: "alice" }), path: "/does-not-exist" });
    expect(screen.getByRole("heading", { name: "hi, alice 👋" })).toBeInTheDocument();
  });
});
