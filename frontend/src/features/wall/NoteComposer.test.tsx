/*
This file tests the wall note form: posting text with a custom look, text style buttons, the live preview, pasted pictures, and picture limits.
Edit this file when the note form behavior changes.
Copy a test pattern here when you add tests for another form with a preview or file input.
*/

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({ postJson: vi.fn() }));

vi.mock("../../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../../shared/api")>("../../shared/api");
  return { ...actual, postJson };
});

import { NoteComposer, readPictureFile } from "./NoteComposer";

function renderComposer() {
  const onPosted = vi.fn();
  render(
    <MemoryRouter>
      <NoteComposer authorName="alice" isOwnWall={false} onPosted={onPosted} wallOwner="bob" />
    </MemoryRouter>,
  );
  return onPosted;
}

async function setHex(label: string, color: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, color);
}

describe("NoteComposer", () => {
  beforeEach(() => {
    postJson.mockReset();
  });

  it("posts text with the chosen colors, text style, and tilt", async () => {
    postJson.mockResolvedValue({ note: {} });
    const onPosted = renderComposer();

    await userEvent.type(screen.getByLabelText("Note"), "hello bob");
    await userEvent.click(screen.getByRole("button", { name: "Bold" }));
    await userEvent.click(screen.getByRole("button", { name: "Italic" }));
    await setHex("Note color hex", "#ff00aa");
    await setHex("Text color hex", "#0000ff");
    fireEvent.change(screen.getByRole("slider", { name: /Rotation/ }), { target: { value: "150" } });

    const preview = screen.getByRole("article", { name: "Note from alice" });
    expect(preview).toHaveStyle({ transform: "rotate(150deg)", backgroundColor: "#ff00aa" });
    expect(within(preview).getByText("hello bob")).toHaveStyle({ fontWeight: "800", fontStyle: "italic", color: "#0000ff" });

    await userEvent.click(screen.getByRole("button", { name: "Stick it on the wall" }));
    expect(postJson).toHaveBeenCalledWith("/wall/post", {
      username: "bob",
      text: "hello bob",
      image: null,
      color: "#ff00aa",
      text_color: "#0000ff",
      tilt: 150,
      bold: true,
      italic: true,
      underline: false,
      strikethrough: false,
    });
    expect(onPosted).toHaveBeenCalled();
    expect(screen.getByLabelText("Note")).toHaveValue("");
  });

  it("switches text styles on and off, and Regular clears them", async () => {
    renderComposer();
    const regular = screen.getByRole("button", { name: "Regular" });
    expect(regular).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Underline" }));
    await userEvent.click(screen.getByRole("button", { name: "Strikethrough" }));
    expect(screen.getByRole("button", { name: "Underline" })).toHaveAttribute("aria-pressed", "true");
    expect(regular).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(regular);
    expect(regular).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Underline" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Strikethrough" })).toHaveAttribute("aria-pressed", "false");
  });

  it("asks for text or a picture", async () => {
    renderComposer();
    await userEvent.click(screen.getByRole("button", { name: "Stick it on the wall" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write something or add a picture.");
    expect(postJson).not.toHaveBeenCalled();
  });

  it("adds a pasted picture to the preview and the post", async () => {
    postJson.mockResolvedValue({ note: {} });
    renderComposer();
    const file = new File(["fake-png-bytes"], "cat.png", { type: "image/png" });
    fireEvent.paste(screen.getByLabelText("Note"), { clipboardData: { files: [file] } });

    const preview = await screen.findByRole("img", { name: "Picture from alice" });
    expect(preview.getAttribute("src")).toMatch(/^data:image\/png;base64,/);

    await userEvent.click(screen.getByRole("button", { name: "Stick it on the wall" }));
    expect(postJson).toHaveBeenCalledWith("/wall/post", expect.objectContaining({ text: "", image: expect.stringMatching(/^data:image\/png;base64,/) }));
  });

  it("rejects files that are not pictures or are too big", async () => {
    await expect(readPictureFile(new File(["x"], "notes.txt", { type: "text/plain" }))).rejects.toThrow("Only pictures can be added.");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await expect(readPictureFile(big)).rejects.toThrow("The picture is too big.");
  });
});
