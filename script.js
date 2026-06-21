import {
  PLACEHOLDER,
  EVENT_ICON_MAP,
  STATUS_LABELS,
  THEMES,
  SEARCH_RESULT_CAP,
  CLOCK_MAX_MINUTES,
  EVENT_TEXT_MAX_LENGTH,
  CANVAS_SAMPLE_SIZE,
  ALLOWED_LOGO_TYPES,
  HELP_FAB_SEEN_KEY,
  INITIAL_STATE
} from './js/config/constants.js';
import { createEventBus } from './js/core/event-bus.js';
import { createPersistence } from './js/core/persistence.js';
import { pad, capitalize, levenshteinDistance, debounce } from './js/utils/helpers.js';
import { createTeamSearchManager } from './js/features/team-search.js';
import { createGameEventsManager } from './js/features/game-events.js';
import { createGameClockManager } from './js/features/game-clock.js';
import { createMediaManager } from './js/features/media.js';
import { TOURNAMENTS } from './teams.js';

// App-level state, storage keys, and reactive state proxy.

const urlParams = new URLSearchParams(window.location.search);
const GAME_ID = urlParams.get('id') || 'default';
const STORAGE_KEY = `scoreboard_state_${GAME_ID}`;
const PREFS_KEY = 'scoreboard_prefs'; // Global key for user preferences (Theme, Mode, etc.)
const Persistence = createPersistence({ storageKey: STORAGE_KEY, prefsKey: PREFS_KEY, initialState: INITIAL_STATE });

let state = null;
let ui = {}; // DOM Cache
let modalTriggerElement = null; // Element that had focus before opening a modal

const stateHandler = {
  set(target, prop, value) {
    if (target[prop] === value) return true;
    target[prop] = value;
    Persistence.save(target);
    EventBus.emit(prop, value);
    return true;
  }
};

const createState = (initialData) => new Proxy(initialData, stateHandler);
const saveState = () => Persistence.save(state);

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
  tournaments: TOURNAMENTS
});

const gameEventsManager = createGameEventsManager({
  getState,
  getUi,
  eventIconMap: EVENT_ICON_MAP,
  eventTextMaxLength: EVENT_TEXT_MAX_LENGTH
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
  saveState,
  closeActiveModal,
  updateVisibilityHighlight,
  setModalTriggerElement: (el) => {
    modalTriggerElement = el;
  },
  getModalTriggerElement: () => modalTriggerElement,
  clearModalTriggerElement: () => {
    modalTriggerElement = null;
  }
});

const {
  prepareTeamData,
  handleSearchKeyboard,
  debouncedSearch,
  getTeam,
  repositionActivePopups
} = teamSearchManager;
const { updateEventsUI, addGameEvent, removeEvent, removeLastEvent } = gameEventsManager;
const { renderClock, setClock, toggleClockVisibility, toggleClock, resetClock, stopTimer } = gameClockManager;
const { setBadge, handleLogoUpload, confirmLogoUpload } = mediaManager;

// App initialization and DOM bindings.

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

  // Timeline
  EventBus.on('events', (val) => updateEventsUI(val));
}

