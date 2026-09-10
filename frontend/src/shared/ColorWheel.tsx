/*
This file shows a color circle: click or drag on the circle to pick the color, a brightness slider, and a hex color field.
Edit this file when the color picker look or its color math changes.
Copy this file as a starting point when you add another small custom input control.
*/

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

/** Hue 0-360, saturation 0-1, brightness (value) 0-1. */
export type Hsv = { h: number; s: number; v: number };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const WHEEL_BACKGROUND =
  "radial-gradient(circle closest-side, #ffffff, rgba(255, 255, 255, 0)), conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

export function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

type ColorWheelProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  size?: number;
};

export function ColorWheel({ label, value, onChange, size = 136 }: ColorWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);
  const brightnessId = useId();

  useEffect(() => {
    // Follow color changes from outside, but keep the chosen hue when the color did not really change (for example black).
    setHsv((current) => (hsvToHex(current) === value.toLowerCase() ? current : hexToHsv(value)));
    setHexText(value);
  }, [value]);

  const hex = hsvToHex(hsv);

  const choose = (next: Hsv) => {
    setHsv(next);
    const nextHex = hsvToHex(next);
    setHexText(nextHex);
    onChange(nextHex);
  };

  const pickAt = (clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return;
    }
    const radius = rect.width / 2;
    const dx = clientX - (rect.left + radius);
    const dy = clientY - (rect.top + radius);
    // The angle from the top of the circle, going clockwise, is the hue. The distance from the center is the strength.
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / radius);
    choose({ h, s, v: hsv.v === 0 ? 1 : hsv.v });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers and test environments cannot capture the pointer. Picking still works.
    }
    pickAt(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons & 1) {
      pickAt(event.clientX, event.clientY);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const changes: Record<string, Partial<Hsv>> = {
      ArrowRight: { h: (hsv.h + 10) % 360 },
      ArrowLeft: { h: (hsv.h + 350) % 360 },
      ArrowUp: { s: Math.min(1, hsv.s + 0.1) },
      ArrowDown: { s: Math.max(0, hsv.s - 0.1) },
    };
    const change = changes[event.key];
    if (!change) {
      return;
    }
    event.preventDefault();
    choose({ ...hsv, ...change, v: hsv.v === 0 ? 1 : hsv.v });
  };

  const angle = (hsv.h * Math.PI) / 180;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap items-center gap-3">
        <div
          aria-label={`${label} circle`}
          aria-valuemax={360}
          aria-valuemin={0}
          aria-valuenow={Math.round(hsv.h)}
          aria-valuetext={hex}
          className="relative shrink-0 cursor-crosshair touch-none rounded-full border-2 border-stone-900 outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          ref={wheelRef}
          role="slider"
          style={{ width: size, height: size, background: WHEEL_BACKGROUND }}
          tabIndex={0}
        >
          <div className="pointer-events-none absolute inset-0 rounded-full bg-black" style={{ opacity: 1 - hsv.v }} />
          <span
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_#1c1917]"
            style={{ left: `${50 + Math.sin(angle) * hsv.s * 50}%`, top: `${50 - Math.cos(angle) * hsv.s * 50}%`, backgroundColor: hex }}
          />
        </div>
        <div className="w-32 space-y-2">
          <div>
            <label className="block text-xs font-semibold" htmlFor={brightnessId}>
              Brightness
            </label>
            <input
              aria-label={`${label} brightness`}
              className="block w-full accent-stone-900"
              id={brightnessId}
              max={100}
              min={0}
              onChange={(event) => choose({ ...hsv, v: Number(event.target.value) / 100 })}
              type="range"
              value={Math.round(hsv.v * 100)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full border-2 border-stone-900" style={{ backgroundColor: hex }} />
            <input
              aria-label={`${label} hex`}
              className="w-full rounded-lg border-2 border-stone-900 px-2 py-1 font-mono text-sm"
              maxLength={7}
              onChange={(event) => {
                const next = event.target.value.trim();
                setHexText(next);
                if (isHexColor(next)) {
                  choose(hexToHsv(next));
                }
              }}
              spellCheck={false}
              value={hexText}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}
