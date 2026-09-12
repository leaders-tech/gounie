/*
This file tests the main app router, header, and route guards for visitors and for logged-in users.
Edit this file when top-level routes, navigation, or auth redirects change.
Copy a test pattern here when you add another route or route guard.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../pages/AdminPage", () => ({
  AdminPage: () => <h2>Admin page</h2>,
}));

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson: vi.fn().mockResolvedValue({}) };
});

import { App } from "./App";
import { makeUser, renderWithAuth } from "../shared/testUtils";

describe("App routes", () => {
  it("shows the visitor home page with a login form instead of redirecting", () => {
    renderWithAuth(<App />, { user: null, path: "/" });
    expect(screen.getByRole("heading", { name: "gounie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });

  it("shows only the public pages in the navigation for visitors", () => {
    renderWithAuth(<App />, { user: null, path: "/" });
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Is it Friday yet?", "EPS-bet", "URLs"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(nav).not.toHaveTextContent("The Wall");
    expect(nav).not.toHaveTextContent("Slots");
  });

  it.each([
    ["/friday", "friday-answer"],
    ["/eps-bet", "EPS-bet"],
    ["/urls", "the great url collection"],
  ])("lets visitors open %s", (path, marker) => {
    renderWithAuth(<App />, { user: null, path });
    if (marker === "friday-answer") {
      expect(screen.getByTestId("friday-answer")).toBeInTheDocument();
    } else {
      expect(screen.getByRole("heading", { name: marker })).toBeInTheDocument();
    }
  });

  it.each(["/wall", "/slots", "/account"])("sends visitors from %s to the login page", (path) => {
    renderWithAuth(<App />, { user: null, path });
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "gounie" })).not.toBeInTheDocument();
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
    for (const name of ["Is it Friday yet?", "The Wall", "EPS-bet", "URLs", "Slots", "Account"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("sends unknown paths to the home page", () => {
    renderWithAuth(<App />, { user: makeUser({ username: "alice" }), path: "/does-not-exist" });
    expect(screen.getByRole("heading", { name: "hi, alice 👋" })).toBeInTheDocument();
  });
});
