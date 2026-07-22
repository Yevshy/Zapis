import type { CreateRoomResponse, RoomInfoResponse } from "../shared/types";

export async function createRoom(): Promise<CreateRoomResponse> {
  const res = await fetch("/api/create-room", { method: "POST" });
  if (!res.ok) throw new Error("Не вдалося створити кімнату.");
  return res.json();
}

export async function getRoomInfo(code: string): Promise<RoomInfoResponse> {
  const res = await fetch(`/api/room/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Не вдалося перевірити кімнату.");
  return res.json();
}
