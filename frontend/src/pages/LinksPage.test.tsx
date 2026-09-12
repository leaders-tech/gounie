/*
This file tests the great url collection page: voting, own-link rules, adding, deleting, and search.
Edit this file when the links page behavior changes.
Copy a test pattern here when you add tests for another collection page with votes.
*/

import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { LinksPage } from "./LinksPage";
import { answerByPath, renderWithAuth } from "../shared/testUtils";
import type { LinkItem } from "../shared/types";

function makeLink(overrides: Partial<LinkItem>): LinkItem {
  return {
    id: 1,
    author_id: 7,
    author_username: "carol",
    url: "https://docs.python.org/3/",
    title: "Python docs",
    description: "The official docs.",
    score: 2,
    my_vote: 0,
    created_at: "2026-09-01T10:00:00+00:00",
    updated_at: "2026-09-01T10:00:00+00:00",
    ...overrides,
  };
}

const links = [makeLink({ id: 1 }), makeLink({ id: 2, author_id: 2, author_username: "alice", title: "My link", url: "https://example.org/" })];

describe("LinksPage", () => {
  beforeEach(() => {
    postJson.mockReset();
    answerByPath(postJson, {
      "/links/list": () => ({ links }),
      "/links/vote": (body: { value: -1 | 0 | 1 }) => ({ link: makeLink({ id: 1, my_vote: body.value, score: 2 + body.value }) }),
      "/links/create": () => ({ link: links[0] }),
      "/links/delete": () => ({ deleted: true }),
    });
  });

  it("shows links safely and votes up, then removes the vote", async () => {
    renderWithAuth(<LinksPage />);
    const title = await screen.findByRole("link", { name: "Python docs" });
    expect(title).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(title).toHaveAttribute("target", "_blank");

    await userEvent.click(screen.getByRole("button", { name: "Upvote Python docs" }));
    expect(postJson).toHaveBeenCalledWith("/links/vote", { link_id: 1, value: 1 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Upvote Python docs" })).toHaveAttribute("aria-pressed", "true"));

    await userEvent.click(screen.getByRole("button", { name: "Upvote Python docs" }));
    expect(postJson).toHaveBeenLastCalledWith("/links/vote", { link_id: 1, value: 0 });
  });

  it("does not allow voting on your own link", async () => {
    renderWithAuth(<LinksPage />);
    expect(await screen.findByRole("button", { name: "Upvote My link" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Downvote My link" })).toBeDisabled();
  });

  it("adds a link", async () => {
    renderWithAuth(<LinksPage />);
    await screen.findByRole("link", { name: "Python docs" });
    await userEvent.type(screen.getByLabelText("URL"), "https://example.com/");
    await userEvent.type(screen.getByLabelText("Title"), "Example");
    await userEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(postJson).toHaveBeenCalledWith("/links/create", { url: "https://example.com/", title: "Example", description: "" });
  });

  it("deletes your own link after a second click", async () => {
    renderWithAuth(<LinksPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Really delete?" }));
    expect(postJson).toHaveBeenCalledWith("/links/delete", { id: 2 });
  });

  it("searches while typing", async () => {
    renderWithAuth(<LinksPage />);
    await userEvent.type(screen.getByLabelText("Search links"), "py");
    await waitFor(() => expect(postJson).toHaveBeenCalledWith("/links/list", { query: "py" }));
  });

  it("lets visitors read the links but not add or vote", async () => {
    renderWithAuth(<LinksPage />, { user: null });

    expect(await screen.findByRole("link", { name: "Python docs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add link" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upvote Python docs" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Downvote Python docs" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });
});
