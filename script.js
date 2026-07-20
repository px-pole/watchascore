import {
  PLACEHOLDER,
  STATUS_LABELS,
  THEMES,
  SEARCH_RESULT_CAP,
  SEARCH_DEBOUNCE_MS,
  CLOCK_MAX_MINUTES,
  CANVAS_SAMPLE_SIZE,
  ALLOWED_LOGO_TYPES,
  HELP_FAB_SEEN_KEY,
  INITIAL_STATE
} from './js/config/constants.js';
import { createEventBus } from './js/core/event-bus.js';
import { createPersistence } from './js/core/persistence.js';
import {
  pad,
  capitalize,
  levenshteinDistance,
  debounce,
  isEditableShortcutTarget,
  getShortcutKey
} from './js/utils/helpers.js';
import { createTeamSearchManager } from './js/features/team-search.js';
import { createGameClockManager } from './js/features/game-clock.js';
import { createMediaManager } from './js/features/media.js';
import { createTeamNamesManager } from './js/features/team-names.js';
import { TOURNAMENTS } from './teams.js';

// Force top-of-page start on reload instead of browser-restored scroll position.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Scrolls the viewport back to the top.
const ensureTopScrollPosition = () => {
  window.scrollTo(0, 0);
};

// Re-applies the top scroll position after late layout shifts.
const ensureTopScrollPositionWithFallback = () => {
  ensureTopScrollPosition();

  // Handle late layout shifts (fonts/images/transitions) after load.
  requestAnimationFrame(() => {
    ensureTopScrollPosition();
    requestAnimationFrame(ensureTopScrollPosition);
  });

  setTimeout(ensureTopScrollPosition, 120);
};

document.addEventListener('DOMContentLoaded', ensureTopScrollPosition);
window.addEventListener('pageshow', ensureTopScrollPosition);

// App-level state, storage keys, and reactive state proxy.

const urlParams = new URLSearchParams(window.location.search);
const GAME_ID = urlParams.get('id') || 'default';
const STORAGE_KEY = `scoreboard_state_${GAME_ID}`;
const PREFS_KEY = 'scoreboard_prefs'; // Global key for user preferences (Theme, Mode, etc.)
const MOBILE_WARNING_DISMISSED_KEY = 'scoreboard_mobile_warning_dismissed';
const Persistence = createPersistence({ storageKey: STORAGE_KEY, prefsKey: PREFS_KEY, initialState: INITIAL_STATE });

let state = null;
let ui = {}; // DOM Cache
let modalTriggerElement = null; // Element that had focus before opening a modal
let activeModalCleanup = null;
let obsHoleResizeObserver = null;
let obsHoleRafId = 0;
let themeTransitionResetTimer = 0;

const THEME_CHANGE_TRANSITION_MS = 300;

const stateHandler = {
  set(target, prop, value) {
    if (target[prop] === value) return true;
    target[prop] = value;
    Persistence.save(target);
    EventBus.emit(prop, value);
    return true;
  }
};

// Wraps the initial state object in a persistence-aware proxy.
const createState = (initialData) => new Proxy(initialData, stateHandler);
// Persists the current state snapshot.
const saveState = () => Persistence.save(state);

// Detects whether the app is running inside an OBS browser source.
function isObsSourceContext() {
  const obsParam = (urlParams.get('obs') || '').toLowerCase();
  if (obsParam === '1' || obsParam === 'true') return true;
  if (obsParam === '0' || obsParam === 'false') return false;
  return /\bOBS\b|\bobs-browser\b/i.test(navigator.userAgent || '');
}

// Toggles the OBS-specific root class based on the current context.
function syncObsSourceModeClass() {
  document.documentElement.classList.toggle('obs-source', isObsSourceContext());
}

// Updates CSS custom properties used to punch a hole in the OBS background.
function updateObsBackgroundHoleVars() {
  if (!document.documentElement.classList.contains('obs-source')) return;
  const scoreboardWrap = document.querySelector('.scoreboard-wrap');
  if (!scoreboardWrap) return;

  const rect = scoreboardWrap.getBoundingClientRect();
  const left = Math.max(0, Math.round(rect.left));
  const top = Math.max(0, Math.round(rect.top));
  const width = Math.max(0, Math.round(rect.width));
  const height = Math.max(0, Math.round(rect.height));
  const root = document.documentElement;

  root.style.setProperty('--obs-hole-left', `${left}px`);
  root.style.setProperty('--obs-hole-top', `${top}px`);
  root.style.setProperty('--obs-hole-width', `${width}px`);
  root.style.setProperty('--obs-hole-height', `${height}px`);
}

