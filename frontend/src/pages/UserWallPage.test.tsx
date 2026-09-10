/*
This file tests one user's wall: notes in their own look, the right-click menu, rotate-only editing, the whoops delete, and admin deletes.
Edit this file when the wall page, note menu, or note editing behavior changes.
Copy a test pattern here when you add tests for another page with a custom context menu or edit window.
*/

import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, postJson };
});

import { UserWallPage } from "./UserWallPage";
import { ApiError } from "../shared/api";
import { answerByPath, makeUser, renderWithAuth } from "../shared/testUtils";
import type { User, WallNote } from "../shared/types";

const CREATED = "2026-03-06T10:00:00+00:00";
const PLAIN = { color: "#fef08a", text_color: "#1c1917", bold: false, italic: false, underline: false, strikethrough: false };
const owner = { id: 5, username: "bob", is_admin: false, karma: 3, created_at: CREATED };
const notes: WallNote[] = [
  { id: 1, wall_user_id: 5, author_id: 2, author_username: "alice", text: "my note", has_image: false, ...PLAIN, tilt: 3, created_at: CREATED },
  {
    id: 2,
    wall_user_id: 5,
    author_id: 7,
    author_username: "carol",
    text: "carol note",
    has_image: true,
    ...PLAIN,
    color: "#fbcfe8",
    text_color: "#0000ff",
    bold: true,
    italic: true,
    tilt: -170,
    created_at: CREATED,
  },
];

function renderWall(user: User) {
  return renderWithAuth(<UserWallPage />, { user, path: "/u/bob", routePath: "/u/:username" });
}

async function boardNote(author: string) {
  const board = await screen.findByTestId("wall-board");
  return within(board).getByRole("article", { name: `Note from ${author}` });
}

describe("UserWallPage", () => {
  beforeEach(() => {
    postJson.mockReset();
    answerByPath(postJson, {
      "/wall/list": () => ({ owner, notes }),
      "/wall/rotate": (body: { tilt: number }) => ({ note: { ...notes[0], tilt: body.tilt } }),
      "/wall/delete": () => {
        throw new ApiError(409, "whoops", "whoops.. something went wrong");
      },
      "/admin/wall/delete": () => ({ deleted: true }),
    });
  });

  it("shows the owner and every note in its own colors, text style, rotation, and framed picture", async () => {
    renderWall(makeUser());
    expect(await screen.findByRole("heading", { name: "bob" })).toBeInTheDocument();
    const carolNote = await boardNote("carol");
    expect(within(carolNote).getByRole("img", { name: "Picture from carol" })).toHaveAttribute("src", "/api/wall/image/2");
    expect(within(carolNote).getByRole("link", { name: "@carol" })).toHaveAttribute("href", "/u/carol");
    expect(carolNote).toHaveStyle({ transform: "rotate(-170deg)", backgroundColor: "#fbcfe8" });
    expect(within(carolNote).getByText("carol note")).toHaveStyle({ fontWeight: "800", fontStyle: "italic", color: "#0000ff" });
    expect(within(carolNote).queryByRole("button", { name: "Edit this note" })).not.toBeInTheDocument();
  });

  it("claims that everything on the wall can be edited and deleted", async () => {
    renderWall(makeUser());
    expect(await screen.findByText(/everything you put on the wall can be edited and deleted later/)).toBeInTheDocument();
    expect(screen.getByText(/everything on the wall can be edited and deleted/)).toBeInTheDocument();
  });

  it("right-click delete on your own note always says whoops and keeps the note", async () => {
    renderWall(makeUser());
    fireEvent.contextMenu(await boardNote("alice"));
    await userEvent.click(screen.getByRole("menuitem", { name: /Delete$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("whoops.. something went wrong");
    expect(postJson).toHaveBeenCalledWith("/wall/delete", { id: 1 });
    expect(await boardNote("alice")).toHaveTextContent("my note");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("lets the author edit a note, but only its rotation can change", async () => {
    renderWall(makeUser());
    fireEvent.contextMenu(await boardNote("alice"));
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit$/ }));

    const dialog = screen.getByRole("dialog", { name: "Edit your note" });
    expect(within(dialog).queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Note color hex")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("slider", { name: /Rotation/ }), { target: { value: "135" } });
    expect(within(dialog).getByRole("article", { name: "Note from alice" })).toHaveStyle({ transform: "rotate(135deg)" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(postJson).toHaveBeenCalledWith("/wall/rotate", { id: 1, tilt: 135 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await boardNote("alice")).toHaveStyle({ transform: "rotate(135deg)" });
    expect(screen.getByRole("alert")).toHaveTextContent("Note updated.");
  });

  it("opens the editor with the pencil button and cancels without saving", async () => {
    renderWall(makeUser());
    await userEvent.click(within(await boardNote("alice")).getByRole("button", { name: "Edit this note" }));
    const dialog = screen.getByRole("dialog", { name: "Edit your note" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(postJson).not.toHaveBeenCalledWith("/wall/rotate", expect.anything());
  });

  it("does not open the menu on other people's notes on someone else's wall", async () => {
    renderWall(makeUser());
    fireEvent.contextMenu(await boardNote("carol"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("lets the wall owner use delete on any note, but not edit other people's notes", async () => {
    renderWall(makeUser({ id: 5, username: "bob" }));
    fireEvent.contextMenu(await boardNote("carol"));
    expect(screen.getByRole("menuitem", { name: /Delete$/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Really delete/ })).not.toBeInTheDocument();
  });

  it("lets admins really delete a note", async () => {
    renderWall(makeUser({ id: 9, username: "admin", is_admin: true }));
    fireEvent.contextMenu(await boardNote("carol"));
    await userEvent.click(screen.getByRole("menuitem", { name: /Really delete/ }));
    expect(postJson).toHaveBeenCalledWith("/admin/wall/delete", { id: 2 });
    expect(await screen.findByRole("alert")).toHaveTextContent("Note deleted by admin.");
    await waitFor(() => expect(postJson.mock.calls.filter(([path]) => path === "/wall/list")).toHaveLength(2));
  });

  it("shows an error for an unknown user", async () => {
    postJson.mockRejectedValue(new ApiError(404, "not_found", "This user does not exist."));
    renderWall(makeUser());
    expect(await screen.findByRole("alert")).toHaveTextContent("This user does not exist.");
  });
});
