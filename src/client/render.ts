import type { AppState } from "./state";
import type { Actions } from "./actions";
import { escapeHtml, ICONS } from "./dom";
import { renderHome, bindHome } from "./screens/home";
import { renderLobby, bindLobby } from "./screens/lobby";
import { renderRound, bindRound } from "./screens/round";
import { renderResults, bindResults } from "./screens/results";

export function render(root: HTMLElement, state: AppState, actions: Actions): void {
  root.innerHTML = `
    ${header(state)}
    ${connectionBanner(state)}
    ${body(state)}
    <footer>Анонімна гра · без реєстрації</footer>
  `;

  if (state.screen === "home") {
    bindHome(root, state, actions);
    return;
  }
  if (!state.room) return;

  switch (state.room.status) {
    case "lobby":
      bindLobby(root, state, actions);
      break;
    case "playing":
      bindRound(root, state, actions);
      break;
    case "finished":
      bindResults(root, state, actions);
      break;
  }
}

function body(state: AppState): string {
  if (state.screen === "home") return renderHome(state);
  if (!state.room) {
    return `<main><div class="card center"><p class="muted">Підключення до кімнати…</p></div></main>`;
  }
  switch (state.room.status) {
    case "lobby":
      return renderLobby(state);
    case "playing":
      return renderRound(state);
    case "finished":
      return renderResults(state);
  }
}

function header(state: AppState): string {
  return `
    <div class="topbar">
      <button class="logo" onclick="location.href='/'">Записочки</button>
      <div class="whoami"><span class="dot ${state.connection === "open" ? "" : "dot-off"}"></span>Ви: <b>${escapeHtml(state.nickname)}</b></div>
    </div>
  `;
}

function connectionBanner(state: AppState): string {
  if (state.screen !== "room" || state.connection === "open") return "";
  const label = state.connection === "closed" ? "З'єднання втрачено" : "Відновлюємо з’єднання…";
  return `<div class="conn-banner">${ICONS.wifiOff}${label}</div>`;
}