// Schedules a single animation-frame refresh for the OBS hole geometry.
function scheduleObsBackgroundHoleSync() {
  if (!document.documentElement.classList.contains('obs-source')) return;
  if (obsHoleRafId) cancelAnimationFrame(obsHoleRafId);
  obsHoleRafId = requestAnimationFrame(() => {
    obsHoleRafId = 0;
    updateObsBackgroundHoleVars();
  });
}

// Sets up resize and scroll tracking for the OBS background cutout.
function setupObsBackgroundHoleSync() {
  if (!isObsSourceContext()) return;
  const scoreboardWrap = document.querySelector('.scoreboard-wrap');
  if (!scoreboardWrap) return;

  if ('ResizeObserver' in window) {
    obsHoleResizeObserver?.disconnect();
    obsHoleResizeObserver = new ResizeObserver(() => scheduleObsBackgroundHoleSync());
    obsHoleResizeObserver.observe(scoreboardWrap);
  }

  window.addEventListener('scroll', scheduleObsBackgroundHoleSync, { passive: true });
  scheduleObsBackgroundHoleSync();
}

// Marks the app as loaded and optionally skips the entrance animation.
function finalizeLoadedState({ instant = false } = {}) {
  document.body.classList.add('content-loaded');
  if (instant) {
    document.body.classList.add('entrance-finished');
    return;
  }
  setTimeout(() => document.body.classList.add('entrance-finished'), 1500);
}

// Removes the preloader immediately when the app is running in OBS.
function bypassPreloaderForObs() {
  if (!isObsSourceContext()) return;
  const preloader = document.getElementById('preloader');
  if (preloader) preloader.remove();
  finalizeLoadedState({ instant: true });
}

// Applies multiple state updates without triggering separate call sites.
function setStateValues(updates) {
  Object.entries(updates).forEach(([key, value]) => {
    state[key] = value;
  });
}

// Stores the selected team object for one side.
function setSelectedTeam(side, team) {
  state[`${side}Team`] = team ? { ...team } : null;
}

// Clears both selected teams and optionally resets name overrides.
function clearSelectedTeams({ clearOverrides = false } = {}) {
  const updates = {
    homeTeam: null,
    awayTeam: null
  };

  if (clearOverrides) {
    updates.homeNameOverride = '';
    updates.awayNameOverride = '';
  }

  setStateValues(updates);
}

// Copies a badge image onto the selected team's record.
function applyTeamBadge(side, badge) {
  const existingTeam = state[`${side}Team`];
  const teamName = existingTeam?.name || capitalize(side);

  setSelectedTeam(side, {
    ...(existingTeam || {}),
    id: existingTeam?.id || `custom-${side}`,
    name: teamName,
    badge
  });
}

// Feature module wiring.

const EventBus = createEventBus();
const getState = () => state;
const getUi = () => ui;

const teamSearchManager = createTeamSearchManager({
  getState,
  debounce,
  levenshteinDistance,
  placeholder: PLACEHOLDER,
  searchResultCap: SEARCH_RESULT_CAP,
  searchDebounceMs: SEARCH_DEBOUNCE_MS,
  setSelectedTeam,
  tournaments: TOURNAMENTS
});

const gameClockManager = createGameClockManager({
  getState,
  getUi,
  pad,
  clockMaxMinutes: CLOCK_MAX_MINUTES,
  setStatus,
  updateClockUI
});

const mediaManager = createMediaManager({
  getState,
  getUi,
  placeholder: PLACEHOLDER,
  allowedLogoTypes: ALLOWED_LOGO_TYPES,
  canvasSampleSize: CANVAS_SAMPLE_SIZE,
  capitalize,
  applyTeamBadge,
  openModal,
  closeActiveModal,
  updateVisibilityHighlight
});

const {
  prepareTeamData,
  handleSearchKeyboard,
  debouncedSearch,
  getTeam,
  repositionActivePopups,
  closeAllSearchPopups
} = teamSearchManager;
const { renderClock, setClock, toggleClockVisibility, toggleClock, resetClock, stopTimer } = gameClockManager;
const {
  setBadge,
  handleLogoUpload,
  confirmLogoUpload,
  resetCropControls,
  updateCropPreviewFromControls
} = mediaManager;
const teamNamesManager = createTeamNamesManager({ getState, getUi, capitalize });
const {
  fitTeamName,
  syncTeamNameDisplay,
  updateTeamNamesVisibilityUI,
  toggleTeamNamesVisibility,
  overrideName,
  refitTeamNames
} = teamNamesManager;

// App initialization and DOM bindings.

