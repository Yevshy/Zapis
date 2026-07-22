import { generateNickname } from "../shared/nicknames";

const ID_KEY = "zap_player_id";
const NICK_KEY = "zap_nickname";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * One stable anonymous identity per browser, kept in localStorage so a page
 * refresh (or a dropped WebSocket) can reconnect to the same seat instead of
 * joining as a brand-new player.
 */
export function getOrCreateIdentity(): { playerId: string; nickname: string } {
  let playerId = localStorage.getItem(ID_KEY);
  let nickname = localStorage.getItem(NICK_KEY);

  if (!playerId) {
    playerId = uuid();
    localStorage.setItem(ID_KEY, playerId);
  }
  if (!nickname) {
    nickname = generateNickname();
    localStorage.setItem(NICK_KEY, nickname);
  }
  return { playerId, nickname };
}

export function saveNickname(nickname: string): void {
  localStorage.setItem(NICK_KEY, nickname);
}
