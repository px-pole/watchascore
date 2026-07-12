export function createTeamNamesManager({ getState, getUi, capitalize }) {
  // Measures how many visual lines a team name currently occupies.
  function measureTeamNameLineCount(el) {
    if (!el) return 1;

    const container = el.parentElement;
    if (!container) return 1;

    const probe = el.cloneNode(true);
    probe.classList.remove('is-compact', 'is-long', 'is-xlong');

    if (el.classList.contains('is-compact')) probe.classList.add('is-compact');
    if (el.classList.contains('is-long')) probe.classList.add('is-long');
    if (el.classList.contains('is-xlong')) probe.classList.add('is-xlong');

    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.height = 'auto';
    probe.style.maxHeight = 'none';
    probe.style.overflow = 'visible';
    probe.style.left = '0';
    probe.style.top = '0';

    container.appendChild(probe);

    const probeStyle = window.getComputedStyle(probe);
    const lineHeightValue = parseFloat(probeStyle.lineHeight);
    const fontSizeValue = parseFloat(probeStyle.fontSize) || 16;
    const lineHeight = Number.isFinite(lineHeightValue) ? lineHeightValue : fontSizeValue * 1.2;

    const lineCount = Math.max(1, Math.round(probe.scrollHeight / lineHeight));
    probe.remove();
    return lineCount;
  }

  // Shrinks the font when a team name cannot fit in the fixed two-line slot.
  function fitTeamName(el) {
    if (!el) return;
    el.classList.remove('is-compact', 'is-long', 'is-xlong');

    const rawName = el.textContent?.trim() || '';
    const words = rawName.split(/\s+/).filter(Boolean);
    const longestWordLength = words.reduce(
      (maxLength, word) => Math.max(maxLength, Array.from(word).length),
      0
    );
    const compactLength = Array.from(rawName.replace(/\s+/g, '')).length;

    if (longestWordLength >= 13 || compactLength >= 22) {
      el.classList.add('is-compact');
    }

    // Keep default size for names that fit the 2-line slot.
    // Only shrink when the text is intrinsically long or actually overflowing.
    const lineCount = measureTeamNameLineCount(el);
    const canMeasureOverflow = el.clientHeight > 0;

    // scrollHeight > clientHeight means content overflows the 2-line slot.
    if (lineCount > 2 || (canMeasureOverflow && el.scrollHeight - el.clientHeight > 2)) {
      el.classList.add('is-compact');
      el.classList.add('is-long');
      void el.offsetHeight; // Force reflow so reduced font-size is measured before second check
      if (canMeasureOverflow && el.scrollHeight - el.clientHeight > 2) el.classList.add('is-xlong');
    }
  }

  // Applies a scoreboard class when both visible team names fit on a single line.
  function syncSingleLineNameLayoutClass() {
    const state = getState();
    const ui = getUi();
    const scoreboard = document.querySelector('.scoreboard-wrap');
    if (!scoreboard) return;

    const visible = state.teamNamesVisible !== false;
    const homeNameEl = ui.homeName;
    const awayNameEl = ui.awayName;

    const bothSingleLine =
      !!homeNameEl &&
      !!awayNameEl &&
      measureTeamNameLineCount(homeNameEl) === 1 &&
      measureTeamNameLineCount(awayNameEl) === 1;

    scoreboard.classList.toggle('team-names-single-line', visible && bothSingleLine);
  }

  // Syncs every visible name field for the selected side.
  function syncTeamNameDisplay(side, name) {
    const ui = getUi();
    const nameEl = ui[`${side}Name`];
    if (nameEl) {
      nameEl.textContent = name;
      nameEl.setAttribute('title', name);
      nameEl.setAttribute('aria-label', name);
      fitTeamName(nameEl);
      syncSingleLineNameLayoutClass();
    }
  }

  // Shows or hides the team-name visibility controls in the UI.
  function updateTeamNamesVisibilityUI() {
    const state = getState();
    const ui = getUi();
    const visible = state.teamNamesVisible !== false;
    const scoreboard = document.querySelector('.scoreboard-wrap');
    if (scoreboard) scoreboard.classList.toggle('team-names-hidden', !visible);

    if (visible) {
      // Name slots can be collapsed while hidden; re-fit once visible to avoid stale compact classes.
      requestAnimationFrame(refitTeamNames);
    } else {
      syncSingleLineNameLayoutClass();
    }

    if (ui.toggleTeamNamesBtn) {
      ui.toggleTeamNamesBtn.setAttribute('aria-pressed', visible ? 'false' : 'true');
      ui.toggleTeamNamesBtn.innerHTML = visible
        ? '<i class="fa-solid fa-eye-slash"></i> Hide Team Names'
        : '<i class="fa-solid fa-eye"></i> Show Team Names';
    }
  }

  // Toggles the persisted team-name visibility flag.
  function toggleTeamNamesVisibility() {
    const state = getState();
    state.teamNamesVisible = !(state.teamNamesVisible !== false);
  }

  // Overrides the displayed team name for a side.
  function overrideName(side, val) {
    const state = getState();
    const normalized = val.trim();
    state[side + 'NameOverride'] = normalized;
    const name = normalized || state[side + 'Team']?.name || capitalize(side);
    syncTeamNameDisplay(side, name);
  }

  // Re-applies font fitting to both displayed team names.
  function refitTeamNames() {
    const ui = getUi();
    ['home', 'away'].forEach(side => fitTeamName(ui[`${side}Name`]));
    syncSingleLineNameLayoutClass();
  }

  return {
    fitTeamName,
    syncTeamNameDisplay,
    updateTeamNamesVisibilityUI,
    toggleTeamNamesVisibility,
    overrideName,
    refitTeamNames
  };
}