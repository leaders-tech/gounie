/*
This file keeps shared helpers for frontend unit tests: a fake user and rendering a page with auth and routes.
Edit this file when many frontend tests need the same setup.
Copy the helper style here when you add another shared unit-test helper. Do not import it from app code.
*/

import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthContext } from "../app/auth";
import type { Bet, User } from "./types";

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 2,
    username: "alice",
    is_admin: false,
    karma: 0,
    created_at: "2026-03-06T10:00:00+00:00",
    updated_at: "2026-03-06T10:00:00+00:00",
    ...overrides,
  };
}

export function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: 4,
    creator_id: 9,
    creator_username: "carol",
    title: "Will it rain?",
    description: "",
    deadline_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: "open",
    outcome: null,
    resolved_at: null,
    approval: "approved",
    review_note: "",
    reviewed_at: "2026-09-01T11:00:00+00:00",
    created_at: "2026-09-01T10:00:00+00:00",
    wager_count: 0,
    yes_total: 0,
    no_total: 0,
    comment_count: 0,
    ...overrides,
  };
}

type RenderOptions = {
  user?: User | null;
  path?: string;
  routePath?: string;
};

export function renderWithAuth(ui: ReactElement, { user = makeUser(), path = "/", routePath }: RenderOptions = {}) {
  const auth = {
    user,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    reloadUser: vi.fn(),
    setKarma: vi.fn(),
  };
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        {routePath ? (
          <Routes>
            <Route element={ui} path={routePath} />
          </Routes>
        ) : (
          ui
        )}
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { ...result, auth };
}

/** Make postJson answer by path. Unknown paths throw, so tests notice unexpected calls. */
export function answerByPath(mock: ReturnType<typeof vi.fn>, handlers: Record<string, (body: never) => unknown>) {
  mock.mockImplementation(async (path: string, body: never) => {
    const handler = handlers[path];
    if (!handler) {
      throw new Error(`Unexpected API call: ${path}`);
    }
    return handler(body);
  });
}
