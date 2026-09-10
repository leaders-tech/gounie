/*
This file shows the "Edit your note" window for your own wall note: a rotation slider with a live preview.
Edit this file when editing a posted note works differently. Only the rotation of a posted note can change.
Copy this file as a starting point when you add another small edit window.
*/

import { useEffect, useId, useState } from "react";
import { errorMessage, postJson } from "../../shared/api";
import type { WallNote } from "../../shared/types";
import { Button, ErrorText } from "../../shared/ui";
import { RotationField } from "./NoteStyleFields";
import { PREVIEW_BOARD_CLASS, StickyNote } from "./StickyNote";

type NoteRotationEditorProps = {
  note: WallNote;
  imageSrc: string | null;
  onClose: () => void;
  onSaved: (note: WallNote) => void;
};

export function NoteRotationEditor({ note, imageSrc, onClose, onSaved }: NoteRotationEditorProps) {
  const [tilt, setTilt] = useState(note.tilt);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await postJson<{ note: WallNote }>("/wall/rotate", { id: note.id, tilt });
      onSaved(data.note);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-3xl rounded-2xl border-2 border-stone-900 bg-white p-6 shadow-[6px_6px_0_#1c1917]"
        role="dialog"
      >
        <h2 className="text-2xl font-black" id={titleId}>
          Edit your note
        </h2>
        <div className="mt-4 grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <RotationField onChange={setTilt} value={tilt} />
          <div className={PREVIEW_BOARD_CLASS}>
            <StickyNote imageSrc={imageSrc} note={{ ...note, tilt }} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? "Saving..." : "Save"}
            </Button>
            <Button onClick={onClose} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
