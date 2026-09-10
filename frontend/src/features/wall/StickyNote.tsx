/*
This file shows one sticky note on a wall: fixed size, tilted, in its own colors and text style, with an optional framed picture.
Edit this file when sticky note look, text styling, or picture framing changes.
Copy this file as a starting point when you add another small display card.
*/

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "../../shared/format";
import type { NoteStyle } from "../../shared/types";

export type StickyNoteData = NoteStyle & {
  text: string;
  author_username: string;
  created_at: string;
};

/** A square cork board that fits a note turned to any angle. */
export const PREVIEW_BOARD_CLASS =
  "cork-board mx-auto flex aspect-square w-full max-w-[22rem] items-center justify-center overflow-hidden rounded-xl md:w-[22rem]";

type StickyNoteProps = {
  note: StickyNoteData;
  imageSrc?: string | null;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  actions?: ReactNode;
};

export function noteTextStyle(style: NoteStyle): CSSProperties {
  const decorations = [style.underline ? "underline" : "", style.strikethrough ? "line-through" : ""].filter(Boolean);
  return {
    color: style.text_color,
    fontWeight: style.bold ? 800 : 500,
    fontStyle: style.italic ? "italic" : "normal",
    textDecorationLine: decorations.length > 0 ? decorations.join(" ") : "none",
  };
}

export function StickyNote({ note, imageSrc, onContextMenu, actions }: StickyNoteProps) {
  return (
    <article
      aria-label={`Note from ${note.author_username}`}
      className="relative flex h-60 w-56 flex-col border border-stone-900/20 p-3 pt-5 shadow-[0_10px_18px_rgba(0,0,0,0.35)]"
      onContextMenu={onContextMenu}
      style={{ transform: `rotate(${note.tilt}deg)`, backgroundColor: note.color, color: note.text_color }}
    >
      <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-stone-900 bg-red-500" />
      {imageSrc ? (
        <div className="mb-2 h-28 w-full shrink-0 overflow-hidden border-4 border-white bg-stone-200 shadow">
          <img alt={`Picture from ${note.author_username}`} className="h-full w-full object-cover" draggable={false} src={imageSrc} />
        </div>
      ) : null}
      {note.text ? (
        <p className={`min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words ${imageSrc ? "text-sm" : "text-base"}`} style={noteTextStyle(note)}>
          {note.text}
        </p>
      ) : (
        <div className="flex-1" />
      )}
      <footer className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
        <Link className="truncate font-bold hover:underline" to={`/u/${note.author_username}`}>
          @{note.author_username}
        </Link>
        <span className="flex shrink-0 items-center gap-1">
          {actions}
          <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
        </span>
      </footer>
    </article>
  );
}
