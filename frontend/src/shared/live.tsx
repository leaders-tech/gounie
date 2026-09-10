/*
This file keeps one shared websocket connection for the logged-in user and lets pages listen to live events.
Edit this file when live event handling or the socket lifetime changes.
Do not copy this file. Call useLiveEvent() in a page when it needs live updates.
*/

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../app/auth";
import { createUserSocket } from "./socket";
import type { WsMessage } from "./types";

type Listener = (message: WsMessage) => void;

type LiveContextValue = {
  subscribe: (listener: Listener) => () => void;
};

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { user, setKarma } = useAuth();
  const listeners = useRef(new Set<Listener>());
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      return;
    }
    const socket = createUserSocket({
      onMessage(message) {
        if (message.type === "karma.changed") {
          setKarma(message.karma);
        }
        listeners.current.forEach((listener) => listener(message));
      },
      onStatus() {},
    });
    return () => socket.stop();
  }, [userId, setKarma]);

  const value = useMemo<LiveContextValue>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Run handler for every live websocket message. Does nothing outside LiveProvider (for example in unit tests). */
export function useLiveEvent(handler: Listener) {
  const context = useContext(LiveContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!context) {
      return;
    }
    return context.subscribe((message) => handlerRef.current(message));
  }, [context]);
}
