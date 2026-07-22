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

  let composing = false;

  const applyValue = (el: HTMLInputElement) => {
    const start = el.selectionStart;
    const raw = el.value;
    const sanitized = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
    if (sanitized !== raw) {
      el.value = sanitized;
      const pos = Math.min(start ?? sanitized.length, sanitized.length);
      el.setSelectionRange(pos, pos);
    }
    actions.setHomeJoinCode(sanitized);
    if (joinBtn) joinBtn.disabled = sanitized.trim().length !== 6 || state.homeBusy;
  };

  input?.addEventListener("compositionstart", () => {
    composing = true;
  });
  input?.addEventListener("compositionend", (e) => {
    composing = false;
    applyValue(e.target as HTMLInputElement);
  });
  input?.addEventListener("input", (e) => {
    // While composing (IME), don't rewrite the value out from under the
    // in-progress composition — wait for compositionend above.
    if (composing) return;
    applyValue(e.target as HTMLInputElement);
  });
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim().length === 6) actions.joinRoomByCode();
  });
  joinBtn?.addEventListener("click", () => actions.joinRoomByCode());
}