// Connects state events to the UI update functions.
function setupSubscriptions() {
  // Scores
  EventBus.on('homeScore', (val) => updateScoreUI('home', val));
  EventBus.on('awayScore', (val) => updateScoreUI('away', val));

  // Teams & Names
  EventBus.on('homeTeam', updateTeamsUI);
  EventBus.on('homeTeam', checkWrapperState);
  EventBus.on('awayTeam', updateTeamsUI);
  EventBus.on('awayTeam', checkWrapperState);
  EventBus.on('homeNameOverride', updateTeamsUI);
  EventBus.on('awayNameOverride', updateTeamsUI);

  // Clock & Status
  EventBus.on('clockSec', (val) => renderClock(val));
  EventBus.on('running', updateClockUI);
  EventBus.on('status', updateClockUI);
  EventBus.on('clockVisible', updateClockUI);
  EventBus.on('startTime', updateClockUI);

  // Preferences & Layout
  EventBus.on('theme', updateThemeUI);
  EventBus.on('mode', prepareTeamData);
  EventBus.on('mode', updateTeamsUI);
  EventBus.on('mode', updateThemeUI);
  EventBus.on('visibilityMode', updateThemeUI);
  EventBus.on('teamNamesVisible', updateTeamNamesVisibilityUI);
}

