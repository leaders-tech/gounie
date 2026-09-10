"""Keep the slot machine symbols, pay table, and random spin logic.

Edit this file when slot symbols, payouts, or win chances change. Keep expected_payback() at 0.10 or lower.
Copy this file as a starting point when you add another small pure game helper.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

CHERRY = "🍒"
LEMON = "🍋"
BELL = "🔔"
STAR = "⭐"
SEVEN = "7️⃣"
DIAMOND = "💎"
SYMBOLS = (CHERRY, LEMON, BELL, STAR, SEVEN, DIAMOND)
TOTAL_WEIGHT = 10_000


@dataclass(frozen=True, slots=True)
class PayLine:
    name: str
    label: str
    multiplier: int
    weight: int  # chance of this result = weight / TOTAL_WEIGHT


PAY_TABLE = (
    PayLine("diamonds", "💎 💎 💎", 50, 6),
    PayLine("sevens", "7️⃣ 7️⃣ 7️⃣", 20, 10),
    PayLine("cherries", "🍒 🍒 🍒", 5, 40),
    PayLine("two_cherries", "🍒 🍒 + any", 1, 300),
)
TRIPLE_MULTIPLIERS = {DIAMOND: 50, SEVEN: 20, CHERRY: 5}


def expected_payback() -> float:
    """Average karma returned for every 1 karma spun. 0.10 means players lose 90% on average."""
    return sum(line.multiplier * line.weight for line in PAY_TABLE) / TOTAL_WEIGHT


def evaluate_reels(reels: list[str]) -> int:
    if reels[0] == reels[1] == reels[2]:
        return TRIPLE_MULTIPLIERS.get(reels[0], 0)
    if reels.count(CHERRY) == 2:
        return 1
    return 0


def _winning_reels(line: PayLine, rng: random.Random) -> list[str]:
    if line.name == "diamonds":
        return [DIAMOND] * 3
    if line.name == "sevens":
        return [SEVEN] * 3
    if line.name == "cherries":
        return [CHERRY] * 3
    reels = [CHERRY, CHERRY, rng.choice([symbol for symbol in SYMBOLS if symbol != CHERRY])]
    rng.shuffle(reels)
    return reels


def _losing_reels(rng: random.Random) -> list[str]:
    while True:
        reels = [rng.choice(SYMBOLS) for _ in range(3)]
        if len(set(reels)) > 1 and reels.count(CHERRY) < 2:
            return reels


def spin(rng: random.Random) -> tuple[list[str], PayLine | None]:
    """Pick the result first from the weighted pay table, then draw reels that show that result."""
    roll = rng.randrange(TOTAL_WEIGHT)
    for line in PAY_TABLE:
        if roll < line.weight:
            return _winning_reels(line, rng), line
        roll -= line.weight
    return _losing_reels(rng), None


def pay_table_json() -> list[dict[str, object]]:
    """What players see: symbols and payouts. The chances stay secret, so players find out by playing."""
    return [{"name": line.name, "label": line.label, "multiplier": line.multiplier} for line in PAY_TABLE]
