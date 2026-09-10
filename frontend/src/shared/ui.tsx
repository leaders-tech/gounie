/*
This file keeps the small shared UI pieces: card, page title, text fields, buttons, and error/info messages.
Edit this file when the shared look of forms, buttons, or cards changes.
Copy a component pattern here when you add another small shared UI piece.
*/

import { useId } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const FIELD_CLASS = "w-full rounded-xl border-2 border-stone-900 bg-amber-50 px-3 py-2 outline-none focus:bg-white focus:ring-4 focus:ring-yellow-300";

const BUTTON_VARIANTS = {
  primary: "bg-yellow-300",
  secondary: "bg-white",
  danger: "bg-rose-300",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-stone-900 bg-white p-6 shadow-[5px_5px_0_#1c1917] ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-4xl font-black tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-3xl text-stone-600">{subtitle}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, ...inputProps }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const hintId = useId();
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">{label}</span>
        <input aria-describedby={hint ? hintId : undefined} className={FIELD_CLASS} {...inputProps} />
      </label>
      {hint ? (
        <p className="mt-1 text-xs text-stone-500" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({ label, ...textareaProps }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea className={FIELD_CLASS} {...textareaProps} />
    </label>
  );
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...buttonProps
}: { variant?: keyof typeof BUTTON_VARIANTS } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-xl border-2 border-stone-900 px-4 py-2 font-bold shadow-[3px_3px_0_#1c1917] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      type={type}
      {...buttonProps}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }
  return (
    <p className="rounded-xl border-2 border-rose-700 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-800" role="alert">
      {children}
    </p>
  );
}

export function InfoText({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }
  return (
    <p className="rounded-xl border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status">
      {children}
    </p>
  );
}
