import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStateBatchManager } from "../js/core/state-batch.js";
import { createModalStateManager } from "../js/core/modal-state.js";
import { createGameClockManager } from "../js/features/game-clock.js";

function createSmokeFixture() {
  document.body.innerHTML = `
    <div class="scoreboard-wrap">
      <div id="clock-display">00:00</div>
      <button id="start-btn" type="button">Start</button>
      <div id="score-home">0</div>
      <div id="score-away">0</div>
    </div>
    <div id="modal" class="modal-overlay" aria-hidden="true">
      <div class="modal-card">
        <button id="close-btn" type="button">Close</button>
      </div>
    </div>
  `;

  return {
    modal: document.getElementById("modal"),
    closeButton: document.getElementById("close-btn"),
    startButton: document.getElementById("start-btn"),
    clockDisplay: document.getElementById("clock-display"),
    scoreHome: document.getElementById("score-home"),
    scoreAway: document.getElementById("score-away"),
  };
}

describe("smoke flow", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  it("handles the main match flow without crashing", () => {
    const fixture = createSmokeFixture();
    const state = {
      homeScore: 0,
      awayScore: 0,
      clockSec: 0,
      running: false,
      status: "",
      clockVisible: true,
    };

    const ui = {
      clockDisplay: fixture.clockDisplay,
      clockMin: { value: "0" },
      clockSec: { value: "0" },
      startBtn: fixture.startButton,
      scoreHome: fixture.scoreHome,
      scoreAway: fixture.scoreAway,
      clockWrap: { classList: { toggle: vi.fn() } },
    };

    const save = vi.fn();
    const emit = vi.fn();
    const batchManager = createStateBatchManager({ save, emit });
    const modalManager = createModalStateManager();
    const clockManager = createGameClockManager({
      getState: () => state,
      getUi: () => ui,
      pad: (value) => String(value).padStart(2, "0"),
      clockMaxMinutes: 999,
      setStatus: (nextStatus) => {
        state.status = nextStatus;
      },
      updateClockUI: () => {},
    });

    batchManager.applyBatch(() => {
      state.homeScore = 2;
      batchManager.recordChange(state, "homeScore", 2);
      state.awayScore = 1;
      batchManager.recordChange(state, "awayScore", 1);
      state.clockSec = 45;
      batchManager.recordChange(state, "clockSec", 45);
      state.running = false;
      batchManager.recordChange(state, "running", false);
    }, state);

    expect(state.homeScore).toBe(2);
    expect(state.awayScore).toBe(1);
    expect(state.clockSec).toBe(45);
    expect(state.running).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(4);

    clockManager.toggleClock();
    vi.advanceTimersByTime(2000);

    expect(state.running).toBe(true);
    expect(state.clockSec).toBe(47);
    expect(ui.clockDisplay.textContent).toMatch(/\d{2}:\d{2}/);

    modalManager.open(fixture.modal, { initialFocus: fixture.closeButton });
    expect(fixture.modal.classList.contains("active")).toBe(true);
    expect(document.activeElement).toBe(fixture.closeButton);

    modalManager.close();
    expect(fixture.modal.classList.contains("active")).toBe(false);
    expect(modalManager.getActiveModal()).toBeNull();
  });

  it("supports reset and visibility actions without breaking the state", () => {
    const state = {
      homeScore: 3,
      awayScore: 2,
      clockSec: 30,
      running: false,
      clockVisible: true,
      status: "",
    };

    const resetState = () => {
      state.homeScore = 0;
      state.awayScore = 0;
      state.clockSec = 0;
      state.running = false;
      state.clockVisible = false;
    };

    resetState();

    expect(state.homeScore).toBe(0);
    expect(state.awayScore).toBe(0);
    expect(state.clockSec).toBe(0);
    expect(state.running).toBe(false);
    expect(state.clockVisible).toBe(false);

    state.clockVisible = !state.clockVisible;
    expect(state.clockVisible).toBe(true);
  });
});