// Boots the app from persisted data and performs the initial render.
function init() {
  const rawData = Persistence.load();
  if (typeof rawData.teamNamesVisible !== 'boolean') rawData.teamNamesVisible = true;
  if (rawData.theme !== 'default' && !THEMES.includes(rawData.theme)) rawData.theme = 'default';

  syncObsSourceModeClass();
  bypassPreloaderForObs();

  // Initialize Subscriptions before the Proxy starts emitting
  setupSubscriptions();

  // Initialize Reactive State
  state = createState(rawData);

  cacheElements();
  setupObsBackgroundHoleSync();
  prepareTeamData();
  syncUI(); // Initial full render

  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// Resolves and caches DOM nodes used across the app.
function cacheElements() {
  ui.scoreHome = document.getElementById('score-home');
  ui.scoreAway = document.getElementById('score-away');
  ui.ctrlHomeScore = document.getElementById('ctrl-home-score');
  ui.ctrlAwayScore = document.getElementById('ctrl-away-score');

  const ids = [
    'clock-display', 'clock-status-text', 'start-btn',
    'home-clear-search-btn', 'away-clear-search-btn', 'home-name', 'away-name',
    'home-name-override', 'away-name-override',
    'home-team-search', 'away-team-search', 'theme-select', 'mode-select', 
    'tournament-group-display', 'visibility-mode-select',
    'fx-suggestion-icon', 'home-badge', 'home-badge-wrap',
    'mini-home-badge', 'away-badge', 'away-badge-wrap', 'mini-away-badge',
    'new-game-btn', 'home-logo-upload', 'away-logo-upload', 
    'set-clock-btn',
    'reset-clock-btn', 'toggle-clock-btn', 'clock-wrap',
    'reset-scores-btn', 'reset-teams-btn', 'reset-all-btn',
    'toggle-team-names-btn', 'confirm-reset-all-btn', 'confirm-start-time-btn', 'clock-min', 'clock-sec',
    'crop-modal', 'crop-preview-canvas', 'crop-zoom', 'crop-top', 'crop-right', 'crop-bottom', 'crop-left',
    'crop-zoom-value', 'crop-top-value', 'crop-right-value', 'crop-bottom-value', 'crop-left-value', 'crop-reset-btn',
    'confirm-crop-btn', 'close-crop-modal-btn', 
    'toggle-contact-btn', 'feedback-link', 'status-btn-not-started',
    'help-fab', 'help-panel', 'help-close-btn',
    'header-menu-toggle', 'header-controls',
    'mobile-warning-modal', 'mobile-warning-dismiss-btn', 'mobile-warning-help-btn'
  ];

  ids.forEach(id => {
    const camelCase = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
    ui[camelCase] = document.getElementById(id);
  });

  // Cache status buttons
  ui.statusBtns = document.querySelectorAll('.status-btn');

  // Re-establish wraps for mini badges (parents of the img elements)
  ui.miniHomeBadgeWrap = ui.miniHomeBadge?.parentElement;
  ui.miniAwayBadgeWrap = ui.miniAwayBadge?.parentElement;

  setupListeners();
}

// Wires the UI controls to their corresponding state and action handlers.
function setupListeners() {
  // Theme, Mode, FX
  ui.themeSelect?.addEventListener('change', (e) => setTheme(e.target.value));
  // ui.modeSelect?.addEventListener('change', (e) => changeMode(e.target.value));
  ui.visibilityModeSelect?.addEventListener('change', (e) => setVisibilityMode(e.target.value));
  
  // OBS and Utils
  ui.newGameBtn?.addEventListener('click', () => {
    const newId = Math.random().toString(36).substring(2, 9);
    window.open(`${window.location.origin}${window.location.pathname}?id=${newId}`, '_blank');
  });
  ui.toggleContactBtn?.addEventListener('click', toggleContactForm);
  ui.feedbackLink?.addEventListener('click', (e) => { e.preventDefault(); toggleContactForm(); });
  ui.helpFab?.addEventListener('click', toggleHelpPanel);
  ui.helpCloseBtn?.addEventListener('click', () => setHelpPanel(false));
  ui.headerMenuToggle?.addEventListener('click', toggleHeaderMenu);
  ui.mobileWarningDismissBtn?.addEventListener('click', dismissMobileWarning);
  ui.mobileWarningHelpBtn?.addEventListener('click', openMobileWarningHelp);
  initHelpAttentionHint();

  // Score & Teams
  ui.resetScoresBtn?.addEventListener('click', resetScores);
  ui.resetTeamsBtn?.addEventListener('click', resetTeams);
  ui.resetAllBtn?.addEventListener('click', resetAll);
  ui.toggleTeamNamesBtn?.addEventListener('click', toggleTeamNamesVisibility);
  ui.confirmResetAllBtn?.addEventListener('click', confirmResetAll);

  // Crop Modal
  ui.confirmCropBtn?.addEventListener('click', confirmLogoUpload);
  ui.cropZoom?.addEventListener('input', updateCropPreviewFromControls);
  ui.cropTop?.addEventListener('input', updateCropPreviewFromControls);
  ui.cropRight?.addEventListener('input', updateCropPreviewFromControls);
  ui.cropBottom?.addEventListener('input', updateCropPreviewFromControls);
  ui.cropLeft?.addEventListener('input', updateCropPreviewFromControls);
  ui.cropResetBtn?.addEventListener('click', resetCropControls);

  document.querySelectorAll('.btn-plus, .btn-minus').forEach(btn => {
    btn.addEventListener('click', () => changeScore(btn.dataset.side, parseInt(btn.dataset.delta)));
  });

  // Search & Inputs
  ['home', 'away'].forEach(side => {
    const searchInput = ui[`${side}TeamSearch`];
    const resultsPopup = document.getElementById(`${side}-team-results`);
    if (searchInput && resultsPopup) {
      searchInput.setAttribute('aria-controls', resultsPopup.id);
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.setAttribute('autocomplete', 'off');
      resultsPopup.setAttribute('aria-hidden', 'true');
      preventPopupScrollChaining(resultsPopup);
    }
    searchInput?.addEventListener('input', (e) => debouncedSearch(side, e.target.value));
    searchInput?.addEventListener('keydown', (e) => handleSearchKeyboard(e, side));
    searchInput?.addEventListener('focus', (e) => {
      if (!e.target.value.trim()) debouncedSearch(side, '');
    });
    ui[`${side}ClearSearchBtn`]?.addEventListener('click', () => { searchInput.value = ''; debouncedSearch(side, ''); });
    ui[`${side}NameOverride`]?.addEventListener('input', (e) => overrideName(side, e.target.value));
    ui[`${side}LogoUpload`]?.addEventListener('change', (e) => handleLogoUpload(side, e.target));
  });

  // Clock
  ui.startBtn?.addEventListener('click', toggleClock);
  ui.setClockBtn?.addEventListener('click', setClock);
  ui.resetClockBtn?.addEventListener('click', resetClock);
  ui.toggleClockBtn?.addEventListener('click', toggleClockVisibility);
  ui.confirmStartTimeBtn?.addEventListener('click', confirmStartTime);
  ui.statusBtnNotStarted?.addEventListener('click', showStartTimeModal);
  
  // Clock Validation: Prevent letters and negative numbers
  [ui.clockMin, ui.clockSec].forEach(input => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (['e', 'E', '-', '+', '.'].includes(e.key)) e.preventDefault();
      if (e.key === 'Enter') {
        if (input.id === 'clock-min' || input.id === 'clock-sec') setClock();
        input.blur();
      }
    });
    input.addEventListener('input', () => {
      let val = input.value.replace(/\D/g, '');
      let num = parseInt(val) || 0;
      if (input.id === 'clock-sec') num = Math.min(num, 59);
      input.value = num;
    });
  });

  // Status Buttons with data-status
  ui.statusBtns.forEach(btn => {
    if (btn.hasAttribute('data-status')) {
      btn.addEventListener('click', () => setStatus(btn.dataset.status));
    }
  });

  // Modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', closeActiveModal));

  // Overlay click to close when clicking outside modal-card
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov && ov.id !== 'mobile-warning-modal') closeActiveModal();
    });
  });

}

