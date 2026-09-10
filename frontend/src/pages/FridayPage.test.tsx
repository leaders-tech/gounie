/*
This file tests "Is it Friday yet?": NO on other days, YES! with confetti on Fridays, and switching at midnight.
Edit this file when the Friday page rules change.
Copy a test pattern here when you add tests that depend on the current date or time.
*/

import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import confetti from "canvas-confetti";
import { FridayPage, isFriday } from "./FridayPage";

describe("FridayPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(confetti).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("knows which day is Friday", () => {
    expect(isFriday(new Date(2026, 8, 11, 8, 0))).toBe(true);
    expect(isFriday(new Date(2026, 8, 10, 8, 0))).toBe(false);
    expect(isFriday(new Date(2026, 8, 12, 0, 1))).toBe(false);
  });

  it("shows only a huge red NO when it is not Friday", () => {
    vi.setSystemTime(new Date(2026, 8, 10, 12, 0));
    const { container } = render(<FridayPage />);
    const answer = screen.getByTestId("friday-answer");
    expect(answer).toHaveTextContent(/^NO$/);
    expect(answer).toHaveClass("text-red-600");
    expect(container).toHaveTextContent(/^NO$/);
    expect(confetti).not.toHaveBeenCalled();
  });

  it("shows YES! with confetti on Friday", () => {
    vi.setSystemTime(new Date(2026, 8, 11, 9, 30));
    render(<FridayPage />);
    expect(screen.getByTestId("friday-answer")).toHaveTextContent(/^YES!$/);
    expect(confetti).toHaveBeenCalled();
  });

  it("switches to YES! when Friday starts while the page is open", () => {
    vi.setSystemTime(new Date(2026, 8, 10, 23, 59, 50));
    render(<FridayPage />);
    expect(screen.getByTestId("friday-answer")).toHaveTextContent("NO");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByTestId("friday-answer")).toHaveTextContent("YES!");
  });
});