function init() {
  const rawData = Persistence.load();

  // Initialize Subscriptions before the Proxy starts emitting
  setupSubscriptions();

  // Initialize Reactive State
  state = createState(rawData);

  cacheElements();
  prepareTeamData();
  syncUI(); // Initial full render

  if (GAME_ID !== 'default') document.title = `${GAME_ID} - WatchaScore`;
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function cacheElements() {
  ui.scoreHome = document.getElementById('score-home');
  ui.scoreAway = document.getElementById('score-away');
  ui.ctrlHomeScore = document.getElementById('ctrl-home-score');
  ui.ctrlAwayScore = document.getElementById('ctrl-away-score');

  const ids = [
    'clock-display', 'clock-status-text', 'start-btn', 'home-events', 'away-events', 
    'home-clear-search-btn', 'away-clear-search-btn', 'home-name', 'away-name', 
    'event-icon', 'event-text', 'home-name-override', 'away-name-override', 
    'home-team-search', 'away-team-search', 'theme-select', 'mode-select', 
    'tournament-group-display', 'visibility-mode-select', 'add-event-home', 
    'add-event-away', 'fx-suggestion-icon', 'home-badge', 'home-badge-wrap', 
    'mini-home-badge', 'away-badge', 'away-badge-wrap', 'mini-away-badge',
    'new-game-btn', 'home-logo-upload', 'away-logo-upload', 
    'set-clock-btn',
    'reset-clock-btn', 'toggle-clock-btn', 'clock-wrap',
    'reset-scores-btn', 'reset-teams-btn', 'reset-all-btn', 
    'confirm-reset-all-btn', 'confirm-start-time-btn', 'remove-last-event-btn', 'clock-min', 'clock-sec',
    'crop-modal', 'crop-preview-img', 'confirm-crop-btn', 'close-crop-modal-btn', 
    'toggle-contact-btn', 'feedback-link', 'status-btn-not-started',
    'help-fab', 'help-panel', 'help-close-btn',
    'header-menu-toggle', 'header-controls'
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

function setupListeners() {
  // Theme, Mode, FX
  ui.themeSelect?.addEventListener('change', (e) => setTheme(e.target.value));
  ui.modeSelect?.addEventListener('change', (e) => changeMode(e.target.value));
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
  initHelpAttentionHint();

  // Score & Teams
  ui.resetScoresBtn?.addEventListener('click', resetScores);
  ui.resetTeamsBtn?.addEventListener('click', resetTeams);
  ui.resetAllBtn?.addEventListener('click', resetAll);
  ui.confirmResetAllBtn?.addEventListener('click', confirmResetAll);
  
  // Game Events
  ui.addEventHome?.addEventListener('click', () => addGameEvent('home'));
  ui.addEventAway?.addEventListener('click', () => addGameEvent('away'));
  ui.removeLastEventBtn?.addEventListener('click', removeLastEvent);

  // Crop Modal
  ui.confirmCropBtn?.addEventListener('click', confirmLogoUpload);
  ui.closeCropModalBtn?.addEventListener('click', () => ui.cropModal.classList.remove('active'));

  document.querySelectorAll('.btn-plus, .btn-minus').forEach(btn => {
    btn.addEventListener('click', () => changeScore(btn.dataset.side, parseInt(btn.dataset.delta)));
  });

  // Search & Inputs
  ['home', 'away'].forEach(side => {
    const searchInput = ui[`${side}TeamSearch`];
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

  // Ensure Event Type selector blurs after an option is picked
  ui.eventIcon?.addEventListener('change', () => ui.eventIcon.blur());

  // Modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', closeActiveModal));

  // Overlay click to close when clicking outside modal-card
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov) closeActiveModal();
    });
  });

  // Events Timeline Delegation (removes need for inline onclick)
  ['home', 'away'].forEach(side => {
    ui[`${side}Events`]?.addEventListener('click', (e) => {
      const icon = e.target.closest('i');
      if (icon && icon.dataset.index !== undefined) {
        removeEvent(parseInt(icon.dataset.index));
      }
    });
  });
}

// UI synchronization and rendering.

function syncUI() {
  checkWrapperState();
  updateScoreUI();
  updateTeamsUI();
  updateClockUI();
  updateThemeUI();
  updateEventsUI();
  updateVisibilityHighlight();
}

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

function updateScoreUI(side, value) {
  const sides = side ? [side] : ['home', 'away'];
  sides.forEach(s => {
    const sideKey = capitalize(s);
    const score = (side === s && value !== undefined) ? value : state[`${s}Score`];
    if (ui[`score${sideKey}`]) ui[`score${sideKey}`].textContent = score;
    if (ui[`ctrl${sideKey}Score`]) ui[`ctrl${sideKey}Score`].textContent = score;
  });
}

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

