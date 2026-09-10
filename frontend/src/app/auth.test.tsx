/*
This file tests the shared auth provider: startup session loading and live karma updates.
Edit this file when auth bootstrap, login state loading, or shared auth context behavior changes.
Copy this file when you add tests for another shared frontend provider.
*/

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({
  postJson: vi.fn(),
}));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return {
    ...actual,
    postJson,
  };
});

import { AuthProvider, useAuth } from "./auth";
import { makeUser } from "../shared/testUtils";

function AuthStatus() {
  const { loading, user, setKarma } = useAuth();
  if (loading) {
    return <p>Loading</p>;
  }
  return (
    <>
      <p>{user ? `${user.username}:${user.karma}` : "Anonymous"}</p>
      <button onClick={() => setKarma(7)} type="button">
        set karma
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("loads the session only once during StrictMode startup", async () => {
    postJson.mockResolvedValueOnce({ user: null });

    render(
      <StrictMode>
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("Anonymous")).toBeInTheDocument());
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(postJson).toHaveBeenCalledWith("/auth/me");
  });

  it("updates the karma of the logged-in user", async () => {
    postJson.mockResolvedValueOnce({ user: makeUser({ username: "alice", karma: 1 }) });

    render(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>,
    );

    expect(await screen.findByText("alice:1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "set karma" }));
    expect(screen.getByText("alice:7")).toBeInTheDocument();
  });
});