// Stops wheel/touch scroll chaining from an open popup into the page.
function preventPopupScrollChaining(popup) {
  if (!popup) return;

  let lastTouchY = 0;

  const isScrollable = () => popup.scrollHeight > popup.clientHeight;
  const atTop = () => popup.scrollTop <= 0;
  const atBottom = () => popup.scrollTop + popup.clientHeight >= popup.scrollHeight - 1;

  const shouldBlock = (deltaY) => {
    if (!isScrollable()) return false;
    return (deltaY < 0 && atTop()) || (deltaY > 0 && atBottom());
  };

  popup.addEventListener('wheel', (e) => {
    if (shouldBlock(e.deltaY)) e.preventDefault();
  }, { passive: false });

  popup.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  popup.addEventListener('touchmove', (e) => {
    if (e.touches.length === 0) return;
    const currentTouchY = e.touches[0].clientY;
    const deltaY = lastTouchY - currentTouchY;
    lastTouchY = currentTouchY;
    if (shouldBlock(deltaY)) e.preventDefault();
  }, { passive: false });
}

// UI synchronization and rendering.

// Renders the full UI from the current state snapshot.
function syncUI() {
  checkWrapperState();
  updateScoreUI();
  updateTeamsUI();
  updateClockUI();
  updateThemeUI();
  updateTeamNamesVisibilityUI();
  updateVisibilityHighlight();
  scheduleObsBackgroundHoleSync();
}

// Toggles the wrapper class that reflects whether both teams are selected.
function checkWrapperState() {
  const wrapper = document.querySelector('.wrapper');
  const bothTeamsPicked = !!(state.homeTeam && state.awayTeam);
  const currentlySelectedClass = wrapper.classList.contains('teams-selected');

  if (bothTeamsPicked === currentlySelectedClass) return;
  if (document.startViewTransition) {
    document.startViewTransition(() => wrapper.classList.toggle('teams-selected', bothTeamsPicked));
  } else {
    wrapper.classList.toggle('teams-selected', bothTeamsPicked);
  }
}

// Updates the scoreboard and control panel scores for one or both sides.
function updateScoreUI(side, value) {
  const sides = side ? [side] : ['home', 'away'];
  sides.forEach(s => {
    const sideKey = capitalize(s);
    const score = (side === s && value !== undefined) ? value : state[`${s}Score`];
    if (ui[`score${sideKey}`]) ui[`score${sideKey}`].textContent = score;
    if (ui[`ctrl${sideKey}Score`]) ui[`ctrl${sideKey}Score`].textContent = score;
  });
}

// Syncs selected teams, overrides, badges, and tournament group text.
function updateTeamsUI() {
  ['home', 'away'].forEach(side => {
    const team = state[`${side}Team`];
    const override = (state[`${side}NameOverride`] || '').trim();
    const name = override || team?.name || capitalize(side);
    
    if (ui[`${side}NameOverride`]) ui[`${side}NameOverride`].value = override;
    syncTeamNameDisplay(side, name);

    let badgeSrc = PLACEHOLDER;
    if (team) {
      const freshTeamData = getTeam(team.id);
      badgeSrc = (team.badge?.startsWith('data:')) ? team.badge : (freshTeamData?.badge || PLACEHOLDER);
    }
    setBadge(side, badgeSrc);
  });

  if (ui.tournamentGroupDisplay) {
    let groupInfo = '';
    if (state.mode === 'worldcup') {
      const hGroup = state.homeTeam?.league;
      const aGroup = state.awayTeam?.league;
      if (hGroup && aGroup) groupInfo = (hGroup === aGroup) ? hGroup : `${hGroup} / ${aGroup}`;
      else groupInfo = hGroup || aGroup || '';
    }
    const displayElement = ui.tournamentGroupDisplay;
    displayElement.textContent = groupInfo.toUpperCase();
    if (groupInfo) {
      displayElement.style.opacity = '1';
    } else {
      displayElement.style.opacity = '0';
    }
  }
}

// Updates the clock controls and status text to match current timer state.
function updateClockUI() {
  if (ui.startBtn) {
    ui.startBtn.textContent = state.running ? '⏸ Pause' : '▶ Start';
    ui.startBtn.className = state.running ? 'btn btn-secondary' : 'btn btn-green';
  }

  if (ui.clockWrap) {
    ui.clockWrap.classList.toggle('is-hidden', state.clockVisible === false);
  }
  if (ui.toggleClockBtn) {
    ui.toggleClockBtn.textContent = state.clockVisible === false ? 'Show' : 'Hide';
  }

  renderClock();
  renderStatusUI(state.status);
}