// Highlights the Visibility FX dropdown if a selected badge would benefit from FX
// but "No FX" is currently selected.
function updateVisibilityHighlight() {
  if (!ui.visibilityModeSelect) return;
  
  const isNone = state.visibilityMode === 'none';
  const isLightTheme = state.theme === 'light';
  
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

// Manually updates the visibility enhancement mode (None, Glow, or Contrast).
function setVisibilityMode(mode) {
  state.visibilityMode = mode;
  updateVisibilityHighlight();
  document.activeElement?.blur();
}

// Shrinks the font one or two steps if a name can't fit the fixed 2-line slot.
function fitTeamName(el) {
  if (!el) return;
  el.classList.remove('is-long', 'is-xlong');
  // scrollHeight > clientHeight means content overflows the 2-line slot.
  if (el.scrollHeight - el.clientHeight > 2) {
    el.classList.add('is-long');
    void el.offsetHeight; // Force reflow so the reduced font-size is measured before the second check
    if (el.scrollHeight - el.clientHeight > 2) el.classList.add('is-xlong');
  }
}

// Updates all UI elements that display a team's name.
function syncTeamNameDisplay(side, name) {
  const sideKey = capitalize(side);
  const nameEl = ui[`${side}Name`];
  if (nameEl) {
    nameEl.textContent = name;
    nameEl.setAttribute('title', name);
    nameEl.setAttribute('aria-label', name);
    fitTeamName(nameEl);
  }
  
  const eventBtn = ui[`addEvent${sideKey}`];
  if (eventBtn) {
    eventBtn.setAttribute('data-tooltip', name);
    const textSpan = eventBtn.querySelector('span');
    if (textSpan) textSpan.textContent = name;
  }
}

function overrideName(side, val) {
  const normalized = val.trim();
  state[side + 'NameOverride'] = normalized;
  const name = normalized || state[side + 'Team']?.name || capitalize(side);
  syncTeamNameDisplay(side, name);
}

// Increments or decrements score and triggers a visual 'bump' animation.
function changeScore(side, delta) {
  const key = side + 'Score';
  state[key] = Math.max(0, state[key] + delta);
  const el = ui['score' + capitalize(side)];
  if (el) {
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }
}

function resetScores() {
  state.homeScore = 0;
  state.awayScore = 0;
}

function resetTeams() {
  const resetAction = () => {
    const wrapper = document.querySelector('.wrapper');
    if (wrapper) wrapper.classList.toggle('teams-selected', false);
    state.homeTeam = null;
    state.awayTeam = null;
  };

  if (document.startViewTransition) {
    document.startViewTransition(resetAction);
  } else {
    resetAction();
  }

  syncUI();
}
// Settings, help panel, and modal actions.

function changeMode(mode) {
  const update = () => {
    state.mode = mode; 
    state.homeTeam = null; state.awayTeam = null;
  };
  if (document.startViewTransition) document.startViewTransition(update);
  else update();
  if (document.activeElement?.blur) document.activeElement.blur();
}

function setTheme(themeName) {
  const update = () => state.theme = themeName;
  if (document.startViewTransition) document.startViewTransition(update);
  else update();
  if (document.activeElement?.blur) document.activeElement.blur();
}

function setStatus(s) {
  state.status = s;
  renderStatusUI(s);
}

function toggleContactForm() {
  document.getElementById('contact-form').classList.toggle('active');
}

function isHelpPanelOpen() {
  return Boolean(ui.helpPanel?.classList.contains('active'));
}

function initHelpAttentionHint() {
  if (!ui.helpFab) return;

  const seen = localStorage.getItem(HELP_FAB_SEEN_KEY) === '1';
  if (!seen) ui.helpFab.classList.add('attention');
}

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

function toggleHelpPanel() {
  setHelpPanel(!isHelpPanelOpen());
}

function isMobileHeaderViewport() {
  return window.matchMedia('(max-width: 820px)').matches;
}

function setHeaderMenu(open) {
  const header = document.querySelector('header');
  if (!header || !ui.headerMenuToggle || !ui.headerControls) return;

  const shouldOpen = Boolean(open) && isMobileHeaderViewport();
  header.classList.toggle('menu-open', shouldOpen);
  ui.headerMenuToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  ui.headerControls.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
}

function toggleHeaderMenu() {
  const header = document.querySelector('header');
  if (!header || !isMobileHeaderViewport()) return;
  setHeaderMenu(!header.classList.contains('menu-open'));
}

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

function resetAll() {
  modalTriggerElement = document.activeElement;
  const modal = document.getElementById('modal-overlay');
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
  const confirmBtn = modal.querySelector('#confirm-reset-all-btn');
  if (confirmBtn) confirmBtn.focus();
}

function showStartTimeModal() {
  modalTriggerElement = document.activeElement;
  const modal = document.getElementById('start-time-modal');
  modal.classList.add('active');
  modal.removeAttribute('aria-hidden');
  const input = document.getElementById('start-time-input');
  if (input) {
    input.value = state.startTime || '';
    input.focus();
  }
}

function closeActiveModal() {
  const active = document.querySelector('.modal-overlay.active');
  if (active) {
    active.classList.remove('active');
    active.setAttribute('aria-hidden', 'true');
    if (modalTriggerElement) {
      modalTriggerElement.focus();
      modalTriggerElement = null;
    }
  }
}

function confirmStartTime() {
  state.startTime = document.getElementById('start-time-input').value || null;
  setStatus('NOT STARTED');
  closeActiveModal();
}

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

  if (isHelpPanelOpen() && !e.target.closest('.floating-help')) {
    setHelpPanel(false);
  }

  if (!e.target.closest('.search-container')) {
    document.querySelectorAll('.search-results-popup').forEach(p => p.classList.remove('active'));
  }
  const activeEl = document.activeElement;
  const isLocked = activeEl && ['SELECT', 'INPUT', 'TEXTAREA'].includes(activeEl.tagName);
  if (isLocked && !e.target.closest('select') && !e.target.closest('input') && !e.target.closest('textarea')) {
    activeEl.blur();
  }
});

