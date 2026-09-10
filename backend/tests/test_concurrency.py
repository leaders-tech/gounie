"""Test that many requests at the same time (sign-ups, wall posts, spins, votes) do not break each other.

Edit this file when shared database connection or transaction handling changes.
Copy a test pattern here when you add another test that fires requests in parallel.
"""

from __future__ import annotations

import asyncio

import pytest

from backend.db.karma import get_karma
from backend.tests.conftest import api, login_as


@pytest.mark.asyncio
async def test_parallel_writes_do_not_break_each_other(client, db, create_user, monkeypatch) -> None:
    spinner_id = await create_user("spinner")
    author_id = await create_user("author")
    spinner = await login_as(client, "spinner")
    author = await login_as(client, "author")
    monkeypatch.setattr("backend.http.slot_routes.spin", lambda _rng: (["🍋", "🔔", "⭐"], None))
    _, payload = await api(client, "/api/links/create", {"url": "https://example.org/", "title": "Example"}, author)
    link_id = payload["data"]["link"]["id"]

    voters = []
    for index in range(6):
        await create_user(f"voter{index}")
        voters.append(await login_as(client, f"voter{index}"))

    async def signup(index: int):
        return await api(client, "/api/auth/register", {"username": f"racer{index}", "email": f"racer{index}@example.edu", "password": "password1"})

    async def post_note(index: int):
        return await api(client, "/api/wall/post", {"username": "author", "text": f"note {index}", "color": "#fef08a", "tilt": 0}, spinner)

    async def spin_once():
        return await api(client, "/api/slots/spin", {"stake": 1}, spinner)

    async def vote(cookies):
        return await api(client, "/api/links/vote", {"link_id": link_id, "value": 1}, cookies)

    results = await asyncio.gather(
        *[signup(index) for index in range(10)],
        *[post_note(index) for index in range(10)],
        *[spin_once() for _ in range(10)],
        *[vote(cookies) for cookies in voters],
    )

    assert [status for status, _ in results] == [200] * len(results), [payload for status, payload in results if status != 200]
    assert await get_karma(db, spinner_id) == -10
    assert await get_karma(db, author_id) == 6
