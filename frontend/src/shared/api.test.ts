/*
This file tests the shared browser API helper and its path-based request contract.
Edit this file when API base paths, error messages, or websocket URL rules change.
Copy this file when you add tests for another small shared browser helper.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

describe("shared api helper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("prefixes JSON requests with the configured API base path once", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "/api/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { saved: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { postJson, apiUrl } = await import("./api");
    const data = await postJson<{ saved: boolean }>("/links/list");

    expect(data).toEqual({ saved: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/links/list",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(apiUrl("wall/image/3")).toBe("/api/wall/image/3");
  });

  it("turns error envelopes into ApiError with the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { code: "whoops", message: "whoops.. something went wrong" } }), { status: 409 })),
    );
    const { ApiError, errorMessage, postJson } = await import("./api");

    const error = await postJson("/wall/delete", { id: 1 }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "whoops" });
    expect(errorMessage(error)).toBe("whoops.. something went wrong");
    expect(errorMessage("not an error", "fallback")).toBe("fallback");
  });

  it("builds websocket URLs from the current page origin and keeps the /ws path", async () => {
    const { getWsUrl } = await import("./api");
    const wsUrl = new URL(getWsUrl());

    expect(wsUrl.host).toBe(window.location.host);
    expect(wsUrl.pathname).toBe("/ws");
    expect(wsUrl.protocol).toBe(window.location.protocol === "https:" ? "wss:" : "ws:");
  });
});
