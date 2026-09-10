/*
This file tests the forgot-password page request and its neutral success message.
Edit this file when the forgot-password flow changes.
Copy a test pattern here when you add tests for another one-field form.
*/

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { renderWithAuth } from "../shared/testUtils";

describe("ForgotPasswordPage", () => {
  it("asks for a reset link and shows a neutral message", async () => {
    postJson.mockResolvedValue({ sent: true });
    renderWithAuth(<ForgotPasswordPage />, { user: null });
    await userEvent.type(screen.getByLabelText("School email"), "alice@example.edu");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If this email belongs to an account");
    expect(postJson).toHaveBeenCalledWith("/auth/forgot-password", { email: "alice@example.edu" });
  });
});
