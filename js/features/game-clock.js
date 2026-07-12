export function createGameClockManager({ getState, getUi, pad, clockMaxMinutes, setStatus, updateClockUI }) {
  let timerInterval = null;

  // Renders the current clock value in mm:ss format.
  function renderClock(seconds) {
    const state = getState();
    const ui = getUi();
    const sTotal = seconds !== undefined ? seconds : state.clockSec;
    const m = Math.floor(sTotal / 60);
    const s = sTotal % 60;
    ui.clockDisplay.textContent = `${pad(m)}:${pad(s)}`;
  }

  // Reads the clock inputs and stores the requested starting time.
  function setClock() {
    const state = getState();
    const ui = getUi();
    const m = Math.min(parseInt(ui.clockMin.value) || 0, clockMaxMinutes);
    const s = Math.min(parseInt(ui.clockSec.value) || 0, 59);
    state.clockSec = m * 60 + s;
    renderClock();
  }

  // Toggles clock visibility in the UI.
  function toggleClockVisibility() {
    const state = getState();
    state.clockVisible = !state.clockVisible;
    updateClockUI();
  }

  // Starts or pauses the match timer and applies period markers when stopping.
  function toggleClock() {
    const state = getState();
    if (state.running) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      state.running = false;
      updateClockUI();

      const milestones = [
        { seconds: 120 * 60, status: 'FULL-TIME' },
        { seconds: 105 * 60, status: 'HT ET' },
        { seconds: 90 * 60, status: 'FULL-TIME' },
        { seconds: 45 * 60, status: 'HT' }
      ];

      for (const { seconds, status } of milestones) {
        if (state.clockSec >= seconds) {
          state.clockSec = seconds;
          setStatus(status);
          renderClock();
          break;
        }
      }
    } else {
      if (timerInterval) clearInterval(timerInterval);
      state.running = true;
      state.clockVisible = true;
      updateClockUI();
      timerInterval = setInterval(() => {
        if (state.status === 'HT' || state.status === 'HT ET') {
          setStatus('');
        }

        state.clockSec++;
        renderClock();
      }, 1000);
    }
  }

  // Stops the clock and clears the current time back to zero.
  function resetClock() {
    const state = getState();
    const ui = getUi();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    state.running = false;
    state.clockSec = 0;
    updateClockUI();
    ui.clockMin.value = 0;
    ui.clockSec.value = 0;
  }

  // Clears the active interval without changing the displayed time.
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  return {
    renderClock,
    setClock,
    toggleClockVisibility,
    toggleClock,
    resetClock,
    stopTimer
  };
}
