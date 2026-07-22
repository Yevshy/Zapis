import type { AppState } from "../state";
import type { Actions } from "../actions";
import { escapeHtml, ICONS, pluralPlayers } from "../dom";

export function renderLobby(state: AppState): string {
  const room = state.room!;
  const connected = room.players.filter((p) => p.connected);
  const count = connected.length;
  const canStart = count >= 2;

  const pills = connected
    .map((p) => `<div class="player-pill">${ICONS.user}${escapeHtml(p.nickname)}${p.id === state.playerId ? " (ви)" : ""}</div>`)
    .join("");

  return `
    <main>
      <div class="card center">
        <p class="eyebrow">Кімната ${escapeHtml(room.code)}</p>
        <h1 style="margin:0 0 6px;font-size:26px;">Очікуємо гравців</h1>
        <p class="muted" style="margin:0 0 4px;font-size:14.5px;">Надішліть код кімнати друзям, щоб вони приєднались</p>

        <button id="copyLinkBtn" class="copy-link-btn">${ICONS.link}Скопіювати посилання</button>

        <div class="player-pills">
          ${pills || `<span class="muted" style="font-size:13.5px;">Ще нікого немає…</span>`}
        </div>

        <button id="startBtn" class="start-btn" ${canStart ? "" : "disabled"}>
          ${canStart ? `Почати гру · ${count} ${pluralPlayers(count)}` : "Потрібен ще один гравець"}
        </button>

        ${state.errorMessage ? `<p class="wait-msg">${escapeHtml(state.errorMessage)}</p>` : ""}
      </div>
    </main>
  `;
}

export function bindLobby(root: HTMLElement, _state: AppState, actions: Actions): void {
  root.querySelector<HTMLButtonElement>("#startBtn")?.addEventListener("click", () => actions.startGame());

  root.querySelector<HTMLButtonElement>("#copyLinkBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(location.href);
      const original = btn.innerHTML;
      btn.innerHTML = `${ICONS.check}Скопійовано`;
      setTimeout(() => (btn.innerHTML = original), 1600);
    } catch {
      // Clipboard API unavailable — silently ignore, the code is visible on screen anyway.
    }
  });
}
