"""Test The Wall endpoints: posting notes, pictures, the fake delete, admin deletes, and the user directory.

Edit this file when wall endpoints, note rules, or the fake delete change.
Copy a test pattern here when you add tests for another user-posted content feature.
"""

from __future__ import annotations

import base64
import logging
from io import BytesIO

import pytest
from PIL import Image

from backend.tests.conftest import ADMIN_PASSWORD, api, login_as


def png_data_url(width: int = 1600, height: int = 800) -> str:
    buffer = BytesIO()
    Image.new("RGB", (width, height), "orange").save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


def note_body(username: str, **overrides) -> dict:
    return {"username": username, "text": "hello!", "color": "#fef08a", "tilt": 5} | overrides


@pytest.fixture
async def people(client, create_user):
    ids = {name: await create_user(name) for name in ("alice", "bob")}
    cookies = {name: await login_as(client, name) for name in ids}
    return ids, cookies


@pytest.mark.asyncio
async def test_post_text_note_and_list_wall(client, people) -> None:
    ids, cookies = people
    status, payload = await api(client, "/api/wall/post", note_body("alice", text="hi alice"), cookies["bob"])
    assert status == 200
    note = payload["data"]["note"]
    assert note["author_username"] == "bob"
    assert note["wall_user_id"] == ids["alice"]
    assert note["has_image"] is False
    assert note["tilt"] == 5

    status, payload = await api(client, "/api/wall/list", {"username": "alice"}, cookies["alice"])
    assert status == 200
    assert payload["data"]["owner"]["username"] == "alice"
    assert "email" not in payload["data"]["owner"]
    assert [item["text"] for item in payload["data"]["notes"]] == ["hi alice"]


@pytest.mark.asyncio
async def test_post_picture_note_is_resized_and_served(client, people) -> None:
    _, cookies = people
    status, payload = await api(client, "/api/wall/post", note_body("alice", text="", image=png_data_url()), cookies["bob"])
    assert status == 200
    note_id = payload["data"]["note"]["id"]
    assert payload["data"]["note"]["has_image"] is True

    response = await client.get(f"/api/wall/image/{note_id}", cookies=cookies["alice"])
    assert response.status == 200
    assert response.content_type == "image/webp"
    image = Image.open(BytesIO(await response.read()))
    assert max(image.size) == 1024


@pytest.mark.asyncio
async def test_picture_requires_login(client, people) -> None:
    _, cookies = people
    _, payload = await api(client, "/api/wall/post", note_body("alice", image=png_data_url(20, 20)), cookies["bob"])
    response = await client.get(f"/api/wall/image/{payload['data']['note']['id']}")
    assert response.status == 401
    missing = await client.get("/api/wall/image/9999", cookies=cookies["bob"])
    assert missing.status == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"text": "", "image": None},
        {"text": "x" * 501},
        {"color": "yellow"},
        {"color": "#12345"},
        {"text_color": "red"},
        {"bold": "yes"},
        {"tilt": 181},
        {"tilt": -181},
        {"tilt": "5"},
        {"image": "data:image/png;base64,aGVsbG8="},
        {"image": 123},
    ],
)
async def test_post_rejects_bad_input(client, people, overrides) -> None:
    _, cookies = people
    status, _ = await api(client, "/api/wall/post", note_body("alice", **overrides), cookies["bob"])
    assert status == 400


@pytest.mark.asyncio
async def test_post_to_unknown_wall_returns_404(client, people) -> None:
    _, cookies = people
    status, _ = await api(client, "/api/wall/post", note_body("nobody"), cookies["bob"])
    assert status == 404


@pytest.mark.asyncio
async def test_fake_delete_always_fails_and_keeps_note(client, people, caplog) -> None:
    _, cookies = people
    _, payload = await api(client, "/api/wall/post", note_body("alice"), cookies["bob"])
    note_id = payload["data"]["note"]["id"]

    with caplog.at_level(logging.INFO, logger="backend.wall"):
        for who in ("bob", "alice"):
            status, payload = await api(client, "/api/wall/delete", {"id": note_id}, cookies[who])
            assert status == 409
            assert payload["error"]["message"] == "whoops.. something went wrong"
        status, _ = await api(client, "/api/wall/delete", {"id": 9999}, cookies["bob"])
        assert status == 409

    assert "Fake delete attempt" in caplog.text
    _, payload = await api(client, "/api/wall/list", {"username": "alice"}, cookies["alice"])
    assert len(payload["data"]["notes"]) == 1


@pytest.mark.asyncio
async def test_admin_can_really_delete_note(client, people) -> None:
    _, cookies = people
    _, payload = await api(client, "/api/wall/post", note_body("alice"), cookies["bob"])
    note_id = payload["data"]["note"]["id"]

    status, _ = await api(client, "/api/admin/wall/delete", {"id": note_id}, cookies["alice"])
    assert status == 403

    admin = await login_as(client, "admin", ADMIN_PASSWORD)
    status, _ = await api(client, "/api/admin/wall/delete", {"id": note_id}, admin)
    assert status == 200
    status, _ = await api(client, "/api/admin/wall/delete", {"id": note_id}, admin)
    assert status == 404
    _, payload = await api(client, "/api/wall/list", {"username": "alice"}, cookies["alice"])
    assert payload["data"]["notes"] == []


@pytest.mark.asyncio
async def test_user_directory_search_and_profile(client, people, db) -> None:
    _, cookies = people
    await db.execute("INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES ('pending', 'p@example.edu', 'x', 'now', 'now')")
    await db.commit()

    status, payload = await api(client, "/api/users/list", {"query": ""}, cookies["alice"])
    assert status == 200
    names = [user["username"] for user in payload["data"]["users"]]
    assert names == ["admin", "alice", "bob"]
    assert all("email" not in user for user in payload["data"]["users"])

    _, payload = await api(client, "/api/users/list", {"query": "BO"}, cookies["alice"])
    assert [user["username"] for user in payload["data"]["users"]] == ["bob"]

    status, payload = await api(client, "/api/users/get", {"username": "bob"}, cookies["alice"])
    assert status == 200
    assert payload["data"]["user"]["karma"] == 0
    assert (await api(client, "/api/users/get", {"username": "ghost"}, cookies["alice"]))[0] == 404