// Renders the textual match status label.
function renderStatusUI(s) {
  let label = STATUS_LABELS[s] || s;
  if (s === 'NOT STARTED' && state.startTime) {
    label = `KICK OFF ${state.startTime}`;
  }
  ui.clockStatusText.textContent = label;
  ui.statusBtns.forEach(b => {
    const isActive = b.dataset.status === s;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive);
  });
}

// Applies theme, mode, and visibility classes to the document root.
function updateThemeUI() {
  if (ui.themeSelect) ui.themeSelect.value = state.theme;
  if (ui.modeSelect) ui.modeSelect.value = state.mode;
  
  const visMode = state.visibilityMode || 'none';
  if (ui.visibilityModeSelect) ui.visibilityModeSelect.value = visMode;
  
  document.documentElement.classList.remove('visibility-none', 'visibility-glow', 'visibility-contrast');
  document.documentElement.classList.add(`visibility-${visMode}`);

  document.documentElement.classList.remove(...THEMES.map(t => `theme-${t}`));
  if (state.theme && state.theme !== 'default') {
    document.documentElement.classList.add(`theme-${state.theme}`);
  }
}

// Score, team display, and visibility behavior.
// Shows or hides the visibility enhancement indicator.
function updateVisibilityHighlight() {
  if (!ui.visibilityModeSelect) return;
  
  const isNone = state.visibilityMode === 'none';
  const isLightTheme = state.theme === 'light';
  
  // Checks whether a badge needs the visibility enhancement icon.
  const needsFx = (imgEl) => {
    // Ignore if element is missing or it's just the placeholder SVG
    if (!imgEl || (imgEl.src && imgEl.src.includes('PHN2Zy'))) return false;
    // If dark theme, suggest if badge is dark. If light theme, suggest if badge is light.
    return isLightTheme ? imgEl.classList.contains('is-light') : imgEl.classList.contains('is-dark');
  };

  // Check both main and mini badges to ensure the state is captured correctly
  const highlight = isNone && (
    needsFx(ui.homeBadge) || needsFx(ui.awayBadge) || 
    needsFx(ui.miniHomeBadge) || needsFx(ui.miniAwayBadge)
  );

  if (ui.fxSuggestionIcon) {
    ui.fxSuggestionIcon.style.display = highlight ? 'block' : 'none';
  }
}

// Manually updates the visibility enhancement mode.
function setVisibilityMode(mode) {
  state.visibilityMode = mode;
  updateVisibilityHighlight();
  document.activeElement?.blur();
}

// Adjusts one side's score and briefly animates the updated value.
function changeScore(side, delta) {
  const key = side + 'Score';
  state[key] = Math.max(0, state[key] + delta);
  const el = ui['score' + capitalize(side)];
  if (el) {
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }
}

// Resets both scores back to zero.
function resetScores() {
  state.homeScore = 0;
  state.awayScore = 0;
}

// Clears the selected teams and removes the selected-state styling.
function resetTeams() {
  // Clears the selected-team wrapper state.
  const resetAction = () => {
    const wrapper = document.querySelector('.wrapper');
    if (wrapper) wrapper.classList.toggle('teams-selected', false);
    clearSelectedTeams({ clearOverrides: true });
  };

  if (document.startViewTransition) {
    document.startViewTransition(resetAction);
  } else {
    resetAction();
  }

  syncUI();
}
// Settings, help panel, and modal actions.

// Switches the scoreboard mode and clears team picks for the new dataset.
function changeMode(mode) {
  // Applies the mode update inside the optional view transition.
  const update = () => {
    state.mode = mode;
    clearSelectedTeams({ clearOverrides: true });
  };
  if (document.startViewTransition) document.startViewTransition(update);
  else update();
  if (document.activeElement?.blur) document.activeElement.blur();
}

// Restarts the theme transition class so visual changes animate cleanly.
function syncThemeChangeTransition() {
  const root = document.documentElement;
  root.classList.add('theme-changing');

  if (themeTransitionResetTimer) {
    clearTimeout(themeTransitionResetTimer);
  }

  themeTransitionResetTimer = setTimeout(() => {
    root.classList.remove('theme-changing');
    themeTransitionResetTimer = 0;
  }, THEME_CHANGE_TRANSITION_MS + 40);
}

// Applies a new theme name and closes the active control focus.
function setTheme(themeName) {
  if (themeName !== 'default' && !THEMES.includes(themeName)) themeName = 'default';
  syncThemeChangeTransition();
  state.theme = themeName;
  if (document.activeElement?.blur) document.activeElement.blur();
}

// Updates the match status and refreshes the status UI.
function setStatus(s) {
  state.status = s;
  renderStatusUI(s);
}

