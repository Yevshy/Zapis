import type { AppState } from "../state";
import type { Actions } from "../actions";
import { escapeHtml } from "../dom";

export function renderHome(state: AppState): string {
  return `
    <main>
      <div class="card center">
        <p class="eyebrow">Записочки</p>
        <h1 style="margin:0 0 10px;font-size:28px;">Абсурдна гра у складені записочки</h1>
        <p class="muted" style="font-size:15px;line-height:1.6;margin:0 0 26px;">
          П’ять запитань, п’ять гравців, одне безглузде речення в кінці.
          Без реєстрації — просто створіть кімнату й надішліть код друзям.
        </p>

        <button id="createBtn" class="start-btn" ${state.homeBusy ? "disabled" : ""}>
          ${state.homeBusy ? "Створюємо…" : "Створити кімнату"}
        </button>

        <div class="divider"><span>або</span></div>

        <div class="join-row">
          <input
            id="joinCodeInput"
            class="code-input"
            placeholder="ABCDEF"
            maxlength="6"
            autocomplete="off"
            autocapitalize="characters"
            value="${escapeHtml(state.homeJoinCode)}"
          />
          <button id="joinBtn" class="join-btn" ${state.homeJoinCode.trim().length !== 6 || state.homeBusy ? "disabled" : ""}>
            Приєднатись
          </button>
        </div>

        ${state.errorMessage ? `<p class="wait-msg" style="margin-top:16px;">${escapeHtml(state.errorMessage)}</p>` : ""}
      </div>
    </main>
  `;
}

export function bindHome(root: HTMLElement, state: AppState, actions: Actions): void {
  root.querySelector<HTMLButtonElement>("#createBtn")?.addEventListener("click", () => {
    actions.createAndJoinRoom();
  });

  const input = root.querySelector<HTMLInputElement>("#joinCodeInput");
  const joinBtn = root.querySelector<HTMLButtonElement>("#joinBtn");

  input?.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
    actions.setHomeJoinCode(value);
  });
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state.homeJoinCode.trim().length === 6) actions.joinRoomByCode();
  });
  joinBtn?.addEventListener("click", () => actions.joinRoomByCode());
}
