/* ==========================================================================
   0. BROWSER BEHAVIOR FIXES (Execute Immediately)
   ========================================================================== */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

/* ==========================================================================
   1. CONSTANTS & CONFIGURATION
   ========================================================================== */

const PLACEHOLDER = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSIzNiIgZmlsbD0iIzE1MmE1MCIgc3Ryb2tlPSIjMWUzYTZlIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI0MCIgeT0iNDYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjIiIGZpbGw9IiM3YTk5YzAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj4/PC90ZXh0Pjwvc3ZnPg==`;

const EVENT_ICON_MAP = {
  goal: { class: 'fa-futbol', color: '' },
  yellow: { class: 'fa-square', color: 'var(--card-yellow)' },
  red: { class: 'fa-square', color: 'var(--card-red)' }
};

const STATUS_LABELS = { 'HT': 'HALF-TIME', 'FULL-TIME': 'FULL-TIME', 'NOT STARTED': 'NOT STARTED', 'HT ET': 'HALF-TIME (ET)' };
const THEMES = ['emerald', 'crimson', 'forest', 'ocean', 'light', 'midnight', 'amethyst'];

const INITIAL_STATE = {
  homeScore: 0, awayScore: 0,
  clockSec: 0, running: false,
  status: '',
  homeTeam: null, awayTeam: null,
  events: [],
  theme: 'default',
  homeNameOverride: '',
  awayNameOverride: '',
  mode: 'worldcup',
  visibilityMode: 'none',
  startTime: null,
  clockVisible: true
};

/* ==========================================================================
   2. APP STATE & GLOBAL VARIABLES
   ========================================================================== */

const urlParams = new URLSearchParams(window.location.search);
const GAME_ID = urlParams.get('id') || 'default';
const STORAGE_KEY = `scoreboard_state_${GAME_ID}`;
const PREFS_KEY = 'scoreboard_prefs'; // Global key for user preferences (Theme, Mode, etc.)

let state = null;
let ui = {}; // DOM Cache
let timerInterval = null; // Use a runtime variable instead of state for the interval ID

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

/* ==========================================================================
   2.1 PERSISTENCE LAYER
   ========================================================================== */

const Persistence = {
  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Extract global preferences to persist across different game IDs
      const prefs = { 
        theme: data.theme, 
        mode: data.mode, 
        visibilityMode: data.visibilityMode 
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      if (e.name === 'QuotaExceededError') console.error('Persistence: Quota exceeded');
    }
  },

  load() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    const savedPrefs = localStorage.getItem(PREFS_KEY);
    let prefs = {};
    
    try { 
      if (savedPrefs) prefs = JSON.parse(savedPrefs); 
      if (savedState) {
        return { ...INITIAL_STATE, ...JSON.parse(savedState), running: false };
      }
    } catch (e) { console.error('Persistence: Error parsing data', e); }
    
    return { ...INITIAL_STATE, ...prefs };
  }
};

let ALL_TEAMS = []; // Global array to store all teams for efficient searching
let TEAM_MAP = new Map(); // Fast lookup by ID
const brightnessCache = new Map(); // Cache results of image analysis to avoid redundant canvas operations

// Inline Web Worker to handle image processing
const workerCode = `
onmessage = function(e) {
  const { imageData, src } = e.data;
  const data = new Uint8ClampedArray(imageData);
  let colorSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    colorSum += (r * 0.299 + g * 0.587 + b * 0.114);
  }
  const brightness = colorSum / (data.length / 4);
  postMessage({ src, result: brightness < 128 ? 'dark' : 'light' });
};
`;

const blob = new Blob([workerCode], { type: 'application/javascript' });
const brightnessWorker = new Worker(URL.createObjectURL(blob));
brightnessWorker.onerror = (e) => {
  console.warn('WatchaScore: Brightness Worker error:', e.message);
};
const pendingAnalysis = new Map();
let pendingLogoSide = null; // Track which side is currently being previewed
let pendingLogoBase64 = null; // Store base64 data during preview
let modalTriggerElement = null; // Element that had focus before opening a modal

const analysisCanvas = document.createElement('canvas');
const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
analysisCanvas.width = 40; analysisCanvas.height = 40;

/* ==========================================================================
   3. INITIALIZATION & CORE SETUP
   ========================================================================== */

const EventBus = {
  listeners: {},
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
};

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
    'new-match-btn', 'home-logo-upload', 'away-logo-upload', 
    'set-clock-btn', 
    'reset-clock-btn', 'toggle-clock-btn', 'clock-wrap',
    'reset-scores-btn', 'reset-teams-btn', 'reset-all-btn', 
    'confirm-reset-all-btn', 'confirm-start-time-btn', 'remove-last-event-btn', 'clock-min', 'clock-sec',
    'crop-modal', 'crop-preview-img', 'confirm-crop-btn', 'close-crop-modal-btn', 
    'toggle-contact-btn', 'feedback-link', 'status-btn-not-started'
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
  ui.newMatchBtn?.addEventListener('click', () => {
    const newId = Math.random().toString(36).substring(2, 9);
    window.open(`${window.location.origin}${window.location.pathname}?id=${newId}`, '_blank');
  });
  ui.toggleContactBtn?.addEventListener('click', toggleContactForm);
  ui.feedbackLink?.addEventListener('click', (e) => { e.preventDefault(); toggleContactForm(); });

  // Score & Teams
  ui.resetScoresBtn?.addEventListener('click', resetScores);
  ui.resetTeamsBtn?.addEventListener('click', resetTeams);
  ui.resetAllBtn?.addEventListener('click', resetAll);
  ui.confirmResetAllBtn?.addEventListener('click', confirmResetAll);
  
  // Match Events
  ui.addEventHome?.addEventListener('click', () => addMatchEvent('home'));
  ui.addEventAway?.addEventListener('click', () => addMatchEvent('away'));
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
    searchInput?.addEventListener('input', (e) => filterTeams(side, e.target.value));
    searchInput?.addEventListener('keydown', (e) => handleSearchKeyboard(e, side));
    searchInput?.addEventListener('click', (e) => filterTeams(side, e.target.value));
    ui[`${side}ClearSearchBtn`]?.addEventListener('click', () => { searchInput.value = ''; filterTeams(side, ''); });
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

function handleSearchKeyboard(e, side) {
  const resultsDiv = document.getElementById(`${side}-team-results`);
  if (!resultsDiv.classList.contains('active')) return;

  const items = Array.from(resultsDiv.querySelectorAll('.search-results-item, .search-results-header.collapsible'))
    .filter(item => item.offsetHeight > 0); // Check if element has a visible height
  let currentIndex = items.findIndex(item => item.classList.contains('keyboard-focus'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentIndex < items.length - 1) {
      if (currentIndex >= 0) items[currentIndex].classList.remove('keyboard-focus');
      currentIndex++;
      items[currentIndex].classList.add('keyboard-focus');
      items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentIndex > 0) {
      items[currentIndex].classList.remove('keyboard-focus');
      currentIndex--;
      items[currentIndex].classList.add('keyboard-focus');
      items[currentIndex].scrollIntoView({ block: 'nearest' });
    }
  } else if (e.key === 'Enter') {
    if (currentIndex >= 0) {
      e.preventDefault();
      items[currentIndex].click();
    }
  } else if (e.key === 'Escape') {
    resultsDiv.classList.remove('active');
  }
}

// Helper to get the active tournament data based on current mode.
function getActiveSource() {
  return TOURNAMENTS[state.mode];
}

// Flattens the current data source into a single array of teams,
// adding the league name to each team object for easier searching and grouping.
function prepareTeamData() {
  ALL_TEAMS = [];
  TEAM_MAP.clear();
  const source = getActiveSource();

  // Sort leagues and teams during preparation to avoid sorting during every search
  Object.keys(source).sort().forEach(leagueName => {
    const sortedTeams = [...source[leagueName]].sort((a, b) => a.name.localeCompare(b.name));
    sortedTeams.forEach(team => {
      const teamObj = {
        ...team,
        league: leagueName,
        nameLower: team.name.toLowerCase(), // Pre-normalize for faster searching
        idLower: team.id.toLowerCase()
      };
      ALL_TEAMS.push(teamObj);
      TEAM_MAP.set(team.id, teamObj);
    });
  });
}

const debouncedSearch = debounce((side, text) => {
  const resultsDiv = document.getElementById(side + '-team-results');
  const searchInput = document.getElementById(side + '-team-search');
  const filter = text.toLowerCase().trim();
  const fragment = document.createDocumentFragment();

  resultsDiv.setAttribute('role', 'listbox');
  if (filter) {
    renderSearchMode(fragment, side, filter, resultsDiv, searchInput); // resultsDiv and searchInput are not used here, can be removed from args
  } else {
    renderBrowseMode(fragment, side, resultsDiv, searchInput);
  }

  // Add Close Button for mobile UX
  const closeBtn = document.createElement('div');
  closeBtn.className = 'search-results-close';
  closeBtn.innerHTML = '<i class="fa-solid fa-times"></i> Close Selection';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    resultsDiv.classList.remove('active');
  };
  fragment.appendChild(closeBtn);

  resultsDiv.replaceChildren(fragment);
  resultsDiv.classList.add('active');
  searchInput.focus(); // Keep focus on the input
  resultsDiv.scrollTop = 0;
}, 50);

function renderSearchMode(fragment, side, filter, resultsDiv, searchInput) {
    const filteredByLeague = new Map();
    let foundCount = 0;
    let isCapped = false;

    for (const team of ALL_TEAMS) {
      const subMatch = team.nameLower.includes(filter) || team.idLower.includes(filter);
      const fuzzyMatch = !subMatch && filter.length > 3 && 
        team.nameLower.split(' ').some(word => levenshteinDistance(filter, word.substring(0, filter.length)) <= 1);

      if (subMatch || fuzzyMatch) {
        if (!filteredByLeague.has(team.league)) filteredByLeague.set(team.league, []);
        filteredByLeague.get(team.league).push(team);
        if (++foundCount >= 50) { isCapped = true; break; }
      }
    }

    filteredByLeague.forEach((teams, leagueName) => {
      const header = document.createElement('div');
      header.setAttribute('role', 'presentation'); // Purely visual grouping in search mode
      header.className = 'search-results-header';
      header.textContent = leagueName;
      fragment.appendChild(header);

      teams.forEach(t => {
        const item = document.createElement('div');
        item.className = 'search-results-item';
        item.setAttribute('role', 'option'); // ARIA role for list item
        const idx = t.nameLower.indexOf(filter);
        const highlightedName = idx >= 0 
          ? `${t.name.substring(0, idx)}<span class="search-highlight">${t.name.substring(idx, idx + filter.length)}</span>${t.name.substring(idx + filter.length)}`
          : t.name;

        item.innerHTML = `<img src="${t.badge || PLACEHOLDER}" loading="lazy" alt=""> <span>${highlightedName}</span>`;
        item.onclick = () => { setTeam(side, t.id); resultsDiv.classList.remove('active'); searchInput.value = ''; };
        fragment.appendChild(item);
      });
    });

    if (foundCount === 0) {
      const none = document.createElement('div');
      none.className = 'search-results-none empty-state';
      none.setAttribute('aria-live', 'polite'); // Announce no results
      none.innerHTML = `<i class="fa-solid fa-magnifying-glass-question"></i><span>No teams matched your search</span>`;
      fragment.appendChild(none);
    } else if (isCapped) {
      const more = document.createElement('div');
      more.className = 'search-results-none';
      more.style.borderTop = '1px solid var(--border-color)';
      more.textContent = 'Keep typing to narrow results...';
      fragment.appendChild(more);
    }
}

function renderBrowseMode(fragment, side, resultsDiv, searchInput) {
    const leagues = new Map();
    resultsDiv.setAttribute('role', 'listbox');
    ALL_TEAMS.forEach(t => { if (!leagues.has(t.league)) leagues.set(t.league, []); leagues.get(t.league).push(t); });

    leagues.forEach((teams, leagueName) => {
      const header = document.createElement('div');
      header.className = 'search-results-header collapsible';
      const containerId = `league-items-${side}-${leagueName.replace(/\s/g, '-')}`;
      header.tabIndex = 0;
      header.setAttribute('role', 'button'); // Make header a button for accessibility
      header.setAttribute('aria-expanded', 'false'); // Initial state
      header.setAttribute('aria-controls', containerId); // Link to controlled element
      header.innerHTML = `<span>${leagueName}</span> <i class="fa-solid fa-chevron-down"></i>`;

      const teamContainer = document.createElement('div');
      teamContainer.className = 'league-items-container';
      teamContainer.id = containerId;
      const toggleLeague = (e) => {
        e.stopPropagation();
        const isOpen = teamContainer.classList.toggle('active');
        header.setAttribute('aria-expanded', isOpen); // Update ARIA state
      };
      header.onclick = toggleLeague;
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleLeague(e);
        }
      });

      teams.forEach(t => {
        const item = document.createElement('div');
        item.className = 'search-results-item';
        item.setAttribute('role', 'option'); // ARIA role for list item
        item.innerHTML = `<img src="${t.badge || PLACEHOLDER}" loading="lazy" alt=""> <span>${t.name}</span>`;
        item.onclick = () => { setTeam(side, t.id); resultsDiv.classList.remove('active'); searchInput.value = ''; };
        teamContainer.appendChild(item);
      });

      fragment.appendChild(header);
      fragment.appendChild(teamContainer);
    });
}

const filterTeams = (side, text) => debouncedSearch(side, text);
const getTeam = (id) => TEAM_MAP.get(id);

function setTeam(side, id) {
  const t = getTeam(id);
  state[side + 'Team'] = t ? t : null;
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

/* ==========================================================================
   4. UI SYNCHRONIZATION & RENDERING
   ========================================================================== */

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
      displayElement.style.height = 'auto';
      displayElement.style.minHeight = '14px';
    } else {
      displayElement.style.opacity = '0';
      displayElement.style.height = '0';
      displayElement.style.minHeight = '0';
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
  setStatus(state.status);
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

function updateEventsUI(events) {
  const evList = events || state.events;
  if (!ui.homeEvents || !ui.awayEvents) return;
  ui.homeEvents.innerHTML = '';
  ui.awayEvents.innerHTML = '';
  evList.forEach((ev, idx) => {
    const iconData = EVENT_ICON_MAP[ev.icon] || EVENT_ICON_MAP.goal;
    const iconHtml = `<i class="fa-solid ${iconData.class}" style="cursor:pointer; font-size:10px; ${iconData.color ? 'color:' + iconData.color : ''}" data-index="${idx}" title="Click to remove"></i>`;
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = ev.side === 'home' 
      ? `<span>${ev.text}</span> ${iconHtml}`
      : `${iconHtml} <span>${ev.text}</span>`;
    (ev.side === 'home' ? ui.homeEvents : ui.awayEvents).appendChild(item);
  });
}

/* ==========================================================================
   6. MEDIA & IMAGE ANALYSIS
   ========================================================================== */

brightnessWorker.onmessage = function(e) {
  const { src, result } = e.data;
  brightnessCache.set(src, result);
  const imgs = pendingAnalysis.get(src);
  if (imgs) {
    imgs.forEach(img => {
      if (img.src === src) {
        img.classList.add(result === 'dark' ? 'is-dark' : 'is-light');
        img.classList.remove(result === 'dark' ? 'is-light' : 'is-dark');
      }
    });
    pendingAnalysis.delete(src);
    updateVisibilityHighlight();
  }
};

// Detects if an image is predominantly dark or light to selectively apply a glow.
// Samples pixels using a canvas for accurate brightness detection.
function analyzeBrightness(img) {
  const src = img.src;
  if (!img?.complete || img.naturalWidth === 0 || src.includes('data:image/svg+xml')) {
    return;
  }

  // Helper to apply classes and update UI
  if (brightnessCache.has(src)) {
    const result = brightnessCache.get(src);
    img.classList.add(result === 'dark' ? 'is-dark' : 'is-light');
    img.classList.remove(result === 'dark' ? 'is-light' : 'is-dark');
    updateVisibilityHighlight();
    return;
  }

  if (!analysisCtx) return;

  if (!pendingAnalysis.has(src)) {
    pendingAnalysis.set(src, new Set());
    try {
      analysisCtx.clearRect(0, 0, 40, 40);
      analysisCtx.drawImage(img, 0, 0, 40, 40);
      const imageData = analysisCtx.getImageData(0, 0, 40, 40);
      
      // Robust handling: transfer buffer to worker for non-blocking analysis
      brightnessWorker.postMessage({ imageData: imageData.data.buffer, src: src }, [imageData.data.buffer]);
    } catch (e) {
      img.classList.remove('is-dark', 'is-light');
      pendingAnalysis.delete(src);
    }
  }
  pendingAnalysis.get(src).add(img);
}

function setBadge(side, src) {
  const sideKey = capitalize(side);
  const badgeConfigs = [
    { img: ui[side + 'Badge'], wrap: ui[side + 'BadgeWrap'] },
    { img: ui['mini' + sideKey + 'Badge'], wrap: ui['mini' + sideKey + 'BadgeWrap'] }
  ];
  const targetSrc = src || PLACEHOLDER;

  badgeConfigs.forEach(({ img, wrap }) => {
    if (!img || img.dataset.currentSrc === targetSrc) return;
    img.dataset.currentSrc = targetSrc;
    img.classList.remove('is-dark', 'is-light');
    img.style.opacity = '0'; img.style.transform = 'scale(0.92)';
    img.setAttribute('aria-hidden', 'true');

    if (targetSrc.startsWith('http')) img.crossOrigin = 'anonymous';
    else img.removeAttribute('crossorigin');

    if (targetSrc === PLACEHOLDER) {
      img.src = PLACEHOLDER; img.style.opacity = '1'; img.style.transform = 'scale(1)';
      img.removeAttribute('aria-hidden');
      if (wrap) { wrap.classList.remove('loading'); wrap.removeAttribute('aria-busy'); }
      updateVisibilityHighlight();
      return;
    }

    if (wrap) { wrap.classList.add('loading'); wrap.setAttribute('aria-busy', 'true'); }
    const finishLoading = () => {
      if (wrap) { wrap.classList.remove('loading'); wrap.removeAttribute('aria-busy'); }
      requestAnimationFrame(() => {
        img.style.opacity = '1'; img.style.transform = 'scale(1)';
        img.removeAttribute('aria-hidden'); analyzeBrightness(img);
      });
    };
    img.onload = finishLoading;
    img.onerror = () => {
      img.src = PLACEHOLDER; img.style.opacity = '1'; img.style.transform = 'scale(1)';
      img.removeAttribute('aria-hidden');
      if (wrap) { wrap.classList.remove('loading'); wrap.removeAttribute('aria-busy'); }
      updateVisibilityHighlight();
    };
    img.src = targetSrc;
    if (img.complete && img.naturalWidth !== 0) finishLoading();
  });
}

function handleLogoUpload(side, input) {
  const file = input.files[0];
  if (!file) return;
  const MAX_SIZE_MB = 2;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    alert(`The selected image is too large. Please upload a file smaller than ${MAX_SIZE_MB}MB.`);
    input.value = ''; return;
  }
  const label = input.closest('label');
  if (label) label.classList.add('uploading');
  const reader = new FileReader();
  reader.onload = (e) => {
    if (label) label.classList.remove('uploading');
    pendingLogoSide = side; pendingLogoBase64 = e.target.result;
    ui.cropPreviewImg.src = pendingLogoBase64;
    modalTriggerElement = document.activeElement;
    ui.cropModal.classList.add('active');
    const applyBtn = ui.cropModal.querySelector('.btn-primary');
    if (applyBtn) applyBtn.focus();
    input.value = '';
  };
  reader.onerror = () => { if (label) label.classList.remove('uploading'); };
  reader.readAsDataURL(file);
}

function confirmLogoUpload() {
  if (!pendingLogoSide || !pendingLogoBase64) return;
  if (!state[pendingLogoSide + 'Team']) {
    state[pendingLogoSide + 'Team'] = { id: 'custom-' + pendingLogoSide, name: pendingLogoSide === 'home' ? 'Home' : 'Away' };
  }
  state[pendingLogoSide + 'Team'].badge = pendingLogoBase64;
  setBadge(pendingLogoSide, pendingLogoBase64);
  saveState();
  closeActiveModal();
}

/* ==========================================================================
   7. SCORE & MATCH EVENTS
   ========================================================================== */

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
  saveState();
  syncUI();
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

// Updates all UI elements that display a team's name.
function syncTeamNameDisplay(side, name) {
  const sideKey = capitalize(side);
  if (ui[`${side}Name`]) ui[`${side}Name`].textContent = name;
  
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
  saveState();
  const sideKey = capitalize(side);
  const name = normalized || state[side + 'Team']?.name || sideKey;
  
  syncTeamNameDisplay(side, name);
}

// Increments or decrements score and triggers a visual 'bump' animation.
function changeScore(side, delta) {
  const key = side + 'Score';
  state[key] = Math.max(0, state[key] + delta);
  const sideKey = capitalize(side);
  const [el, ctrlEl] = [ui['score' + sideKey], ui['ctrl' + sideKey + 'Score']];
  el.textContent = state[key];
  ctrlEl.textContent = state[key];
  
  // Visual feedback
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
}

function resetScores() {
  state.homeScore = 0; state.awayScore = 0;
  ['home','away'].forEach(s => {
    const sideKey = capitalize(s);
    const el = ui['score' + sideKey];
    const ctrlEl = ui['ctrl' + sideKey + 'Score'];
    if (el) el.textContent = '0';
    ctrlEl.textContent = '0';
  });
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
/* ==========================================================================
   8. CLOCK & TIMER LOGIC
   ========================================================================== */

function renderClock(seconds) {
  const sTotal = seconds !== undefined ? seconds : state.clockSec;
  const m = Math.floor(sTotal / 60), s = sTotal % 60;
  ui.clockDisplay.textContent = pad(m) + ':' + pad(s);
}

function setClock() {
  const m = parseInt(ui.clockMin.value) || 0;
  const s = parseInt(ui.clockSec.value) || 0;
  state.clockSec = m * 60 + s;
  renderClock();
}

function toggleClockVisibility() {
  state.clockVisible = !state.clockVisible;
  updateClockUI();
}

function toggleClock() {
  if (state.running) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    state.running = false;
    updateClockUI();

    // Handle auto-status updates when pausing after key milestones (Regulation & ET)
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
      // If starting from a Half-Time interval, clear the status automatically
      if (state.status === 'HT' || state.status === 'HT ET') {
        setStatus('');
      }

      state.clockSec++;
      renderClock(); 
    }, 1000);
  }
}

function resetClock() {
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

/* ==========================================================================
   9. SETTINGS & PERSISTENCE
   ========================================================================== */

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

function addMatchEvent(side) {
  const icon = ui.eventIcon.value;
  let text = ui.eventText.value.trim();
  if (!text) return;
  text = text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  if (/\d$/.test(text)) text += "'";
  
  // To trigger the proxy, we re-assign the array
  state.events = [...state.events, { side, text, icon }];
  
  ui.eventText.value = '';
  if (document.activeElement?.blur) document.activeElement.blur();
}

function removeEvent(index) { 
  state.events = state.events.filter((_, i) => i !== index);
}

function removeLastEvent() { 
  if (state.events.length > 0) removeEvent(state.events.length - 1); 
}

function toggleContactForm() {
  document.getElementById('contact-form').classList.toggle('active');
}

function resetAll() {
  modalTriggerElement = document.activeElement;
  const modal = document.getElementById('modal-overlay');
  modal.classList.add('active');
  const confirmBtn = modal.querySelector('#confirm-reset-all-btn');
  if (confirmBtn) confirmBtn.focus();
}

function showStartTimeModal() {
  modalTriggerElement = document.activeElement;
  const modal = document.getElementById('start-time-modal');
  modal.classList.add('active');
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
  clearInterval(timerInterval);
  state = createState({ ...INITIAL_STATE, theme: state.theme, mode: state.mode, visibilityMode: state.visibilityMode });
  prepareTeamData();
  syncUI();
  saveState();
}

// Copies the current page URL to the clipboard for use as an OBS Browser Source.
function copyOBSLink(btn) {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    btn.classList.replace('btn-secondary', 'btn-green');
    
    setTimeout(() => {
      btn.innerHTML = originalContent;
      btn.classList.replace('btn-green', 'btn-secondary');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy link: ', err);
  });
}

/* ==========================================================================
   10. UTILITIES & GLOBAL HANDLERS
   ========================================================================== */

const pad = (n) => String(n).padStart(2,'0');
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const levenshteinDistance = (s1, s2) => {
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  if (s2.length === 0) return s1.length;
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    let currRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = prevRow[j + 1] + 1, deletions = currRow[j] + 1;
      const subs = prevRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currRow.push(Math.min(insertions, deletions, subs));
    }
    prevRow = currRow;
  }
  return prevRow[s2.length];
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout); timeout = setTimeout(later, wait);
  };
}

document.addEventListener('click', (e) => {
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

// Hides the preloader once all assets (images, fonts, scripts) are fully loaded.
window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('preloader-hidden');
    document.body.classList.add('content-loaded');
    
    // Ensure scroll is at top after preloader begins to fade
    window.scrollTo(0, 0);
    
    // Remove delays after the entrance animation (approx 1.5s) is done
    setTimeout(() => document.body.classList.add('entrance-finished'), 1500);
    setTimeout(() => preloader.remove(), 700);
  }
});

init();