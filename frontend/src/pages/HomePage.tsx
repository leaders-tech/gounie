/*
This file shows the home page: page cards for logged-in users, or a login form plus the public pages for visitors.
Edit this file when the home page text, the list of pages, or the visitor login form changes.
Copy this file as a starting point when you add another page that looks different for visitors.
*/

import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth";
import { errorMessage } from "../shared/api";
import { Button, Card, ErrorText, TextField } from "../shared/ui";

type PageCard = {
  to: string;
  title: string;
  emoji: string;
  text: string;
  color: string;
  needsAccount: boolean;
};

const PAGES: PageCard[] = [
  { to: "/friday", title: "Is it Friday yet?", emoji: "📅", text: "The most important question of the week.", color: "bg-rose-200", needsAccount: false },
  { to: "/wall", title: "The Wall", emoji: "📌", text: "Stick notes and pictures on anyone's wall.", color: "bg-yellow-200", needsAccount: true },
  { to: "/eps-bet", title: "EPS-bet", emoji: "🎲", text: "Bet your karma on what happens next.", color: "bg-sky-200", needsAccount: false },
  {
    to: "/urls",
    title: "the great url collection",
    emoji: "🔗",
    text: "Very very very very very very-very useful websites for all you need. Contribute yourself!",
    color: "bg-lime-200",
    needsAccount: false,
  },
  { to: "/slots", title: "slots", emoji: "🎰", text: "Feeling lucky?", color: "bg-fuchsia-200", needsAccount: true },
];

function PageCards({ pages }: { pages: PageCard[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
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
  );
}

function VisitorHome() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (loginError) {
      setError(errorMessage(loginError, "Login failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight">gounie</h1>
        <p className="mt-2 text-stone-700">Look around, or log in to join in.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
        <Card className="space-y-4">
          <h2 className="text-2xl font-black">Login</h2>
          <form className="space-y-4" onSubmit={onSubmit}>
            <TextField autoComplete="username" label="Nickname" onChange={(event) => setUsername(event.target.value)} value={username} />
            <TextField
              autoComplete="current-password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <ErrorText>{error}</ErrorText>
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="flex justify-between text-sm font-semibold">
            <Link className="underline" to="/register">
              Create an account
            </Link>
            <Link className="underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
        </Card>
        <div className="space-y-4">
          <h2 className="text-2xl font-black">Open to everyone</h2>
          <PageCards pages={PAGES.filter((page) => !page.needsAccount)} />
          <p className="text-sm text-stone-600">With an account you can also bet on EPS-bet, add and vote on links, write on walls, and gamble.</p>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return <VisitorHome />;
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight">hi, {user.username} 👋</h1>
        <p className="mt-2 text-stone-700">
          You have <strong>{user.karma} karma</strong>.
        </p>
      </div>
      <PageCards pages={PAGES} />
    </section>
  );
}
