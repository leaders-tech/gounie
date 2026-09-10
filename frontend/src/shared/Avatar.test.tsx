/*
This file tests the plain avatar: first letter and a stable color per nickname.
Edit this file when avatar rules change.
Copy a test pattern here when you add tests for another tiny display component.
*/

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, avatarColor } from "./Avatar";

describe("Avatar", () => {
  it("shows the first letter of the nickname in upper case", () => {
    render(<Avatar username="bob" />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("keeps the same color for the same nickname, ignoring case", () => {
    expect(avatarColor("Alice")).toBe(avatarColor("alice"));
    expect(avatarColor("alice")).toMatch(/^bg-/);
  });
});
