/*
This file tests The Wall start page: the people list, search, and the link to your own wall.
Edit this file when the wall directory behavior changes.
Copy a test pattern here when you add tests for another searchable list.
*/

import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { WallDirectoryPage } from "./WallDirectoryPage";
import { renderWithAuth } from "../shared/testUtils";

describe("WallDirectoryPage", () => {
  it("lists people, links to walls, and searches", async () => {
    postJson.mockResolvedValue({
      users: [
        { id: 2, username: "alice", is_admin: false, karma: 0, created_at: "2026-03-06T10:00:00+00:00" },
        { id: 3, username: "bob", is_admin: false, karma: 4, created_at: "2026-03-06T10:00:00+00:00" },
      ],
    });
    renderWithAuth(<WallDirectoryPage />);

    expect(await screen.findByRole("link", { name: /bob/ })).toHaveAttribute("href", "/u/bob");
    expect(screen.getByRole("link", { name: "📌 Go to my wall" })).toHaveAttribute("href", "/u/alice");

    await userEvent.type(screen.getByLabelText("Search people"), "bo");
    await waitFor(() => expect(postJson).toHaveBeenLastCalledWith("/users/list", { query: "bo" }));
  });
});
