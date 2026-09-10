"""Test websocket auth rules, websocket error handling, and live events.

Edit this file when websocket auth, message parsing, websocket replies, or live event types change.
Copy a test pattern here when you add tests for another realtime feature.
"""

from __future__ import annotations

import pytest
from aiohttp import WSMsgType, WSServerHandshakeError

from backend.tests.conftest import api, login


@pytest.mark.asyncio
async def test_websocket_requires_login(client) -> None:
    with pytest.raises(WSServerHandshakeError) as error:
        await client.ws_connect("/ws")
    assert error.value.status == 401


@pytest.mark.asyncio
async def test_websocket_rejects_wrong_origin(client, create_user, auth_headers) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)

    with pytest.raises(WSServerHandshakeError) as error:
        await client.ws_connect("/ws", headers={"Origin": "http://evil.example"})
    assert error.value.status == 403


@pytest.mark.asyncio
async def test_websocket_bad_message_returns_json_error(client, create_user, auth_headers) -> None:
    await create_user("user", "user")
    await login(client, "user", "user", auth_headers)

    ws = await client.ws_connect("/ws")
    ready_message = await ws.receive_json()
    assert ready_message["type"] == "ws.ready"

    await ws.send_str("[]")
    error_message = await ws.receive_json()
    assert error_message == {"type": "error", "code": "bad_request", "message": "WebSocket message must be an object."}

    await ws.send_str('{"type":"ping"}')
    pong_message = await ws.receive_json()
    assert pong_message == {"type": "pong"}

    await ws.close()
    closed_message = await ws.receive()
    assert closed_message.type in {WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.CLOSING}


@pytest.mark.asyncio
async def test_websocket_receives_live_events(client, create_user, auth_headers, monkeypatch) -> None:
    user_id = await create_user("alice", "password1")
    await login(client, "alice", "password1", auth_headers)
    ws = await client.ws_connect("/ws")
    assert (await ws.receive_json())["type"] == "ws.ready"

    status, _ = await api(client, "/api/wall/post", {"username": "alice", "text": "live!", "color": "#fbcfe8", "tilt": 0})
    assert status == 200
    assert await ws.receive_json(timeout=5) == {"type": "wall.changed", "wall_user_id": user_id}

    monkeypatch.setattr("backend.http.slot_routes.spin", lambda _rng: (["🍋", "🔔", "⭐"], None))
    status, _ = await api(client, "/api/slots/spin", {"stake": 3})
    assert status == 200
    assert await ws.receive_json(timeout=5) == {"type": "karma.changed", "karma": -3}

    await ws.close()
