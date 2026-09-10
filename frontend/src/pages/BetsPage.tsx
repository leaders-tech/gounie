/*
This file shows the EPS-bet page: all bets grouped by phase and the form to start a new bet.
Edit this file when the bet list, bet grouping, or the new bet form changes.
Copy this file as a starting point when you add another list page with a create form.
*/

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BetStatusBadge, betPhase, PoolBar } from "../features/bets/betParts";
import { errorMessage, postJson } from "../shared/api";
import { formatDateTime } from "../shared/format";
import { useLiveEvent } from "../shared/live";
import type { Bet } from "../shared/types";
import { Button, Card, ErrorText, PageTitle, TextArea, TextField } from "../shared/ui";

export function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function NewBetForm({ onCreated }: { onCreated: (bet: Bet) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(() => toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      setError("Please pick when betting closes.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await postJson<{ bet: Bet }>("/bets/create", { title, description, deadline_at: deadlineDate.toISOString() });
      onCreated(data.bet);
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form className="space-y-4" onSubmit={onSubmit}>
        <h2 className="text-xl font-black">Start a new bet</h2>
        <TextField
          label="Question"
          maxLength={140}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Will the cafeteria serve pizza on Monday?"
          value={title}
        />
        <TextArea label="Details (optional)" maxLength={2000} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
        <TextField label="Betting closes at" onChange={(event) => setDeadline(event.target.value)} type="datetime-local" value={deadline} />
        <p className="text-xs text-stone-600">
          You can't bet on your own question. After betting closes, you must reveal the outcome. If you don't within 7 days, everyone gets their karma back.
        </p>
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy} type="submit">
          {busy ? "Creating..." : "Create bet"}
        </Button>
      </form>
    </Card>
  );
}

function BetCard({ bet }: { bet: Bet }) {
  return (
    <Link
      className="block h-full rounded-2xl border-2 border-stone-900 bg-white p-5 shadow-[4px_4px_0_#1c1917] transition hover:-translate-y-0.5 hover:bg-yellow-50"
      to={`/eps-bet/${bet.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold">{bet.title}</h3>
        <BetStatusBadge bet={bet} />
      </div>
      <p className="mt-1 text-sm text-stone-600">
        by @{bet.creator_username} · betting closes {formatDateTime(bet.deadline_at)}
      </p>
      <div className="mt-3">
        <PoolBar no={bet.no_total} yes={bet.yes_total} />
      </div>
      <p className="mt-2 text-xs text-stone-600">
        {bet.wager_count} {bet.wager_count === 1 ? "bet" : "bets"} · {bet.comment_count} {bet.comment_count === 1 ? "message" : "messages"}
      </p>
    </Link>
  );
}

export function BetsPage() {
  const navigate = useNavigate();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await postJson<{ bets: Bet[] }>("/bets/list");
      setBets(data.bets);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveEvent((message) => {
    if (message.type === "bet.changed" || message.type === "bet.comment") {
      void load();
    }
  });

  const groups = [
    { key: "betting", title: "Open for bets", items: bets.filter((bet) => betPhase(bet) === "betting") },
    { key: "waiting", title: "Waiting for the outcome", items: bets.filter((bet) => betPhase(bet) === "waiting") },
    { key: "closed", title: "Closed", items: bets.filter((bet) => betPhase(bet) === "closed") },
  ];

  return (
    <section className="space-y-8">
      <PageTitle title="EPS-bet" subtitle="Bet karma on what will happen. If you are right, you get 2× your stake back. If not, it's gone." />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setShowForm((current) => !current)}>{showForm ? "Close the form" : "+ New bet"}</Button>
      </div>
      {showForm ? <NewBetForm onCreated={(bet) => navigate(`/eps-bet/${bet.id}`)} /> : null}
      <ErrorText>{error}</ErrorText>
      {loaded && !error && bets.length === 0 ? <p className="text-stone-600">No bets yet. Start the first one!</p> : null}
      {groups.map((group) =>
        group.items.length > 0 ? (
          <div key={group.key}>
            <h2 className="mb-3 text-2xl font-black">{group.title}</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {group.items.map((bet) => (
                <li key={bet.id}>
                  <BetCard bet={bet} />
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  );
}
