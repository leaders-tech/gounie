/*
This file shows one EPS-bet: details, placing a wager, revealing the outcome, admin tools, all wagers, and the discussion.
Edit this file when the bet detail page, wager form, reveal flow, or bet discussion changes.
Copy this file as a starting point when you add another detail page with actions and comments.
*/

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../app/auth";
import { BetStatusBadge, betPhase, PoolBar } from "../features/bets/betParts";
import { errorMessage, postJson } from "../shared/api";
import { Avatar } from "../shared/Avatar";
import { formatDateTime } from "../shared/format";
import { useLiveEvent } from "../shared/live";
import type { Bet, BetComment, BetSide, Wager } from "../shared/types";
import { Button, Card, ErrorText, TextArea } from "../shared/ui";

type BetDetails = { bet: Bet; wagers: Wager[]; comments: BetComment[] };

function SideLabel({ side }: { side: BetSide }) {
  return (
    <span className={`rounded-full border-2 border-stone-900 px-2 py-0.5 text-xs font-black ${side === "yes" ? "bg-lime-300" : "bg-rose-300"}`}>
      {side === "yes" ? "YES" : "NO"}
    </span>
  );
}

export function BetDetailPage() {
  const { betId } = useParams();
  const id = Number(betId);
  const { user, setKarma } = useAuth();
  const [details, setDetails] = useState<BetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState<BetSide>("yes");
  const [amount, setAmount] = useState("10");
  const [comment, setComment] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    try {
      setDetails(await postJson<BetDetails>("/bets/get", { id }));
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveEvent((message) => {
    if ((message.type === "bet.changed" || message.type === "bet.comment") && message.bet_id === id) {
      void load();
    }
  });

  if (loading) {
    return <p className="text-stone-600">Loading bet...</p>;
  }
  if (!details) {
    return <ErrorText>{error || "This bet does not exist."}</ErrorText>;
  }

  const { bet, wagers, comments } = details;
  const phase = betPhase(bet);
  const isLive = bet.approval === "approved";
  const isCreator = user ? bet.creator_id === user.id : false;
  const myWager = user ? wagers.find((wager) => wager.user_id === user.id) : undefined;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await action();
      await load();
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure));
    } finally {
      setBusy(false);
    }
  };

  const placeWager = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const data = await postJson<{ karma: number }>("/bets/wager", { bet_id: bet.id, side, amount: Number(amount) });
      setKarma(data.karma);
    });
  };

  const postComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      await postJson("/bets/comment", { bet_id: bet.id, text: comment });
      setComment("");
    });
  };

  const closeAction = (path: string, body: Record<string, unknown>) => () => void run(async () => void (await postJson(path, { bet_id: bet.id, ...body })));

  let yourMove: React.ReactNode;
  if (bet.approval === "pending") {
    yourMove = (
      <p>
        An admin still has to read this bet. Nobody else can see it yet. You get an email as soon as it is approved or not.
        {bet.creator_id === user?.id ? "" : " Only you and the admin can see this page."}
      </p>
    );
  } else if (bet.approval === "declined") {
    yourMove = (
      <div className="space-y-2">
        <p>This bet was not approved, so it never went live. Nobody lost any karma.</p>
        {bet.review_note ? <p className="text-sm text-stone-600">The admin said: {bet.review_note}</p> : null}
      </div>
    );
  } else if (!user) {
    yourMove = (
      <p>
        <Link className="font-bold underline" to="/login">
          Log in
        </Link>{" "}
        to place a bet or write a message.
      </p>
    );
  } else if (isCreator && phase === "waiting") {
    yourMove = (
      <div className="space-y-3">
        {myWager ? (
          <p>
            You bet <strong>{myWager.amount} karma</strong> on <SideLabel side={myWager.side} />. Now reveal what happened.
          </p>
        ) : null}
        <p className="font-semibold">Betting is over. What happened?</p>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={closeAction("/bets/resolve", { outcome: "yes" })}>
            It was YES
          </Button>
          <Button disabled={busy} onClick={closeAction("/bets/resolve", { outcome: "no" })} variant="danger">
            It was NO
          </Button>
        </div>
        <p className="text-xs text-stone-600">If you don't reveal within 7 days after the deadline, everyone gets their karma back.</p>
      </div>
    );
  } else if (myWager) {
    yourMove = (
      <p>
        You bet <strong>{myWager.amount} karma</strong> on <SideLabel side={myWager.side} />.{" "}
        {myWager.payout === null ? "Now wait for the outcome." : `You got ${myWager.payout} karma back.`}
      </p>
    );
  } else if (phase === "closed") {
    yourMove = <p>This bet is closed.</p>;
  } else if (phase === "betting") {
    yourMove = (
      <form className="space-y-3" onSubmit={placeWager}>
        <div aria-label="Pick a side" className="flex gap-3" role="group">
          {(["yes", "no"] as BetSide[]).map((option) => (
            <button
              aria-pressed={side === option}
              className={`flex-1 rounded-xl border-2 border-stone-900 px-4 py-3 text-xl font-black ${side === option ? (option === "yes" ? "bg-lime-300" : "bg-rose-300") : "bg-white text-stone-400"}`}
              key={option}
              onClick={() => setSide(option)}
              type="button"
            >
              {option === "yes" ? "YES" : "NO"}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Stake (karma)</span>
          <input
            className="w-40 rounded-xl border-2 border-stone-900 bg-amber-50 px-3 py-2 text-lg font-bold"
            min={1}
            onChange={(event) => setAmount(event.target.value)}
            step={1}
            type="number"
            value={amount}
          />
        </label>
        <p className="text-sm text-stone-600">
          You have {user?.karma ?? 0} karma. The stake is taken now. If you are right, you get 2× back. One bet per person, no changes.
        </p>
        <Button disabled={busy} type="submit">
          Place bet
        </Button>
      </form>
    );
  } else {
    yourMove = <p>Betting is over. Waiting for @{bet.creator_username} to reveal the outcome.</p>;
  }

  return (
    <section className="space-y-6">
      <Link className="text-sm font-semibold hover:underline" to="/eps-bet">
        ← all bets
      </Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-black">{bet.title}</h1>
          <BetStatusBadge bet={bet} />
        </div>
        {bet.description ? <p className="mt-3 whitespace-pre-wrap">{bet.description}</p> : null}
        <p className="mt-3 text-sm text-stone-600">
          Created by{" "}
          <Link className="font-bold hover:underline" to={`/u/${bet.creator_username}`}>
            @{bet.creator_username}
          </Link>{" "}
          · betting closes {formatDateTime(bet.deadline_at)}
        </p>
        <div className="mt-4">
          <PoolBar no={bet.no_total} yes={bet.yes_total} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-black">Your move</h2>
        {yourMove}
        <ErrorText>{actionError}</ErrorText>
      </Card>

      {user?.is_admin && bet.approval === "pending" ? (
        <Card className="space-y-3 bg-amber-100">
          <h2 className="text-xl font-black">🛡️ Waiting for your decision</h2>
          <p className="text-sm text-stone-700">@{bet.creator_username} gets an email with your decision. Only approved bets are published.</p>
          <TextArea
            label="Note for the creator (optional)"
            maxLength={500}
            onChange={(event) => setReviewNote(event.target.value)}
            rows={2}
            value={reviewNote}
          />
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} onClick={closeAction("/admin/bets/approve", { note: reviewNote })}>
              Approve and publish
            </Button>
            <Button disabled={busy} onClick={closeAction("/admin/bets/decline", { note: reviewNote })} variant="danger">
              Decline
            </Button>
          </div>
        </Card>
      ) : null}

      {user?.is_admin && isLive && bet.status === "open" ? (
        <Card className="space-y-3 bg-amber-100">
          <h2 className="text-xl font-black">🛡️ Admin tools</h2>
          <div className="flex flex-wrap gap-3">
            <Button disabled={busy} onClick={closeAction("/admin/bets/resolve", { outcome: "yes" })} variant="secondary">
              Resolve as YES
            </Button>
            <Button disabled={busy} onClick={closeAction("/admin/bets/resolve", { outcome: "no" })} variant="secondary">
              Resolve as NO
            </Button>
            <Button disabled={busy} onClick={closeAction("/admin/bets/cancel", {})} variant="danger">
              Cancel and refund
            </Button>
          </div>
        </Card>
      ) : null}

      {isLive ? (
        <>
          <Card>
            <h2 className="text-xl font-black">Bets ({wagers.length})</h2>
            {wagers.length === 0 ? (
              <p className="mt-2 text-stone-600">Nobody has placed a bet yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-stone-200">
                {wagers.map((wager) => (
                  <li className="flex flex-wrap items-center gap-3 py-2" key={wager.id}>
                    <Link className="flex items-center gap-2 font-bold hover:underline" to={`/u/${wager.username}`}>
                      <Avatar size="sm" username={wager.username} />
                      {wager.username}
                    </Link>
                    <SideLabel side={wager.side} />
                    <span className="ml-auto font-semibold">{wager.amount} karma</span>
                    {wager.payout !== null ? <span className="text-sm text-stone-600">got back {wager.payout}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-xl font-black">Discussion</h2>
            {comments.length === 0 ? <p className="text-stone-600">No messages yet. Say something smart.</p> : null}
            <ul className="space-y-3">
              {comments.map((item) => (
                <li className="flex gap-3" key={item.id}>
                  <Avatar size="sm" username={item.author_username} />
                  <div className="min-w-0 flex-1 rounded-xl border-2 border-stone-900 bg-amber-50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                      <Link className="font-bold text-stone-900 hover:underline" to={`/u/${item.author_username}`}>
                        @{item.author_username}
                      </Link>
                      <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
                      {user?.is_admin ? (
                        <button
                          className="ml-auto font-semibold text-rose-700 hover:underline"
                          onClick={() => void run(async () => void (await postJson("/admin/comments/delete", { id: item.id })))}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            {user ? (
              <form className="space-y-3" onSubmit={postComment}>
                <TextArea label="Your message" maxLength={1000} onChange={(event) => setComment(event.target.value)} rows={3} value={comment} />
                <Button disabled={busy || !comment.trim()} type="submit">
                  Post message
                </Button>
              </form>
            ) : (
              <p className="text-stone-600">
                <Link className="font-bold underline" to="/login">
                  Log in
                </Link>{" "}
                to write a message.
              </p>
            )}
          </Card>
        </>
      ) : null}
    </section>
  );
}