// Toggles the contact form visibility.
function toggleContactForm() {
  document.getElementById('contact-form').classList.toggle('active');
}

// Opens a modal and focuses the requested initial control.
function openModal(modal, { initialFocus = null, onClose = null } = {}) {
  if (!modal) return;

  modalTriggerElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModalCleanup = typeof onClose === 'function' ? onClose : null;
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');

  const targetFocus = initialFocus || modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  targetFocus?.focus();
}

// Returns whether the help panel is currently open.
function isHelpPanelOpen() {
  return Boolean(ui.helpPanel?.classList.contains('active'));
}

// Highlights the help button until the panel has been seen once.
function initHelpAttentionHint() {
  if (!ui.helpFab) return;

  const seen = localStorage.getItem(HELP_FAB_SEEN_KEY) === '1';
  if (!seen) ui.helpFab.classList.add('attention');
}

// Opens or closes the help panel and updates its ARIA state.
function setHelpPanel(open) {
  if (!ui.helpPanel || !ui.helpFab) return;

  ui.helpPanel.classList.toggle('active', open);
  ui.helpPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  ui.helpFab.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    localStorage.setItem(HELP_FAB_SEEN_KEY, '1');
    ui.helpFab.classList.remove('attention');
  }

  if (open) {
    ui.helpCloseBtn?.focus();
  } else {
    ui.helpFab.focus();
  }
}

// Toggles the help panel open state.
function toggleHelpPanel() {
  setHelpPanel(!isHelpPanelOpen());
}

// Checks whether the header is in its mobile layout breakpoint.
function isMobileHeaderViewport() {
  return window.matchMedia('(max-width: 820px)').matches;
}

// Checks whether the app is currently in a phone-sized viewport.
function isMobileViewport() {
  return window.matchMedia('(max-width: 820px)').matches;
}

// Returns whether the desktop warning should be shown on this device.
function shouldShowMobileWarning() {
  if (isObsSourceContext()) return false;
  if (!isMobileViewport()) return false;
  return localStorage.getItem(MOBILE_WARNING_DISMISSED_KEY) !== '1';
}

// Opens or closes the desktop-recommended warning based on viewport and preference.
function syncMobileWarningModal() {
  const modal = ui.mobileWarningModal;
  if (!modal) return;

  const activeModal = document.querySelector('.modal-overlay.active');
  const warningIsActive = modal.classList.contains('active');
  const shouldOpen = shouldShowMobileWarning();

  if (!shouldOpen && warningIsActive) {
    closeActiveModal();
    return;
  }

  if (!shouldOpen) return;
  if (activeModal && activeModal !== modal) return;
  if (warningIsActive) return;

  openModal(modal, {
    initialFocus: ui.mobileWarningDismissBtn,
    onClose: () => {
      document.body.classList.remove('mobile-warning-active');
    }
  });
  document.body.classList.add('mobile-warning-active');
}

// Stores dismissal of the desktop recommendation notice for mobile viewports.
function dismissMobileWarning() {
  localStorage.setItem(MOBILE_WARNING_DISMISSED_KEY, '1');
  closeActiveModal();
}

// Dismisses the mobile warning and opens the quick help panel.
function openMobileWarningHelp() {
  dismissMobileWarning();
  setHelpPanel(true);
}

// Opens or closes the compact header menu on mobile.
function setHeaderMenu(open) {
  const header = document.querySelector('header');
  if (!header || !ui.headerMenuToggle || !ui.headerControls) return;

  const shouldOpen = Boolean(open) && isMobileHeaderViewport();
  header.classList.toggle('menu-open', shouldOpen);
  ui.headerMenuToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  ui.headerControls.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
}

// Toggles the mobile header menu when the viewport allows it.
function toggleHeaderMenu() {
  const header = document.querySelector('header');
  if (!header || !isMobileHeaderViewport()) return;
  setHeaderMenu(!header.classList.contains('menu-open'));
}

// Keeps the header menu state aligned with viewport changes.
function syncHeaderMenuViewportState() {
  if (!ui.headerControls || !ui.headerMenuToggle) return;

  if (isMobileHeaderViewport()) {
    const header = document.querySelector('header');
    const isOpen = header?.classList.contains('menu-open');
    ui.headerControls.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    ui.headerMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    return;
  }

  const header = document.querySelector('header');
  if (header) header.classList.remove('menu-open');
  ui.headerControls.setAttribute('aria-hidden', 'false');
  ui.headerMenuToggle.setAttribute('aria-expanded', 'false');
}

