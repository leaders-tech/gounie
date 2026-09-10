/*
This file shows the right-click menu on a wall note: edit (author, rotation only), the joke "Delete", and, for admins, a real delete.
Edit this file when the note right-click menu items or closing rules change.
Copy this file as a starting point when you add another small custom context menu.
*/

import { useEffect, useRef } from "react";

type NoteContextMenuProps = {
  x: number;
  y: number;
  canEdit: boolean;
  canFakeDelete: boolean;
  canAdminDelete: boolean;
  onEdit: () => void;
  onFakeDelete: () => void;
  onAdminDelete: () => void;
  onClose: () => void;
};

export function NoteContextMenu({ x, y, canEdit, canFakeDelete, canAdminDelete, onEdit, onFakeDelete, onAdminDelete, onClose }: NoteContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    // The menu uses page coordinates, so it moves together with the page and does not need to close on scroll.
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const itemClass = "block w-full px-4 py-2 text-left font-semibold";

  return (
    <div
      className="absolute z-40 min-w-48 overflow-hidden rounded-xl border-2 border-stone-900 bg-white py-1 shadow-[4px_4px_0_#1c1917]"
      ref={menuRef}
      role="menu"
      style={{ left: Math.max(8, Math.min(x, document.documentElement.scrollWidth - 220)), top: Math.max(8, y) }}
    >
      {canEdit ? (
        <button className={`${itemClass} hover:bg-yellow-100`} onClick={onEdit} role="menuitem" type="button">
          ✏️ Edit
        </button>
      ) : null}
      {canFakeDelete ? (
        <button className={`${itemClass} hover:bg-rose-100`} onClick={onFakeDelete} role="menuitem" type="button">
          🗑️ Delete
        </button>
      ) : null}
      {canAdminDelete ? (
        <button className={`${itemClass} hover:bg-amber-100`} onClick={onAdminDelete} role="menuitem" type="button">
          🛡️ Really delete (admin)
        </button>
      ) : null}
    </div>
  );
}
