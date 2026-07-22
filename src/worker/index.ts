import type { Env } from "./env";
import type { CreateRoomResponse, RoomInfoResponse } from "../shared/types";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../shared/roomCode";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), { ...init, headers: { ...JSON_HEADERS, ...init.headers } });
}

/**
 * Looks up the Durable Object stub for a given room code. Room codes map
 * deterministically to Durable Object ids via idFromName, so the same code
 * always resolves to the same room instance — no external registry needed.
 */
function roomStub(env: Env, code: string) {
  const id = env.GAME_ROOM.idFromName(code);
  return env.GAME_ROOM.get(id);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- REST: create a brand new room, returns a fresh 6-letter code ---
    if (url.pathname === "/api/create-room" && request.method === "POST") {
      // Collisions are astronomically unlikely (24^6 ≈ 191M combinations) but we
      // still guard against them by checking the room doesn't already have a game.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const stub = roomStub(env, code);
        const infoRes = await stub.fetch(`https://internal/info?code=${code}`);
        const info = (await infoRes.json()) as RoomInfoResponse;
        if (!info.exists) {
          const body: CreateRoomResponse = { code };
          return json(body);
        }
      }
      return json({ error: "Не вдалося створити кімнату, спробуйте ще раз." }, { status: 500 });
    }

    // --- REST: look up a room's status before joining (used by the join screen) ---
    const roomInfoMatch = url.pathname.match(/^\/api\/room\/([A-Za-z0-9]+)$/);
    if (roomInfoMatch && request.method === "GET") {
      const code = normalizeRoomCode(roomInfoMatch[1]);
      if (!isValidRoomCode(code)) {
        return json({ exists: false, status: null, playerCount: 0 } satisfies RoomInfoResponse);
      }
      const stub = roomStub(env, code);
      const infoRes = await stub.fetch(`https://internal/info?code=${code}`);
      const info = await infoRes.json();
      return json(info);
    }

    // --- WebSocket: real-time connection into a room ---
    const wsMatch = url.pathname.match(/^\/ws\/([A-Za-z0-9]+)$/);
    if (wsMatch) {
      const code = normalizeRoomCode(wsMatch[1]);
      if (!isValidRoomCode(code)) {
        return new Response("Невірний код кімнати", { status: 400 });
      }
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket upgrade request", { status: 426 });
      }
      const stub = roomStub(env, code);
      // Forward the upgrade request as-is (including query params like playerId/nickname)
      // straight to the Durable Object, which owns the actual WebSocket handshake.
      return stub.fetch(request);
    }

    // --- Everything else: serve the static, Vite-built frontend ---
    return env.ASSETS.fetch(request);
  }
};

export { GameRoom } from "./gameRoom";
