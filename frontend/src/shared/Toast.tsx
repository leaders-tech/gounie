/*
This file shows a small message at the bottom of the screen that hides itself after a moment.
Edit this file when toast look or timing changes.
Copy this file as a starting point when you add another tiny shared feedback component.
*/

import { useEffect, useState } from "react";

export function useToast(durationMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs]);

  return { message, showToast: setMessage };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border-2 border-stone-900 bg-stone-900 px-5 py-3 font-semibold text-amber-50 shadow-[4px_4px_0_#facc15]"
      role="alert"
    >
      {message}
    </div>
  );
}
