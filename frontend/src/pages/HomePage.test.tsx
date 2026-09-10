/*
This file tests the home page greeting and the links to the five gounie pages.
Edit this file when the home page cards or greeting change.
Copy a test pattern here when you add tests for another simple page.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
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
});
