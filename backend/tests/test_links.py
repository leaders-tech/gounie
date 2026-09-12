"""Test the great url collection: add, search, edit, delete, votes, and author karma changes.

Edit this file when link endpoints, link search, or voting rules change.
Copy a test pattern here when you add tests for another searchable collection.
"""

from __future__ import annotations

import pytest

from backend.db.karma import get_karma
from backend.tests.conftest import ADMIN_PASSWORD, api, login_as


async def add_link(client, cookies, **overrides) -> dict:
    body = {"url": "https://docs.python.org/3/", "title": "Python docs", "description": "The official docs."} | overrides
    status, payload = await api(client, "/api/links/create", body, cookies)
    assert status == 200, payload
    return payload["data"]["link"]


async def search(client, cookies, query: str) -> list[dict]:
    status, payload = await api(client, "/api/links/list", {"query": query}, cookies)
    assert status == 200
    return payload["data"]["links"]


async def vote(client, cookies, link_id: int, value) -> tuple[int, dict]:
    return await api(client, "/api/links/vote", {"link_id": link_id, "value": value}, cookies)


@pytest.fixture
async def people(client, create_user):
    ids = {name: await create_user(name) for name in ("alice", "bob", "carol")}
    cookies = {name: await login_as(client, name) for name in ids}
    return ids, cookies


@pytest.mark.asyncio
async def test_create_search_update_delete_own_link(client, people) -> None:
    _, cookies = people
    python = await add_link(client, cookies["alice"])
    await add_link(client, cookies["alice"], url="https://developer.mozilla.org/", title="MDN", description="Web docs")
    assert python["author_username"] == "alice"

    assert len(await search(client, cookies["bob"], "")) == 2
    assert [link["title"] for link in await search(client, cookies["bob"], "PYTHON")] == ["Python docs"]
    assert [link["title"] for link in await search(client, cookies["bob"], "web docs")] == ["MDN"]
    assert len(await search(client, cookies["bob"], "alice")) == 2

    body = {"id": python["id"], "url": "https://docs.python.org/3.14/", "title": "Python 3.14 docs", "description": ""}
    status, payload = await api(client, "/api/links/update", body, cookies["alice"])
    assert status == 200
    assert payload["data"]["link"]["title"] == "Python 3.14 docs"

    assert (await api(client, "/api/links/delete", {"id": python["id"]}, cookies["alice"]))[0] == 200
    assert [link["title"] for link in await search(client, cookies["bob"], "")] == ["MDN"]


@pytest.mark.asyncio
async def test_others_cannot_edit_or_delete(client, people) -> None:
    _, cookies = people
    link = await add_link(client, cookies["alice"])
    body = {"id": link["id"], "url": "https://evil.example/", "title": "Mine now"}
    assert (await api(client, "/api/links/update", body, cookies["bob"]))[0] == 403
    assert (await api(client, "/api/links/delete", {"id": link["id"]}, cookies["bob"]))[0] == 403
    assert (await api(client, "/api/links/delete", {"id": 9999}, cookies["bob"]))[0] == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"url": "javascript:alert(1)"},
        {"url": "ftp://files.example.org/"},
        {"url": "not a url"},
        {"url": ""},
        {"title": ""},
        {"title": "x" * 201},
        {"description": "x" * 1001},
    ],
)
async def test_bad_link_input_is_rejected(client, people, overrides) -> None:
    _, cookies = people
    body = {"url": "https://example.org/", "title": "Example"} | overrides
    status, _ = await api(client, "/api/links/create", body, cookies["alice"])
    assert status == 400


@pytest.mark.asyncio
async def test_votes_move_author_karma(client, db, people) -> None:
    ids, cookies = people
    link = await add_link(client, cookies["alice"])

    status, payload = await vote(client, cookies["bob"], link["id"], 1)
    assert status == 200
    assert payload["data"]["link"]["score"] == 1
    assert payload["data"]["link"]["my_vote"] == 1
    assert await get_karma(db, ids["alice"]) == 1

    await vote(client, cookies["bob"], link["id"], 1)
    assert await get_karma(db, ids["alice"]) == 1

    await vote(client, cookies["bob"], link["id"], -1)
    assert await get_karma(db, ids["alice"]) == -1

    await vote(client, cookies["bob"], link["id"], 0)
    assert await get_karma(db, ids["alice"]) == 0

    await vote(client, cookies["carol"], link["id"], -1)
    assert await get_karma(db, ids["alice"]) == -1
    assert (await search(client, cookies["bob"], ""))[0]["my_vote"] == 0

    status, payload = await vote(client, cookies["alice"], link["id"], 1)
    assert status == 400
    assert payload["error"]["code"] == "own_link"
    assert (await vote(client, cookies["bob"], link["id"], 2))[0] == 400
    assert (await vote(client, cookies["bob"], 9999, 1))[0] == 404


@pytest.mark.asyncio
async def test_deleting_link_keeps_karma(client, db, people) -> None:
    ids, cookies = people
    link = await add_link(client, cookies["alice"])
    await vote(client, cookies["bob"], link["id"], 1)
    await api(client, "/api/links/delete", {"id": link["id"]}, cookies["alice"])
    assert await get_karma(db, ids["alice"]) == 1


@pytest.mark.asyncio
async def test_search_treats_percent_and_underscore_as_text(client, people) -> None:
    _, cookies = people
    await add_link(client, cookies["alice"], title="100% free fonts")
    await add_link(client, cookies["alice"], title="snake_case guide", url="https://example.org/snake")
    await add_link(client, cookies["alice"], title="plain title", url="https://example.org/plain")
    assert [link["title"] for link in await search(client, cookies["bob"], "%")] == ["100% free fonts"]
    assert [link["title"] for link in await search(client, cookies["bob"], "_")] == ["snake_case guide"]


@pytest.mark.asyncio
async def test_admin_can_delete_any_link(client, people) -> None:
    _, cookies = people
    link = await add_link(client, cookies["alice"])
    admin = await login_as(client, "admin", ADMIN_PASSWORD)
    assert (await api(client, "/api/admin/links/delete", {"id": link["id"]}, cookies["bob"]))[0] == 403
    assert (await api(client, "/api/admin/links/delete", {"id": link["id"]}, admin))[0] == 200
    assert await search(client, cookies["bob"], "") == []


@pytest.mark.asyncio
async def test_visitors_can_read_links_but_not_add_or_vote(client, people) -> None:
    _, cookies = people
    link = await add_link(client, cookies["alice"])

    status, payload = await api(client, "/api/links/list", {"query": ""})
    assert status == 200
    assert [item["title"] for item in payload["data"]["links"]] == [link["title"]]
    assert payload["data"]["links"][0]["my_vote"] == 0

    assert (await api(client, "/api/links/create", {"url": "https://example.org/", "title": "Nope"}))[0] == 401
    assert (await api(client, "/api/links/vote", {"link_id": link["id"], "value": 1}))[0] == 401
    assert (await api(client, "/api/links/update", {"id": link["id"], "url": "https://example.org/", "title": "Nope"}))[0] == 401
    assert (await api(client, "/api/links/delete", {"id": link["id"]}))[0] == 401