document.addEventListener('keydown', (e) => {
  if (isMobileHeaderViewport() && e.key === 'Escape') {
    const header = document.querySelector('header');
    if (header?.classList.contains('menu-open')) {
      setHeaderMenu(false);
      ui.headerMenuToggle?.focus();
      return;
    }
  }

  if (isHelpPanelOpen() && e.key === 'Escape') {
    setHelpPanel(false);
    return;
  }

  const activeModal = document.querySelector('.modal-overlay.active');

  if (activeModal) {
    if (e.key === 'Escape') {
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

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  switch(e.code) {
    case 'Space': e.preventDefault(); toggleClock(); break;
    case 'KeyH': changeScore('home', 1); break;
    case 'KeyA': changeScore('away', 1); break;
    case 'KeyX': if(e.shiftKey) resetAll(); break;
    case 'KeyV': toggleClockVisibility(); break;
    case 'Backspace': e.preventDefault(); removeLastEvent(); break;
  }
});

// Re-check name fit on resize (e.g. crossing the mobile breakpoint where the
// base font-size changes, or an OBS browser source being resized).
window.addEventListener('resize', debounce(() => {
  ['home', 'away'].forEach(side => fitTeamName(ui[`${side}Name`]));
  repositionActivePopups(() => ui);
  syncHeaderMenuViewportState();
}, 150));

// The display font loads asynchronously; re-measure once it's ready so the
// first fit decision isn't based on fallback-font metrics.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    ['home', 'away'].forEach(side => fitTeamName(ui[`${side}Name`]));
  });
}

// Hides the preloader once all assets (images, fonts, scripts) are fully loaded.
window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('preloader-hidden');
    document.body.classList.add('content-loaded');

    // Remove delays after the entrance animation (approx 1.5s) is done
    setTimeout(() => document.body.classList.add('entrance-finished'), 1500);
    setTimeout(() => preloader.remove(), 700);
  }
});

init();
syncHeaderMenuViewportState();