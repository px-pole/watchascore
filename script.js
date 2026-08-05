import {
  STATUS_LABELS,
  PLACEHOLDER,
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
import {
  syncCustomSelectValue,
  setupCustomSelect,
  closeAllCustomSelects
} from './js/core/custom-select.js';
import { createObsSourceManager } from './js/core/obs-source.js';
import { createModalStateManager } from './js/core/modal-state.js';
import { createPersistence } from './js/core/persistence.js';
import { createShellUiManager } from './js/core/shell-ui.js';
import { createStateBatchManager } from './js/core/state-batch.js';
import {
  pad,
  capitalize,
  levenshteinDistance,
  debounce,
  isEditableShortcutTarget,
  getShortcutKey,
  preventPopupScrollChaining
} from './js/utils/helpers.js';
import { createTeamSearchManager } from './js/features/team-search.js';
import { createGameClockManager } from './js/features/game-clock.js';
import { createMediaManager } from './js/features/media.js';
import { createScoreboardUiManager } from './js/features/scoreboard-ui.js';
import { createTeamNamesManager } from './js/features/team-names.js';
import {
  buildPenaltyMarkSlots,
  getPenaltyScore,
  buildPenaltyAttemptUpdate,
  buildUndoPenaltyUpdate,
  buildUndoLastPenaltyUpdate
} from './js/features/penalties.js';
import { createNotificationManager } from './js/core/notifications.js';
import { TOURNAMENTS } from './teams.js';

// Force top-of-page start on reload instead of browser-restored scroll position.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// App-level state, storage keys, and reactive state proxy.

const urlParams = new URLSearchParams(window.location.search);
const GAME_ID = urlParams.get('id') || 'default';
const STORAGE_KEY = `scoreboard_state_${GAME_ID}`;
const STATE_KEY_PREFIX = 'scoreboard_state_';
const PREFS_KEY = 'scoreboard_prefs'; // Global key for user preferences (Theme, Mode, etc.)
const MOBILE_WARNING_DISMISSED_KEY = 'scoreboard_mobile_warning_dismissed';
const Persistence = createPersistence({
  storageKey: STORAGE_KEY,
  prefsKey: PREFS_KEY,
  initialState: INITIAL_STATE,
  stateKeyPrefix: STATE_KEY_PREFIX
});

let state = null;
let ui = {}; // DOM Cache
let themeTransitionResetTimer = 0;

const THEME_CHANGE_TRANSITION_MS = 300;

const modalStateManager = createModalStateManager();
const getUi = () => ui;
const obsSourceManager = createObsSourceManager({ getUi, urlParams });
obsSourceManager.bindTopScrollHandlers();
const shellUiManager = createShellUiManager({
  getUi,
  helpFabSeenKey: HELP_FAB_SEEN_KEY
});

const stateBatchManager = createStateBatchManager({
  save: (snapshot) => Persistence.save(snapshot),
  emit: (prop, value) => EventBus.emit(prop, value)
});

const stateHandler = {
  set(target, prop, value) {
    if (target[prop] === value) return true;
    target[prop] = value;

    stateBatchManager.recordChange(target, prop, value);
    return true;
  }
};

// Wraps the initial state object in a persistence-aware proxy.
const createState = (initialData) => new Proxy(initialData, stateHandler);

// Runs a DOM update inside a view transition when the API is available.
function runWithViewTransition(update) {
  if (document.startViewTransition) {
    document.startViewTransition(update);
    return;
  }
  update();
}

// Applies multiple state updates while persisting once and emitting once per changed key.
function setStateValues(updates) {
  stateBatchManager.applyBatch(() => {
    Object.entries(updates).forEach(([key, value]) => {
      state[key] = value;
    });
  }, state);
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
    updates.tournamentTitleOverride = '';
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
const notifications = createNotificationManager();

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
  syncTeamNameDisplay,
  updateTeamNamesVisibilityUI,
  toggleTeamNamesVisibility,
  overrideName,
  refitTeamNames
} = teamNamesManager;

const scoreboardUiManager = createScoreboardUiManager({
  getState,
  getUi,
  capitalize,
  placeholder: PLACEHOLDER,
  themes: THEMES,
  statusLabels: STATUS_LABELS,
  syncCustomSelectValue,
  getTeam,
  setBadge,
  syncTeamNameDisplay,
  getPenaltyScore,
  buildPenaltyMarkSlots,
  renderClock,
  runWithViewTransition,
  updateTeamNamesVisibilityUI,
  scheduleObsBackgroundHoleSync: () => obsSourceManager.scheduleObsBackgroundHoleSync()
});

// App initialization and DOM bindings.

// Connects state events to the UI update functions.
function setupSubscriptions() {
  // Scores
  EventBus.on('homeScore', (val) => updateScoreUI('home', val));
  EventBus.on('awayScore', (val) => updateScoreUI('away', val));
  EventBus.on('penaltyMode', updatePenaltyUI);
  EventBus.on('homePenalties', updatePenaltyUI);
  EventBus.on('awayPenalties', updatePenaltyUI);

  // Teams & Names
  EventBus.on('homeTeam', updateTeamsUI);
  EventBus.on('awayTeam', updateTeamsUI);
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
  EventBus.on('tournamentTitleOverride', updateTeamsUI);
  EventBus.on('mode', updateThemeUI);
  EventBus.on('visibilityMode', updateThemeUI);
  EventBus.on('teamNamesVisible', updateTeamNamesVisibilityUI);
  EventBus.on('teamNamesVisible', updatePenaltyUI);
}

// Boots the app from persisted data and performs the initial render.
function init() {
  const rawData = Persistence.load();
  if (typeof rawData.teamNamesVisible !== 'boolean') rawData.teamNamesVisible = true;
  if (!Array.isArray(rawData.penaltyHistory)) rawData.penaltyHistory = [];
  if (rawData.theme !== 'default' && !THEMES.includes(rawData.theme)) rawData.theme = 'default';

  obsSourceManager.syncObsSourceModeClass();
  obsSourceManager.bypassPreloaderForObs();

  // Initialize Subscriptions before the Proxy starts emitting
  setupSubscriptions();

  // Initialize Reactive State
  state = createState(rawData);

  cacheElements();
  obsSourceManager.setupObsBackgroundHoleSync();
  prepareTeamData();
  syncUI(); // Initial full render

  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// Resolves and caches DOM nodes used across the app.
function cacheElements() {
  ui.header = document.querySelector('header');
  ui.wrapper = document.querySelector('.wrapper');
  ui.scoreboardWrap = document.querySelector('.scoreboard-wrap');
  ui.scoreboardFrame = document.querySelector('.scoreboard-frame');
  ui.scoreCenter = document.querySelector('.score-center');
  ui.scoreDisplay = document.querySelector('.score-display');
  ui.scoreHome = document.getElementById('score-home');
  ui.scoreAway = document.getElementById('score-away');
  ui.ctrlHomeScore = document.getElementById('ctrl-home-score');
  ui.ctrlAwayScore = document.getElementById('ctrl-away-score');
  ui.normalScoreControls = document.querySelector('.score-controls');
  ui.penaltyControls = document.querySelector('.penalty-controls');

  const ids = [
    'clock-display', 'clock-status-text', 'start-btn',
    'home-clear-search-btn', 'away-clear-search-btn', 'home-name', 'away-name',
    'home-name-override', 'away-name-override',
    'home-team-search', 'away-team-search', 'theme-select', 'mode-select', 
    'tournament-group-display', 'tournament-title-override', 'visibility-mode-select',
    'fx-suggestion-icon', 'home-badge', 'home-badge-wrap',
    'mini-home-badge', 'away-badge', 'away-badge-wrap', 'mini-away-badge',
    'new-game-btn', 'home-logo-upload', 'away-logo-upload', 
    'set-clock-btn',
    'reset-clock-btn', 'toggle-clock-btn', 'clock-wrap',
    'toggle-penalty-mode-btn', 'penalty-home-score', 'penalty-away-score', 'penalty-home-score-wrap', 'penalty-away-score-wrap',
    'undo-last-penalty-btn',
    'ctrl-home-penalty-score', 'ctrl-away-penalty-score', 'penalty-tracker', 'penalty-home-marks', 'penalty-away-marks',
    'reset-scores-btn', 'reset-teams-btn', 'reset-all-btn',
    'toggle-team-names-btn', 'clear-title-override-btn', 'confirm-reset-all-btn', 'confirm-start-time-btn', 'clock-min', 'clock-sec',
    'modal-overlay', 'start-time-modal', 'start-time-input',
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
  document.querySelectorAll('.custom-select').forEach((sel) => {
    setupCustomSelect(sel, { onSelect: handleCustomSelectSelection });
  });
  
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
    btn.addEventListener('click', () => {
      const delta = Number.parseInt(btn.dataset.delta, 10);
      if (!Number.isFinite(delta)) return;
      changeScore(btn.dataset.side, delta);
    });
  });

  ui.togglePenaltyModeBtn?.addEventListener('click', togglePenaltyMode);
  document.querySelectorAll('.penalty-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.penaltyAction === 'undo-last') {
        undoLastPenalty();
        return;
      }

      const side = btn.dataset.side;
      if (!side) return;

      const result = btn.dataset.penaltyResult;
      if (result === 'made' || result === 'missed') {
        addPenaltyAttempt(side, result);
      }
    });
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

  ui.tournamentTitleOverride?.addEventListener('input', (e) => {
    state.tournamentTitleOverride = e.target.value;
  });
  ui.clearTitleOverrideBtn?.addEventListener('click', () => {
    state.tournamentTitleOverride = '';
    ui.tournamentTitleOverride?.focus();
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
        setClock();
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

// UI synchronization and rendering.

// Renders the full UI from the current state snapshot.
function syncUI() {
  scoreboardUiManager.syncUI();
}

// Toggles the wrapper class that reflects whether both teams are selected.
function checkWrapperState() {
  scoreboardUiManager.checkWrapperState();
}

// Updates the scoreboard and control panel scores for one or both sides.
function updateScoreUI(side, value) {
  scoreboardUiManager.updateScoreUI(side, value);
}

// Syncs selected teams, overrides, badges, and tournament group text.
function updateTeamsUI() {
  scoreboardUiManager.updateTeamsUI();
}

// Updates the clock controls and status text to match current timer state.
function updateClockUI() {
  scoreboardUiManager.updateClockUI();
}

// Keeps the scoreboard wrapper on one explicit layout state instead of stacked overrides.
function syncScoreboardLayoutState() {
  scoreboardUiManager.syncScoreboardLayoutState();
}

// Updates penalty-mode layout, penalty scores, and visual shot notation.
function updatePenaltyUI() {
  scoreboardUiManager.updatePenaltyUI();
}

// Anchors penalty marks inside the same lane the clock normally occupies.
function syncPenaltyTrackerLane() {
  scoreboardUiManager.syncPenaltyTrackerLane();
}

// Moves badges outward only when penalty marks would overlap the center lane.
function syncPenaltyTightSpace() {
  scoreboardUiManager.syncPenaltyTightSpace();
}

// Renders per-kick notation (scored/missed) for one side.
function renderPenaltyMarks(side) {
  scoreboardUiManager.renderPenaltyMarks(side);
}

// Toggles penalty mode without altering the regular scoreline.
function togglePenaltyMode() {
  state.penaltyMode = !state.penaltyMode;
  updatePenaltyUI();
  updateClockUI();
  obsSourceManager.scheduleObsBackgroundHoleSync();
}

// Appends a scored or missed penalty attempt for one side.
function addPenaltyAttempt(side, result) {
  setStateValues(buildPenaltyAttemptUpdate(state, side, result));
}

// Removes the most recent penalty attempt for one side.
function undoPenalty(side) {
  const updates = buildUndoPenaltyUpdate(state, side);
  if (!updates) return false;
  setStateValues(updates);
  return true;
}

// Removes the most recent penalty attempt across both teams.
function undoLastPenalty() {
  const updates = buildUndoLastPenaltyUpdate(state);
  if (!updates) return;
  setStateValues(updates);
}

// Renders the textual match status label.
function renderStatusUI(s) {
  scoreboardUiManager.renderStatusUI(s);
}

// Applies theme, mode, and visibility classes to the document root.
function updateThemeUI() {
  scoreboardUiManager.updateThemeUI();
}

// Score, team display, and visibility behavior.
// Shows or hides the visibility enhancement indicator.
function updateVisibilityHighlight() {
  scoreboardUiManager.updateVisibilityHighlight();
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
  setStateValues({
    homeScore: 0,
    awayScore: 0,
    homePenalties: [],
    awayPenalties: [],
    penaltyHistory: []
  });
  notifications.show('Scores reset');
}

// Clears the selected teams and removes the selected-state styling.
function resetTeams() {
  // Clears the selected-team wrapper state.
  const resetAction = () => {
    if (ui.wrapper) ui.wrapper.classList.toggle('teams-selected', false);
    clearSelectedTeams({ clearOverrides: true });
    notifications.show('Teams reset');
  };

  runWithViewTransition(resetAction);

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
  runWithViewTransition(update);
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
  modalStateManager.open(modal, { initialFocus, onClose });
}

// Returns whether the help panel is currently open.
function isHelpPanelOpen() {
  return shellUiManager.isHelpPanelOpen();
}

// Highlights the help button until the panel has been seen once.
function initHelpAttentionHint() {
  shellUiManager.initHelpAttentionHint();
}

// Opens or closes the help panel and updates its ARIA state.
function setHelpPanel(open) {
  shellUiManager.setHelpPanel(open);
}

// Toggles the help panel open state.
function toggleHelpPanel() {
  shellUiManager.toggleHelpPanel();
}

// Checks whether the app is in its mobile layout breakpoint.
function isMobileHeaderViewport() {
  return shellUiManager.isMobileHeaderViewport();
}

// Returns whether the desktop warning should be shown on this device.
function shouldShowMobileWarning() {
  if (obsSourceManager.isObsSourceContext()) return false;
  if (!isMobileHeaderViewport()) return false;
  return localStorage.getItem(MOBILE_WARNING_DISMISSED_KEY) !== '1';
}

// Opens or closes the desktop-recommended warning based on viewport and preference.
function syncMobileWarningModal() {
  const modal = ui.mobileWarningModal;
  if (!modal) return;

  const activeModal = modalStateManager.getActiveModal();
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
  shellUiManager.setHeaderMenu(open);
}

// Toggles the mobile header menu when the viewport allows it.
function toggleHeaderMenu() {
  shellUiManager.toggleHeaderMenu();
}

// Keeps the header menu state aligned with viewport changes.
function syncHeaderMenuViewportState() {
  shellUiManager.syncHeaderMenuViewportState();
}

// Opens the reset confirmation modal.
function resetAll() {
  const modal = ui.modalOverlay;
  const confirmBtn = modal?.querySelector('#confirm-reset-all-btn');
  openModal(modal, { initialFocus: confirmBtn });
}

// Opens the start-time modal with the current value prefilled.
function showStartTimeModal() {
  const modal = ui.startTimeModal;
  const input = ui.startTimeInput;
  if (input) input.value = state.startTime || '';
  openModal(modal, { initialFocus: input });
}

// Closes the currently active modal and restores focus.
function closeActiveModal() {
  modalStateManager.close();
}

// Saves the start time and marks the match as not started.
function confirmStartTime() {
  state.startTime = ui.startTimeInput?.value || null;
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
  notifications.show('Scoreboard reset');
}

// Custom select dropdown helpers.

function handleCustomSelectSelection(value, sel) {
  if (sel.id === 'theme-select') setTheme(value);
  else if (sel.id === 'visibility-mode-select') setVisibilityMode(value);
  else if (sel.id === 'mode-select') changeMode(value);
}

// Global document and window handlers.

document.addEventListener('click', (e) => {
  if (isMobileHeaderViewport()) {
    const header = ui.header;
    if (header?.classList.contains('menu-open') && !e.target.closest('header')) {
      setHeaderMenu(false);
    }
  }

  if (!e.target.closest('.custom-select')) closeAllCustomSelects();

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
    const header = ui.header;
    if (header?.classList.contains('menu-open')) {
      setHeaderMenu(false);
      ui.headerMenuToggle?.focus();
      return;
    }
  }

  const activeModal = modalStateManager.getActiveModal();

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
      if (state.penaltyMode === true) {
        addPenaltyAttempt('home', e.shiftKey ? 'missed' : 'made');
      } else {
        changeScore('home', e.shiftKey ? -1 : 1);
      }
      break;
    case 'a':
      if (state.penaltyMode === true) {
        addPenaltyAttempt('away', e.shiftKey ? 'missed' : 'made');
      } else {
        changeScore('away', e.shiftKey ? -1 : 1);
      }
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
  syncPenaltyTrackerLane();
  syncPenaltyTightSpace();
  obsSourceManager.scheduleObsBackgroundHoleSync();
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
  obsSourceManager.ensureTopScrollPositionWithFallback();
  const isObsMode = obsSourceManager.isObsSourceContext();
  const preloader = document.getElementById('preloader');
  if (preloader && !isObsMode) {
    preloader.classList.add('preloader-hidden');
    obsSourceManager.finalizeLoadedState();
    setTimeout(() => preloader.remove(), 700);
    setTimeout(() => obsSourceManager.scheduleObsBackgroundHoleSync(), 750);
  } else {
    if (preloader) preloader.remove();
    obsSourceManager.finalizeLoadedState({ instant: isObsMode });
  }
  obsSourceManager.scheduleObsBackgroundHoleSync();
});

init();
syncHeaderMenuViewportState();
syncMobileWarningModal();