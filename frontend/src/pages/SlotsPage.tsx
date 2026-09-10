/*
This file shows the slot machine: stake input, spinning reels, the result, the pay table, and recent spins.
Edit this file when the slot machine look, spin animation, or slots page text changes.
Copy this file as a starting point when you add another small animated game page.
*/

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../app/auth";
import { errorMessage, postJson } from "../shared/api";
import { signed } from "../shared/format";
import type { PayLine, SpinResult } from "../shared/types";
import { Card, ErrorText, PageTitle } from "../shared/ui";

const SPIN_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "💎"];
const QUICK_STAKES = [1, 5, 10, 25];
const MIN_SPIN_MS = 900;
const REEL_STOP_GAP_MS = 250;

type SlotsInfo = { pay_table: PayLine[]; karma_floor: number };
type SpinRecord = SpinResult & { id: number; stake: number };

function randomSymbol(): string {
  return SPIN_SYMBOLS[Math.floor(Math.random() * SPIN_SYMBOLS.length)];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resultText(record: SpinRecord): string {
  if (record.payout > record.stake) {
    return `🎉 You won ${record.payout} karma!`;
  }
  if (record.payout === record.stake) {
    return "Your stake came back. Lucky-ish.";
  }
  return "No win this time.";
}

export function SlotsPage() {
  const { user, setKarma } = useAuth();
  const [info, setInfo] = useState<SlotsInfo | null>(null);
  const [stake, setStake] = useState("5");
  const [reels, setReels] = useState(["🍒", "7️⃣", "💎"]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SpinRecord[]>([]);
  const shuffleTimer = useRef<number | null>(null);

  useEffect(() => {
    postJson<SlotsInfo>("/slots/info")
      .then(setInfo)
      .catch((loadError) => setError(errorMessage(loadError)));
    return () => {
      if (shuffleTimer.current !== null) {
        window.clearInterval(shuffleTimer.current);
      }
    };
  }, []);

  const spin = async () => {
    const stakeValue = Number(stake);
    const stopped = { count: 0 };
    setBusy(true);
    setError("");
    setSpinning([true, true, true]);
    shuffleTimer.current = window.setInterval(() => {
      setReels((current) => current.map((symbol, index) => (index < stopped.count ? symbol : randomSymbol())));
    }, 80);
    const startedAt = Date.now();
    try {
      const data = await postJson<SpinResult>("/slots/spin", { stake: stakeValue });
      await wait(Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt)));
      for (let index = 0; index < 3; index += 1) {
        stopped.count = index + 1;
        setReels((current) => current.map((symbol, reelIndex) => (reelIndex === index ? data.reels[index] : symbol)));
        setSpinning((current) => current.map((value, reelIndex) => (reelIndex === index ? false : value)));
        if (index < 2) {
          await wait(REEL_STOP_GAP_MS);
        }
      }
      setKarma(data.karma);
      setHistory((current) => [{ ...data, id: startedAt, stake: stakeValue }, ...current].slice(0, 8));
    } catch (spinError) {
      setSpinning([false, false, false]);
      setError(errorMessage(spinError));
    } finally {
      if (shuffleTimer.current !== null) {
        window.clearInterval(shuffleTimer.current);
        shuffleTimer.current = null;
      }
      setBusy(false);
    }
  };

  const latest = history[0];

  return (
    <section className="space-y-6">
      <PageTitle title="slots" subtitle="Spin to gamble your karma. Feeling lucky?" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-3xl border-4 border-stone-900 bg-gradient-to-b from-fuchsia-500 to-rose-600 p-6 shadow-[8px_8px_0_#1c1917]">
          <p className="text-center text-2xl font-black tracking-widest text-yellow-200 drop-shadow">★ GOUNIE SLOTS ★</p>
          <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border-4 border-stone-900 bg-stone-900 p-3" data-testid="reels">
            {reels.map((symbol, index) => (
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-amber-50 text-[clamp(2.5rem,9vw,5rem)]" key={index}>
                <span className={spinning[index] ? "reel-spinning" : ""}>{symbol}</span>
              </div>
            ))}
          </div>
          <p aria-live="polite" className="mt-4 min-h-8 text-center text-xl font-black text-white" data-testid="spin-result">
            {busy ? "Spinning..." : latest ? resultText(latest) : "Feeling lucky?"}
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-center gap-2">
            <label className="text-white">
              <span className="mb-1 block text-sm font-bold">Stake (karma)</span>
              <input
                className="w-28 rounded-xl border-2 border-stone-900 px-3 py-2 text-lg font-bold text-stone-900"
                min={1}
                onChange={(event) => setStake(event.target.value)}
                step={1}
                type="number"
                value={stake}
              />
            </label>
            {QUICK_STAKES.map((value) => (
              <button
                className="rounded-full border-2 border-stone-900 bg-white px-3 py-1 font-bold"
                key={value}
                onClick={() => setStake(String(value))}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
          <button
            className="mx-auto mt-5 block w-full max-w-xs rounded-2xl border-4 border-stone-900 bg-yellow-300 py-4 text-3xl font-black shadow-[0_6px_0_#1c1917] active:translate-y-1 active:shadow-[0_2px_0_#1c1917] disabled:opacity-60"
            disabled={busy}
            onClick={() => void spin()}
            type="button"
          >
            SPIN
          </button>
          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-white/90">
            You have {user?.karma ?? 0} karma. Your karma can't go below {info?.karma_floor ?? "the floor"}.
          </p>
        </div>
        <aside className="space-y-4">
          <Card>
            <h2 className="text-lg font-black">Pay table</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {info?.pay_table.map((line) => (
                  <tr className="border-b border-stone-200 last:border-0" key={line.name}>
                    <td className="py-1.5 text-base">{line.label}</td>
                    <td className="text-right font-black">{line.multiplier}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-stone-600">A win pays your stake times the number.</p>
          </Card>
          <Card>
            <h2 className="text-lg font-black">Last spins</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-stone-600">No spins yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm" data-testid="spin-history">
                {history.map((record) => (
                  <li className="flex justify-between gap-2" key={record.id}>
                    <span>{record.reels.join(" ")}</span>
                    <span className={`font-bold ${record.payout - record.stake >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {signed(record.payout - record.stake)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </section>
  );
}
