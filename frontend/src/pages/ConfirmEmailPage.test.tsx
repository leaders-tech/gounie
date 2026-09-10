/*
This file tests the email confirmation page: it sends the token once and shows success or an error.
Edit this file when the confirmation page behavior changes.
Copy a test pattern here when you add tests for another page that runs one action from a link.
*/

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { ConfirmEmailPage } from "./ConfirmEmailPage";
import { ApiError } from "../shared/api";

function renderAt(path: string) {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <ConfirmEmailPage />
      </MemoryRouter>
    </StrictMode>,
  );
}

describe("ConfirmEmailPage", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("sends the token only once and shows success", async () => {
    postJson.mockResolvedValue({ confirmed: true, username: "alice" });
    renderAt("/confirm?token=abc123");
    expect(await screen.findByText("Your email is confirmed, alice! You can log in now.")).toBeInTheDocument();
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(postJson).toHaveBeenCalledWith("/auth/confirm", { token: "abc123" });
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute("href", "/login");
  });

  it("shows the server error for a bad link", async () => {
    postJson.mockRejectedValue(new ApiError(400, "invalid_token", "This confirmation link is invalid or expired."));
    renderAt("/confirm?token=old");
    expect(await screen.findByRole("alert")).toHaveTextContent("This confirmation link is invalid or expired.");
  });

  it("explains a link without a token", () => {
    renderAt("/confirm");
    expect(screen.getByRole("alert")).toHaveTextContent("This confirmation link is missing its token.");
    expect(postJson).not.toHaveBeenCalled();
  });
});
