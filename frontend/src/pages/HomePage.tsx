/*
This file shows the logged-in home page with big cards linking to the five gounie pages.
Edit this file when the home page text or the list of pages changes.
Copy this file as a starting point when you add another simple logged-in page.
*/

import { Link } from "react-router-dom";
import { useAuth } from "../app/auth";

const PAGES = [
  { to: "/friday", title: "Is it Friday yet?", emoji: "📅", text: "The most important question of the week.", color: "bg-rose-200" },
  { to: "/wall", title: "The Wall", emoji: "📌", text: "Stick notes and pictures on anyone's wall.", color: "bg-yellow-200" },
  { to: "/eps-bet", title: "EPS-bet", emoji: "🎲", text: "Bet your karma on what happens next.", color: "bg-sky-200" },
  { to: "/urls", title: "the great url collection", emoji: "🔗", text: "Useful links, voted up and down by everyone.", color: "bg-lime-200" },
  { to: "/slots", title: "slots", emoji: "🎰", text: "Gamble your karma. Feeling lucky?", color: "bg-fuchsia-200" },
];

export function HomePage() {
  const { user } = useAuth();

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight">hi, {user?.username} 👋</h1>
        <p className="mt-2 text-stone-700">
          You have <strong>{user?.karma ?? 0} karma</strong>. Pick something silly to do.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PAGES.map((page) => (
          <Link
            className={`block rounded-2xl border-2 border-stone-900 p-6 shadow-[5px_5px_0_#1c1917] transition hover:-translate-y-1 hover:-rotate-1 ${page.color}`}
            key={page.to}
            to={page.to}
          >
            <span aria-hidden="true" className="text-5xl">
              {page.emoji}
            </span>
            <h2 className="mt-3 text-2xl font-black">{page.title}</h2>
            <p className="mt-1 text-stone-700">{page.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
