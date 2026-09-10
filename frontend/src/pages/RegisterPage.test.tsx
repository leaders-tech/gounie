/*
This file tests the sign-up page: password check, the sign-up request, errors, and the check-your-inbox screen.
Edit this file when sign-up fields or sign-up messages change.
Copy a test pattern here when you add tests for another form with a success screen.
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

import { RegisterPage } from "./RegisterPage";
import { ApiError } from "../shared/api";
import { renderWithAuth } from "../shared/testUtils";

async function fillForm(repeat = "password1") {
  await userEvent.type(screen.getByLabelText("Nickname"), "alice");
  await userEvent.type(screen.getByLabelText("School email"), "alice@example.edu");
  await userEvent.type(screen.getByLabelText("Password"), "password1");
  await userEvent.type(screen.getByLabelText("Repeat password"), repeat);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("checks that both passwords match", async () => {
    renderWithAuth(<RegisterPage />, { user: null });
    await fillForm("different1");
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(postJson).not.toHaveBeenCalled();
  });

  it("shows the check-your-inbox screen after sign-up", async () => {
    postJson.mockResolvedValue({ registered: true, email_sent: true });
    renderWithAuth(<RegisterPage />, { user: null });
    await fillForm();
    expect(await screen.findByRole("heading", { name: "Check your inbox 📬" })).toBeInTheDocument();
    expect(screen.getByText("alice@example.edu")).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledWith("/auth/register", { username: "alice", email: "alice@example.edu", password: "password1" });
  });

  it("explains when the email could not be sent", async () => {
    postJson.mockResolvedValue({ registered: true, email_sent: false });
    renderWithAuth(<RegisterPage />, { user: null });
    await fillForm();
    expect(await screen.findByText(/we could not send the email/)).toBeInTheDocument();
  });

  it("shows server errors like a blocked email domain", async () => {
    postJson.mockRejectedValue(new ApiError(400, "bad_request", "Only emails from allowed school domains can be used."));
    renderWithAuth(<RegisterPage />, { user: null });
    await fillForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Only emails from allowed school domains can be used.");
  });
});
