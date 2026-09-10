/*
This file shows "Is it Friday yet?": a huge red NO, or YES! with confetti on Fridays (viewer's local time).
Edit this file when the Friday check, the words, or the confetti change. Keep the page content to just the answer.
Copy this file as a starting point when you add another tiny single-purpose page.
*/

import confetti from "canvas-confetti";
import { useEffect, useState } from "react";

export function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

function fireConfetti() {
  void confetti({ particleCount: 180, spread: 110, origin: { y: 0.6 }, disableForReducedMotion: true });
}

export function FridayPage() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const friday = isFriday(now);

  useEffect(() => {
    if (!friday) {
      return;
    }
    fireConfetti();
    const timer = window.setInterval(fireConfetti, 5_000);
    return () => window.clearInterval(timer);
  }, [friday]);

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <p
        className={`select-none text-[clamp(7rem,28vw,20rem)] font-black leading-none tracking-tighter ${friday ? "text-emerald-500" : "text-red-600"}`}
        data-testid="friday-answer"
      >
        {friday ? "YES!" : "NO"}
      </p>
    </section>
  );
}
