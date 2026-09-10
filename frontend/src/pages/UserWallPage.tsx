/*
This file shows one user's page: plain avatar, karma, the note composer, and their wall of sticky notes.
Edit this file when the user wall page, the right-click menu flow, editing (rotating) a note, or live wall updates change.
Copy this file as a starting point when you add another page that shows one user's content.
*/

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../app/auth";
import { NoteComposer } from "../features/wall/NoteComposer";
import { NoteContextMenu } from "../features/wall/NoteContextMenu";
import { NoteRotationEditor } from "../features/wall/NoteRotationEditor";
import { StickyNote } from "../features/wall/StickyNote";
import { apiUrl, errorMessage, postJson } from "../shared/api";
import { Avatar } from "../shared/Avatar";
import { formatDate } from "../shared/format";
import { useLiveEvent } from "../shared/live";
import { Toast, useToast } from "../shared/Toast";
import type { PublicUser, WallNote } from "../shared/types";
import { ErrorText } from "../shared/ui";

const WHOOPS = "whoops.. something went wrong";

type MenuState = { note: WallNote; x: number; y: number };

function noteImageSrc(note: WallNote): string | null {
  return note.has_image ? apiUrl(`/wall/image/${note.id}`) : null;
}

export function UserWallPage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const [owner, setOwner] = useState<PublicUser | null>(null);
  const [notes, setNotes] = useState<WallNote[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editing, setEditing] = useState<WallNote | null>(null);
  const { message, showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await postJson<{ owner: PublicUser; notes: WallNote[] }>("/wall/list", { username });
      setOwner(data.owner);
      setNotes(data.notes);
      setError("");
    } catch (loadError) {
      setOwner(null);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useLiveEvent((liveMessage) => {
    if (liveMessage.type === "wall.changed" && owner && liveMessage.wall_user_id === owner.id) {
      void load();
    }
  });

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeEditor = useCallback(() => setEditing(null), []);

  if (!user) {
    return null;
  }
  if (loading) {
    return <p className="text-stone-600">Loading wall...</p>;
  }
  if (!owner) {
    return <ErrorText>{error || "This user does not exist."}</ErrorText>;
  }

  const isOwnWall = owner.id === user.id;
  const isAuthor = (note: WallNote) => note.author_id === user.id;
  const canFakeDelete = (note: WallNote) => isAuthor(note) || isOwnWall;

  const openMenu = (note: WallNote) => (event: React.MouseEvent<HTMLElement>) => {
    if (!canFakeDelete(note) && !user.is_admin) {
      return;
    }
    event.preventDefault();
    setMenu({ note, x: event.pageX, y: event.pageY });
  };

  const fakeDelete = async (note: WallNote) => {
    setMenu(null);
    try {
      await postJson("/wall/delete", { id: note.id });
      showToast(WHOOPS);
    } catch (deleteError) {
      showToast(errorMessage(deleteError, WHOOPS));
    }
  };

  const adminDelete = async (note: WallNote) => {
    setMenu(null);
    try {
      await postJson("/admin/wall/delete", { id: note.id });
      showToast("Note deleted by admin.");
      await load();
    } catch (deleteError) {
      showToast(errorMessage(deleteError));
    }
  };

  const onNoteSaved = (saved: WallNote) => {
    setNotes((current) => current.map((note) => (note.id === saved.id ? saved : note)));
    setEditing(null);
    showToast("Note updated.");
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="lg" username={owner.username} />
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            {owner.username}
            {isOwnWall ? <span className="ml-2 align-middle text-base font-semibold text-stone-500">(you)</span> : null}
          </h1>
          <p className="text-stone-700">
            <strong>{isOwnWall ? user.karma : owner.karma}</strong> karma · joined {formatDate(owner.created_at)}
            {owner.is_admin ? " · admin" : ""}
          </p>
        </div>
      </div>

      <NoteComposer authorName={user.username} isOwnWall={isOwnWall} onPosted={() => void load()} wallOwner={owner.username} />

      <div className="cork-board rounded-2xl border-4 border-amber-900 p-6 sm:p-10" data-testid="wall-board">
        {notes.length === 0 ? (
          <p className="rounded-xl bg-white/85 p-4 text-center font-semibold">This wall is empty. Be the first to stick something here!</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] justify-items-center gap-x-6 gap-y-10">
            {notes.map((note) => (
              <StickyNote
                actions={
                  isAuthor(note) ? (
                    <button aria-label="Edit this note" className="rounded px-1 hover:bg-black/10" onClick={() => setEditing(note)} title="Edit" type="button">
                      ✏️
                    </button>
                  ) : null
                }
                imageSrc={noteImageSrc(note)}
                key={note.id}
                note={note}
                onContextMenu={openMenu(note)}
              />
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-xs font-semibold text-amber-50">
          Tip: everything on the wall can be edited and deleted. Right-click your notes to do it.
        </p>
      </div>

      {menu ? (
        <NoteContextMenu
          canAdminDelete={user.is_admin}
          canEdit={isAuthor(menu.note)}
          canFakeDelete={canFakeDelete(menu.note)}
          onAdminDelete={() => void adminDelete(menu.note)}
          onClose={closeMenu}
          onEdit={() => {
            setEditing(menu.note);
            setMenu(null);
          }}
          onFakeDelete={() => void fakeDelete(menu.note)}
          x={menu.x}
          y={menu.y}
        />
      ) : null}
      {editing ? <NoteRotationEditor imageSrc={noteImageSrc(editing)} note={editing} onClose={closeEditor} onSaved={onNoteSaved} /> : null}
      <Toast message={message} />
    </section>
  );
}
