/*
This file tests the color circle: color math, picking by pointer, brightness, typed hex colors, and arrow keys.
Edit this file when the color picker behavior changes.
Copy a test pattern here when you add tests for another custom input control.
*/

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ColorWheel, hexToHsv, hsvToHex } from "./ColorWheel";

function Harness({ onChange, start = "#ff0000" }: { onChange: (hex: string) => void; start?: string }) {
  const [value, setValue] = useState(start);
  return (
    <ColorWheel
      label="Note color"
      onChange={(hex) => {
        setValue(hex);
        onChange(hex);
      }}
      value={value}
    />
  );
}

describe("color math", () => {
  it("turns hue, strength, and brightness into hex colors", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe("#ffffff");
    expect(hsvToHex({ h: 200, s: 0.5, v: 0 })).toBe("#000000");
  });

  it("turns hex colors back into the same hex colors", () => {
    for (const color of ["#fef08a", "#1c1917", "#ff00aa", "#123456", "#808080"]) {
      expect(hsvToHex(hexToHsv(color))).toBe(color);
    }
  });
});

describe("ColorWheel", () => {
  it("picks the hue from the angle and the strength from the distance to the center", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const wheel = screen.getByRole("slider", { name: "Note color circle" });
    vi.spyOn(wheel, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(wheel, { clientX: 50, clientY: 100, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith("#00ffff");
    expect(wheel).toHaveAttribute("aria-valuenow", "180");

    fireEvent.pointerDown(wheel, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith("#ffffff");
  });

  it("changes brightness and accepts a typed hex color", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Note color brightness"), { target: { value: "50" } });
    expect(onChange).toHaveBeenLastCalledWith("#800000");

    const hexInput = screen.getByLabelText("Note color hex");
    await userEvent.clear(hexInput);
    await userEvent.type(hexInput, "#00FF00");
    expect(onChange).toHaveBeenLastCalledWith("#00ff00");
    expect(screen.getByRole("slider", { name: "Note color circle" })).toHaveAttribute("aria-valuenow", "120");
  });

  it("moves the hue with arrow keys", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Note color circle" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("#ff2a00");
  });
});
