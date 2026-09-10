/*
This file tests the shared live websocket provider and the useLiveEvent hook.
Edit this file when live event handling or the socket lifetime changes.
Copy a test pattern here when you add tests for another shared provider.
*/

import "@testing-library/jest-dom/vitest";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WsMessage } from "./types";

type FakeSocket = { onMessage: (message: WsMessage) => void; stop: ReturnType<typeof vi.fn>; sendPing: ReturnType<typeof vi.fn> };

const { sockets } = vi.hoisted(() => ({ sockets: [] as FakeSocket[] }));

vi.mock("./socket", () => ({
  createUserSocket: (options: { onMessage: (message: WsMessage) => void }) => {
    const socket = { onMessage: options.onMessage, stop: vi.fn(), sendPing: vi.fn() };
    sockets.push(socket);
    return socket;
  },
}));

import { AuthContext } from "../app/auth";
import { LiveProvider, useLiveEvent } from "./live";
import { makeUser } from "./testUtils";

function Listener({ onEvent }: { onEvent: (message: WsMessage) => void }) {
  useLiveEvent(onEvent);
  return <p>listening</p>;
}

function renderLive(user: ReturnType<typeof makeUser> | null, onEvent = vi.fn()) {
  const auth = { user, loading: false, login: vi.fn(), logout: vi.fn(), reloadUser: vi.fn(), setKarma: vi.fn() };
  const result = render(
    <AuthContext.Provider value={auth}>
      <LiveProvider>
        <Listener onEvent={onEvent} />
      </LiveProvider>
    </AuthContext.Provider>,
  );
  return { ...result, auth, onEvent };
}

describe("LiveProvider", () => {
  it("connects for logged-in users, updates karma, and forwards events", () => {
    sockets.length = 0;
    const { auth, onEvent, unmount } = renderLive(makeUser());
    expect(sockets).toHaveLength(1);

    act(() => sockets[0].onMessage({ type: "karma.changed", karma: 5 }));
    act(() => sockets[0].onMessage({ type: "wall.changed", wall_user_id: 3 }));

    expect(auth.setKarma).toHaveBeenCalledWith(5);
    expect(onEvent).toHaveBeenCalledWith({ type: "wall.changed", wall_user_id: 3 });
    unmount();
    expect(sockets[0].stop).toHaveBeenCalled();
  });

  it("does not connect without a logged-in user", () => {
    sockets.length = 0;
    renderLive(null);
    expect(sockets).toHaveLength(0);
  });
});
