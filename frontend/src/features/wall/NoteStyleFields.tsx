/*
This file shows the note look controls: text style buttons, note and text color circles, and the rotation slider.
Edit this file when note look options change. The look is chosen when posting; later only the rotation can change.
Copy this file as a starting point when you add another group of shared form controls.
*/

import type { CSSProperties } from "react";
import { ColorWheel } from "../../shared/ColorWheel";
import type { NoteStyle } from "../../shared/types";

export const MAX_ROTATION = 180;

export const DEFAULT_NOTE_STYLE: NoteStyle = {
  color: "#fef08a",
  text_color: "#1c1917",
  tilt: -3,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

type TextStyleKey = "bold" | "italic" | "underline" | "strikethrough";

const TEXT_STYLE_BUTTONS: { key: TextStyleKey; label: string; letter: string; look: CSSProperties }[] = [
  { key: "bold", label: "Bold", letter: "B", look: { fontWeight: 900 } },
  { key: "italic", label: "Italic", letter: "I", look: { fontStyle: "italic" } },
  { key: "underline", label: "Underline", letter: "U", look: { textDecorationLine: "underline" } },
  { key: "strikethrough", label: "Strikethrough", letter: "S", look: { textDecorationLine: "line-through" } },
];

function toggleClass(pressed: boolean): string {
  return `h-9 min-w-9 rounded-lg border-2 border-stone-900 px-2 text-sm transition ${pressed ? "bg-stone-900 text-amber-50" : "bg-white hover:bg-yellow-100"}`;
}

export function RotationField({ value, onChange }: { value: number; onChange: (rotation: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">Rotation: {value}°</span>
      <input
        className="w-full accent-stone-900"
        max={MAX_ROTATION}
        min={-MAX_ROTATION}
        onChange={(event) => onChange(Number(event.target.value))}
        step={1}
        type="range"
        value={value}
      />
    </label>
  );
}

type NoteStyleFieldsProps = {
  style: NoteStyle;
  onChange: (style: NoteStyle) => void;
};

export function NoteStyleFields({ style, onChange }: NoteStyleFieldsProps) {
  const isRegular = !style.bold && !style.italic && !style.underline && !style.strikethrough;

  const toggle = (key: TextStyleKey) => {
    const next = { ...style };
    next[key] = !style[key];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold">Text style</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            aria-pressed={isRegular}
            className={toggleClass(isRegular)}
            onClick={() => onChange({ ...style, bold: false, italic: false, underline: false, strikethrough: false })}
            type="button"
          >
            Regular
          </button>
          {TEXT_STYLE_BUTTONS.map((option) => (
            <button
              aria-label={option.label}
              aria-pressed={style[option.key]}
              className={toggleClass(style[option.key])}
              key={option.key}
              onClick={() => toggle(option.key)}
              style={option.look}
              title={option.label}
              type="button"
            >
              {option.letter}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 lg:grid-cols-2">
        <ColorWheel label="Note color" onChange={(color) => onChange({ ...style, color })} value={style.color} />
        <ColorWheel label="Text color" onChange={(text_color) => onChange({ ...style, text_color })} value={style.text_color} />
      </div>
      <RotationField onChange={(tilt) => onChange({ ...style, tilt })} value={style.tilt} />
    </div>
  );
}
