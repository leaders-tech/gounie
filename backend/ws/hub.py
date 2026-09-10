"""Track live websocket connections per user and send messages to one user or to everybody.

Edit this file when websocket connection storage or fan-out behavior changes.
Copy the helper style here when you add another small websocket utility.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from weakref import WeakSet

from aiohttp import web

LOGGER = logging.getLogger("backend.ws")


class WebSocketHub:
    def __init__(self) -> None:
        self._connections: dict[int, WeakSet[web.WebSocketResponse]] = defaultdict(WeakSet)

    def add(self, user_id: int, ws: web.WebSocketResponse) -> None:
        self._connections[user_id].add(ws)

    def remove(self, user_id: int, ws: web.WebSocketResponse) -> None:
        sockets = self._connections.get(user_id)
        if sockets is None:
            return
        sockets.discard(ws)
        if len(sockets) == 0:
            self._connections.pop(user_id, None)

    async def _send(self, user_id: int, ws: web.WebSocketResponse, message: dict[str, object]) -> None:
        if ws.closed:
            self.remove(user_id, ws)
            return
        try:
            await ws.send_json(message)
        except ConnectionError, RuntimeError:
            LOGGER.info("WebSocket send failed user=%s type=%s. Dropping the connection.", user_id, message.get("type"))
            self.remove(user_id, ws)

    async def send_to_user(self, user_id: int, message: dict[str, object]) -> None:
        for ws in list(self._connections.get(user_id, ())):
            await self._send(user_id, ws, message)

    async def broadcast(self, message: dict[str, object]) -> None:
        for user_id, sockets in list(self._connections.items()):
            for ws in list(sockets):
                await self._send(user_id, ws, message)

    def count_for_user(self, user_id: int) -> int:
        return len(self._connections.get(user_id, ()))
