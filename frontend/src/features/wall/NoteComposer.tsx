/*
This file shows the form for leaving a note on a wall: text, a pasted or picked picture, and the note look, with a live preview.
Edit this file when note posting fields, picture limits, or the preview change.
Copy this file as a starting point when you add another form with a live preview.
*/

import { ClipboardEvent, FormEvent, useState } from "react";
import { errorMessage, postJson } from "../../shared/api";
import type { NoteStyle } from "../../shared/types";
import { Button, Card, ErrorText } from "../../shared/ui";
import { DEFAULT_NOTE_STYLE, NoteStyleFields } from "./NoteStyleFields";
import { PREVIEW_BOARD_CLASS, StickyNote } from "./StickyNote";

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 500;

export function readPictureFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Only pictures can be added."));
      return;
    }
    if (file.size > MAX_PICTURE_BYTES) {
      reject(new Error("The picture is too big. The limit is 5 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the picture."));
    reader.readAsDataURL(file);
  });
}

type NoteComposerProps = {
  wallOwner: string;
  isOwnWall: boolean;
  authorName: string;
  onPosted: () => void;
};

export function NoteComposer({ wallOwner, isOwnWall, authorName, onPosted }: NoteComposerProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [style, setStyle] = useState<NoteStyle>(DEFAULT_NOTE_STYLE);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const addPicture = async (file: File) => {
    try {
      setImage(await readPictureFile(file));
      setError("");
    } catch (pictureError) {
      setError(errorMessage(pictureError));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void addPicture(file);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim() && !image) {
      setError("Write something or add a picture.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postJson("/wall/post", { username: wallOwner, text, image, ...style });
      setText("");
      setImage(null);
      onPosted();
    } catch (postError) {
      setError(errorMessage(postError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="grid gap-6 md:grid-cols-[1fr_auto]">
      <form className="space-y-4" onPaste={onPaste} onSubmit={onSubmit}>
        <div>
          <h2 className="text-xl font-black">{isOwnWall ? "Leave a note on your own wall" : `Leave a note on ${wallOwner}'s wall`}</h2>
          <p className="text-sm text-stone-600">Don&apos;t worry: everything you put on the wall can be edited and deleted later.</p>
        </div>
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Note</span>
            <textarea
              className="w-full rounded-xl border-2 border-stone-900 bg-amber-50 px-3 py-2 outline-none focus:bg-white focus:ring-4 focus:ring-yellow-300"
              maxLength={MAX_TEXT}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write something nice (or not). You can also paste a picture here."
              rows={4}
              value={text}
            />
          </label>
          <p className="text-right text-xs text-stone-500">
            {text.length}/{MAX_TEXT}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-xl border-2 border-stone-900 bg-white px-4 py-2 font-bold shadow-[3px_3px_0_#1c1917]">
            📎 Add picture
            <input
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              data-testid="note-picture-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void addPicture(file);
                }
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          {image ? (
            <Button onClick={() => setImage(null)} variant="secondary">
              Remove picture
            </Button>
          ) : null}
        </div>
        <NoteStyleFields onChange={setStyle} style={style} />
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy} type="submit">
          {busy ? "Sticking..." : "Stick it on the wall"}
        </Button>
      </form>
      <div className="flex flex-col items-center justify-center gap-2">
        <p className="text-sm font-semibold text-stone-600">Preview</p>
        <div className={PREVIEW_BOARD_CLASS}>
          <StickyNote imageSrc={image} note={{ text, ...style, author_username: authorName, created_at: new Date().toISOString() }} />
        </div>
      </div>
    </Card>
  );
}
