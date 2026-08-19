import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createGameClockManager } from "../js/features/game-clock.js";

function createClockHarness() {
  const state = {
    clockSec: 0,
    running: false,
    status: "",
    clockVisible: true,
  };

  const ui = {
    clockDisplay: { textContent: "" },
    clockMin: { value: "0" },
    clockSec: { value: "0" },
  };

  const clockManager = createGameClockManager({
    getState: () => state,
    getUi: () => ui,
    pad: (value) => String(value).padStart(2, "0"),
    clockMaxMinutes: 999,
    setStatus: (status) => {
      state.status = status;
    },
    updateClockUI: () => {},
  });

  return { state, ui, clockManager };
}

describe("createGameClockManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the clock from minutes and seconds inputs while clamping seconds to 59", () => {
    const { state, ui, clockManager } = createClockHarness();

    ui.clockMin.value = "2";
    ui.clockSec.value = "90";

    clockManager.setClock();

    expect(state.clockSec).toBe(2 * 60 + 59);
  });

  it("counts up while running and stops at halftime milestones", () => {
    const { state, ui, clockManager } = createClockHarness();

    ui.clockDisplay.textContent = "";
    clockManager.toggleClock();

    vi.advanceTimersByTime(3000);

    expect(state.running).toBe(true);
    expect(state.clockSec).toBe(3);
    expect(ui.clockDisplay.textContent).toBe("00:03");

    state.clockSec = 45 * 60;
    state.status = "HT";
    clockManager.toggleClock();

    expect(state.running).toBe(false);
    expect(state.status).toBe("HT");
  });
});