// Opens the reset confirmation modal.
function resetAll() {
  const modal = document.getElementById('modal-overlay');
  const confirmBtn = modal?.querySelector('#confirm-reset-all-btn');
  openModal(modal, { initialFocus: confirmBtn });
}

// Opens the start-time modal with the current value prefilled.
function showStartTimeModal() {
  const modal = document.getElementById('start-time-modal');
  const input = document.getElementById('start-time-input');
  if (input) input.value = state.startTime || '';
  openModal(modal, { initialFocus: input });
}

// Closes the currently active modal and restores focus.
function closeActiveModal() {
  const active = document.querySelector('.modal-overlay.active');
  if (active) {
    active.classList.remove('active');
    active.setAttribute('aria-hidden', 'true');
    if (activeModalCleanup) {
      const cleanup = activeModalCleanup;
      activeModalCleanup = null;
      cleanup();
    }
    if (modalTriggerElement) {
      modalTriggerElement.focus();
      modalTriggerElement = null;
    }
  }
}

// Saves the start time and marks the match as not started.
function confirmStartTime() {
  state.startTime = document.getElementById('start-time-input').value || null;
  setStatus('NOT STARTED');
  closeActiveModal();
}

// Restores the scoreboard to its initial state after confirmation.
function confirmResetAll() {
  closeActiveModal();
  stopTimer();
  state = createState({ ...INITIAL_STATE, theme: state.theme, mode: state.mode, visibilityMode: state.visibilityMode });
  prepareTeamData();
  syncUI();
  saveState();
}

// Global document and window handlers.

document.addEventListener('click', (e) => {
  if (isMobileHeaderViewport()) {
    const header = document.querySelector('header');
    if (header?.classList.contains('menu-open') && !e.target.closest('header')) {
      setHeaderMenu(false);
    }
  }

  if (!e.target.closest('.search-container')) {
    closeAllSearchPopups();
  }
  const activeEl = document.activeElement;
  const isLocked = activeEl && ['SELECT', 'INPUT', 'TEXTAREA'].includes(activeEl.tagName);
  if (isLocked && !e.target.closest('select') && !e.target.closest('input') && !e.target.closest('textarea')) {
    activeEl.blur();
  }
});

window.addEventListener('keydown', (e) => {
  if (isMobileHeaderViewport() && e.key === 'Escape') {
    const header = document.querySelector('header');
    if (header?.classList.contains('menu-open')) {
      setHeaderMenu(false);
      ui.headerMenuToggle?.focus();
      return;
    }
  }

  const activeModal = document.querySelector('.modal-overlay.active');

  if (activeModal) {
    if (e.key === 'Escape') {
      if (activeModal.id === 'mobile-warning-modal') {
        e.preventDefault();
        return;
      }
      closeActiveModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = Array.from(activeModal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.disabled && el.offsetParent !== null);
      
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
      return;
    }
    // Do not execute global shortcuts while a modal is active.
    return;
  }

  if (isEditableShortcutTarget(e.target) || isEditableShortcutTarget(document.activeElement)) return;

  switch (getShortcutKey(e)) {
    case 'space':
      e.preventDefault();
      toggleClock();
      break;
    case 'h':
      changeScore('home', e.shiftKey ? -1 : 1);
      break;
    case 'a':
      changeScore('away', e.shiftKey ? -1 : 1);
      break;
    case 'x':
      if (e.shiftKey) resetAll();
      break;
    case 'c':
      toggleClockVisibility();
      break;
  }
}, true);

// Re-check name fit on resize (e.g. crossing the mobile breakpoint where the
// base font-size changes, or an OBS browser source being resized).
window.addEventListener('resize', debounce(() => {
  refitTeamNames();
  repositionActivePopups(() => ui);
  syncHeaderMenuViewportState();
  syncMobileWarningModal();
  scheduleObsBackgroundHoleSync();
}, 150));

// The display font loads asynchronously; re-measure once it's ready so the
// first fit decision isn't based on fallback-font metrics.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    refitTeamNames();
  });
}

// Hides the preloader once all assets (images, fonts, scripts) are fully loaded.
window.addEventListener('load', () => {
  ensureTopScrollPositionWithFallback();
  const isObsMode = isObsSourceContext();
  const preloader = document.getElementById('preloader');
  if (preloader && !isObsMode) {
    preloader.classList.add('preloader-hidden');
    finalizeLoadedState();
    setTimeout(() => preloader.remove(), 700);
    setTimeout(() => scheduleObsBackgroundHoleSync(), 750);
  } else {
    if (preloader) preloader.remove();
    finalizeLoadedState({ instant: isObsMode });
  }
  scheduleObsBackgroundHoleSync();
});

init();
syncHeaderMenuViewportState();
syncMobileWarningModal();