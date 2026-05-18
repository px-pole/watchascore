/**
 * FALLBACKS & CONSTANTS
 * A default SVG to display when a team badge is missing or fails to load.
 */
const PLACEHOLDER = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSIzNiIgZmlsbD0iIzE1MmE1MCIgc3Ryb2tlPSIjMWUzYTZlIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI0MCIgeT0iNDYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjIiIGZpbGw9IiM3YTk5YzAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj4/PC90ZXh0Pjwvc3ZnPg==`;

/**
 * APP STATE
 * Centralized object tracking the current condition of the scoreboard.
 */
const INITIAL_STATE = {
  homeScore: 0, awayScore: 0,
  clockSec: 0, running: false,
  status: '',
  homeTeam: null, awayTeam: null,
  events: [],
  theme: 'default',
  homeNameOverride: '',
  awayNameOverride: '',
  mode: 'leagues',
  visibilityMode: 'none',
  startTime: null
};

/**
 * CONSTANTS
 */
const EVENT_ICON_MAP = {
  goal: { class: 'fa-futbol', color: '' },
  yellow: { class: 'fa-square', color: 'var(--card-yellow)' },
  red: { class: 'fa-square', color: 'var(--card-red)' }
};

/**
 * STATUS MAPPINGS for display labels
 */
const STATUS_LABELS = { 'HT': 'HALF-TIME', 'FULL-TIME': 'FULL-TIME', 'NOT STARTED': 'NOT STARTED' };

/**
 * THEME LIST for class management
 */
const THEMES = ['emerald', 'crimson', 'forest', 'ocean', 'light', 'midnight', 'amethyst'];

let state = { ...INITIAL_STATE };
let timerInterval = null; // Use a runtime variable instead of state for the interval ID
let ALL_TEAMS = []; // Global array to store all teams for efficient searching
let TEAM_MAP = new Map(); // Fast lookup by ID
const brightnessCache = new Map(); // Cache results of image analysis to avoid redundant canvas operations
const brightnessWorker = new Worker('brightness-worker.js');
const pendingAnalysis = new Map();

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

let pendingLogoSide = null; // Track which side is currently being previewed
let pendingLogoBase64 = null; // Store base64 data during preview

// Reusable offscreen canvas for performance
const analysisCanvas = document.createElement('canvas');
const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
analysisCanvas.width = 40;
analysisCanvas.height = 40;

/**
 * UTILS
 */
const levenshteinDistance = (s1, s2) => {
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  if (s2.length === 0) return s1.length;

  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    let currRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = prevRow[j + 1] + 1;
      const deletions = currRow[j] + 1;
      const substitutions = prevRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currRow.push(Math.min(insertions, deletions, substitutions));
    }
    prevRow = currRow;
  }
  return prevRow[s2.length];
};

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * DOM CACHE
 * Pre-selecting elements to improve performance.
 */
const ui = {};
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
    'copy-obs-btn', 'home-logo-upload', 'away-logo-upload', 'set-clock-btn', 
    'reset-clock-btn', 'reset-scores-btn', 'reset-teams-btn', 'reset-all-btn', 
    'confirm-reset-all-btn', 'confirm-start-time-btn', 'remove-last-event-btn',
    'crop-modal', 'crop-preview-img', 'confirm-crop-btn', 'close-crop-modal-btn',
    'toggle-contact-btn', 'feedback-link', 'status-btn-not-started',
    'clock-min', 'clock-sec'
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

/**
 * Centralized event listener setup to remove inline HTML handlers.
 */
function setupListeners() {
  // Theme, Mode, FX
  ui.themeSelect?.addEventListener('change', (e) => setTheme(e.target.value));
  ui.modeSelect?.addEventListener('change', (e) => changeMode(e.target.value));
  ui.visibilityModeSelect?.addEventListener('change', (e) => setVisibilityMode(e.target.value));
  
  // OBS and Utils
  ui.copyObsBtn?.addEventListener('click', () => copyOBSLink(ui.copyObsBtn));
  ui.toggleContactBtn?.addEventListener('click', toggleContactForm);
  ui.feedbackLink?.addEventListener('click', (e) => { e.preventDefault(); toggleContactForm(); });

  // Score & Teams
  ui.resetScoresBtn?.addEventListener('click', resetScores);
  ui.resetTeamsBtn?.addEventListener('click', resetTeams);
  ui.resetAllBtn?.addEventListener('click', resetAll);
  ui.confirmResetAllBtn?.addEventListener('click', confirmResetAll);
  
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
    searchInput?.addEventListener('click', (e) => filterTeams(side, e.target.value));
    ui[`${side}ClearSearchBtn`]?.addEventListener('click', () => { searchInput.value = ''; filterTeams(side, ''); });
    ui[`${side}NameOverride`]?.addEventListener('input', (e) => overrideName(side, e.target.value));
    ui[`${side}LogoUpload`]?.addEventListener('change', (e) => handleLogoUpload(side, e.target));
  });

  // Clock
  ui.startBtn?.addEventListener('click', toggleClock);
  ui.setClockBtn?.addEventListener('click', setClock);
  ui.resetClockBtn?.addEventListener('click', resetClock);
  ui.confirmStartTimeBtn?.addEventListener('click', confirmStartTime);
  ui.statusBtnNotStarted?.addEventListener('click', showStartTimeModal);
  
  // Clock Validation: Prevent letters and negative numbers
  [ui.clockMin, ui.clockSec].forEach(input => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (['e', 'E', '-', '+', '.'].includes(e.key)) e.preventDefault();
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
  document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }));

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

/**
 * Initialization function called on page load.
 * Restores saved data from localStorage and prepares the UI.
 */
function init() {
  const savedState = localStorage.getItem('scoreboard_state');
  if (savedState) {
    state = { ...INITIAL_STATE, ...JSON.parse(savedState) };
    // Safety: ensure timer doesn't start automatically on refresh
    state.running = false;
  }

  cacheElements();
  prepareTeamData(); // Prepare team data for efficient searching
  syncUI();

  // Set current year in footer
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/**
 * Helper to get the active tournament data based on current mode.
 */
function getActiveSource() {
  return TOURNAMENTS[state.mode];
}

/**
 * Flattens the current data source into a single array of teams,
 * adding the league name to each team object for easier searching and grouping.
 */
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

/**
 * Switches between Club Leagues and World Cup data.
 */
function changeMode(mode) {
  const update = () => {
    state.mode = mode;
    prepareTeamData();
    // Reset selected teams when mode changes to prevent league/group mismatch
    state.homeTeam = null;
    state.awayTeam = null;
    saveState();
    syncUI();
  };

  if (document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }

  // Remove focus to allow keyboard shortcuts to work immediately.
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

/**
 * Debounce utility to limit how often a function is called.
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Internal function to handle the actual search and rendering logic.
 */
const debouncedSearch = debounce((side, text) => {
  const resultsDiv = document.getElementById(side + '-team-results');
  const searchInput = document.getElementById(side + '-team-search');
  const filter = text.toLowerCase().trim();
  const fragment = document.createDocumentFragment();

  if (filter) {
    renderSearchMode(fragment, side, filter, resultsDiv, searchInput);
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
  searchInput.focus();
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
      header.className = 'search-results-header';
      header.textContent = leagueName;
      fragment.appendChild(header);

      teams.forEach(t => {
        const item = document.createElement('div');
        item.className = 'search-results-item';
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
    ALL_TEAMS.forEach(t => { if (!leagues.has(t.league)) leagues.set(t.league, []); leagues.get(t.league).push(t); });

    leagues.forEach((teams, leagueName) => {
      const header = document.createElement('div');
      header.className = 'search-results-header collapsible';
      header.innerHTML = `<span>${leagueName}</span> <i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.6;"></i>`;

      const teamContainer = document.createElement('div');
      teamContainer.className = 'league-items-container';
      header.onclick = (e) => {
        e.stopPropagation();
        const isOpen = teamContainer.classList.toggle('active');
        const icon = header.querySelector('i');
        icon.classList.toggle('fa-chevron-up', isOpen);
        icon.classList.toggle('fa-chevron-down', !isOpen);
      };

      teams.forEach(t => {
        const item = document.createElement('div');
        item.className = 'search-results-item';
        item.innerHTML = `<img src="${t.badge || PLACEHOLDER}" loading="lazy" alt=""> <span>${t.name}</span>`;
        item.onclick = () => { setTeam(side, t.id); resultsDiv.classList.remove('active'); searchInput.value = ''; };
        teamContainer.appendChild(item);
      });

      fragment.appendChild(header);
      fragment.appendChild(teamContainer);
    });
}

/**
 * Entry point for filtering teams.
 */
function filterTeams(side, text) {
  debouncedSearch(side, text);
}

/**
 * Helper to find a team object by ID within the global LEAGUES constant.
 */
function getTeam(id) {
  return TEAM_MAP.get(id);
}

/**
 * Assigns a team to either side and updates UI components.
 */
function setTeam(side, id) {
  const t = getTeam(id);
  state[side + 'Team'] = t ? t : null;
  saveState();
  syncUI();

  // Remove focus from the element (select dropdown or search input) 
  // to allow keyboard shortcuts to work immediately.
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

/**
 * Persists current state to the browser's local storage.
 */
function saveState() {
  try {
    localStorage.setItem('scoreboard_state', JSON.stringify(state));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('Scoreboard: Local storage quota exceeded, state not saved.');
    }
  }
}

/**
 * Updates all DOM elements to match the current 'state' object.
 * This is the single source of truth for the UI.
 */
function syncUI() {
  const wrapper = document.querySelector('.wrapper');
  const bothTeamsPicked = !!(state.homeTeam && state.awayTeam);
  const currentlySelectedClass = wrapper.classList.contains('teams-selected');

  // Use View Transitions API if supported for "smooth go down" effect
  if (bothTeamsPicked !== currentlySelectedClass) {
    if (document.startViewTransition) {
      document.startViewTransition(() => wrapper.classList.toggle('teams-selected', bothTeamsPicked));
    } else {
      wrapper.classList.toggle('teams-selected', bothTeamsPicked);
    }
  }

  ['home', 'away'].forEach(side => {
    const score = state[side + 'Score'];
    const team = state[side + 'Team'];
    const override = state[side + 'NameOverride'];
    const sideKey = capitalize(side);
    const name = override || team?.name || sideKey;

    ui[`score${sideKey}`].textContent = score;
    ui[`ctrl${sideKey}Score`].textContent = score;
    ui[`${side}NameOverride`].value = override ?? '';
    syncTeamNameDisplay(side, name);
  });

  if (ui.themeSelect) ui.themeSelect.value = state.theme;
  if (ui.modeSelect) ui.modeSelect.value = state.mode;
  
  const visMode = state.visibilityMode || 'none';
  if (ui.visibilityModeSelect) ui.visibilityModeSelect.value = visMode;
  
  document.body.classList.remove('visibility-none', 'visibility-glow', 'visibility-contrast');
  document.body.classList.add(`visibility-${visMode}`);

  // Theme Management
  document.body.classList.remove(...THEMES.map(t => `theme-${t}`));
  if (state.theme && state.theme !== 'default') {
    document.body.classList.add(`theme-${state.theme}`);
  }

  // Update Tournament Group Indicator
  if (ui.tournamentGroupDisplay) {
    let groupInfo = '';
    if (state.mode === 'worldcup') {
      const hGroup = state.homeTeam ? state.homeTeam.league : null;
      const aGroup = state.awayTeam ? state.awayTeam.league : null;
      
      if (hGroup && aGroup) {
        groupInfo = (hGroup === aGroup) ? hGroup : `${hGroup} / ${aGroup}`;
      } else {
        groupInfo = hGroup || aGroup || '';
      }
    }
    ui.tournamentGroupDisplay.textContent = groupInfo.toUpperCase();
  }
  
  // Sync Clock Button
  const isRunning = state.running;
  ui.startBtn.textContent = isRunning ? '⏸ Pause' : '▶ Start';
  ui.startBtn.className = isRunning ? 'btn btn-secondary' : 'btn btn-green';

  ['home', 'away'].forEach(side => {
    const team = state[side + 'Team'];
    let badgeSrc = PLACEHOLDER;
    if (team) {
      const freshTeamData = getTeam(team.id);
      badgeSrc = (team.badge?.startsWith('data:')) ? team.badge : (freshTeamData?.badge || PLACEHOLDER);
    }
    setBadge(side, badgeSrc);
  });
  
  renderClock();
  setStatus(state.status);
  renderEvents();
  updateVisibilityHighlight();
}

/**
 * Detects if an image is predominantly dark or light to selectively apply a glow.
 * Samples pixels using a canvas for accurate brightness detection.
 */
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
      // Transfer the buffer to the worker for high performance
      brightnessWorker.postMessage({ imageData: imageData.data.buffer, src: src }, [imageData.data.buffer]);
    } catch (e) {
      img.classList.remove('is-dark', 'is-light');
      pendingAnalysis.delete(src);
    }
  }
  pendingAnalysis.get(src).add(img);
}

/**
 * Highlights the Visibility FX dropdown if a selected badge would benefit from FX
 * but "No FX" is currently selected.
 */
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
  ui.visibilityModeSelect.classList.toggle('suggest-fx', highlight);

  if (ui.fxSuggestionIcon) {
    ui.fxSuggestionIcon.style.display = highlight ? 'block' : 'none';
  }
}

/**
 * Manually updates the visibility enhancement mode (None, Glow, or Contrast).
 */
function setVisibilityMode(mode) {
  state.visibilityMode = mode;
  saveState();
  syncUI();
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

/**
 * Updates all UI elements that display a team's name.
 */
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

/**
 * Updates team badge images with error handling and loading states.
 */
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

    // Prepare transition: hide the image and scale down before loading
    img.style.opacity = '0'; 
    img.style.transform = 'scale(0.92)';
    img.setAttribute('aria-hidden', 'true');

    // Set CORS for external URLs to allow pixel analysis
    const isExternal = targetSrc.startsWith('http');
    if (isExternal) img.crossOrigin = 'anonymous';
    else img.removeAttribute('crossorigin');

    // Immediate display for placeholders to prevent transition flicker and loading delay
    if (targetSrc === PLACEHOLDER) {
      img.src = PLACEHOLDER;
      img.style.opacity = '1';
      img.style.transform = 'scale(1)';
      if (img.getAttribute('aria-hidden') === 'true') {
        img.removeAttribute('aria-hidden');
      }
      if (wrap) {
        wrap.classList.remove('loading');
        wrap.removeAttribute('aria-busy');
      }
      return;
    }

    img.decoding = 'async';

    if (wrap) {
      wrap.classList.add('loading');
      wrap.setAttribute('aria-busy', 'true');
    }

    const finishLoading = () => {
      if (wrap) {
        wrap.classList.remove('loading');
        wrap.removeAttribute('aria-busy');
      }
      requestAnimationFrame(() => {
        img.style.opacity = '1'; img.style.transform = 'scale(1)';
        img.removeAttribute('aria-hidden'); 
        analyzeBrightness(img);
      });
    };

    img.onload = finishLoading;
    img.onerror = () => {
      img.src = PLACEHOLDER;
      img.classList.remove('is-dark', 'is-light');
      img.style.opacity = '1';
      img.style.transform = 'scale(1)';
      img.removeAttribute('aria-hidden');
      if (wrap) {
        wrap.classList.remove('loading');
        wrap.removeAttribute('aria-busy');
      }
    };

    img.src = targetSrc;
    if (img.complete && img.naturalWidth !== 0) {
      finishLoading();
    }
  });
}

/**
 * Handles local file uploads for custom team logos.
 * Converts the image to a Base64 string for persistence in state.
 */
function handleLogoUpload(side, input) {
  const file = input.files[0];
  if (!file) return;

  // Validation: Limit to 2MB to prevent localStorage quota issues and maintain UI performance.
  const MAX_SIZE_MB = 2;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    alert(`The selected image is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please upload a file smaller than ${MAX_SIZE_MB}MB.`);
    input.value = ''; // Reset the input so the same file can be attempted again if resized
    return;
  }

  const label = input.closest('label');
  if (label) label.classList.add('uploading');

  const reader = new FileReader();
  reader.onload = (e) => {
    if (label) label.classList.remove('uploading');
    
    pendingLogoSide = side;
    pendingLogoBase64 = e.target.result;

    // Open Preview Modal
    ui.cropPreviewImg.src = pendingLogoBase64;
    ui.cropModal.classList.add('active');
    input.value = ''; // Reset input so same file can be chosen again
  };
  reader.onerror = () => {
    if (label) label.classList.remove('uploading');
  };
  reader.readAsDataURL(file);
}

/**
 * Finalizes the custom logo upload after user confirmation.
 */
function confirmLogoUpload() {
  if (!pendingLogoSide || !pendingLogoBase64) return;

  if (!state[pendingLogoSide + 'Team']) {
    state[pendingLogoSide + 'Team'] = { id: 'custom-' + pendingLogoSide, name: pendingLogoSide === 'home' ? 'Home' : 'Away' };
  }

  state[pendingLogoSide + 'Team'].badge = pendingLogoBase64;
  setBadge(pendingLogoSide, pendingLogoBase64);
  saveState();
  ui.cropModal.classList.remove('active');
}

/**
 * Handles custom text input to override default team names.
 */
function overrideName(side, val) {
  state[side + 'NameOverride'] = val;
  saveState();
  const sideKey = capitalize(side);
  const name = val || state[side + 'Team']?.name || sideKey;
  
  syncTeamNameDisplay(side, name);
}

/**
 * Increments or decrements score and triggers a visual 'bump' animation.
 */
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
  saveState();
}

/**
 * Resets scores for both teams.
 */
function resetScores() {
  state.homeScore = 0; state.awayScore = 0;
  ['home','away'].forEach(s => {
    const sideKey = capitalize(s);
    const el = ui['score' + sideKey];
    const ctrlEl = ui['ctrl' + sideKey + 'Score'];
    if (el) el.textContent = '0';
    ctrlEl.textContent = '0';
  });
  saveState();
}

/**
 * Resets selected teams for both sides.
 */
function resetTeams() {
  state.homeTeam = null;
  state.awayTeam = null;
  saveState();
  syncUI();
}

/**
 * Helper for formatting time (e.g. 5 becomes "05").
 */
function pad(n) { return String(n).padStart(2,'0'); }

/**
 * Updates the clock display on the scoreboard.
 */
function renderClock() {
  const m = Math.floor(state.clockSec / 60);
  const s = state.clockSec % 60;
  ui.clockDisplay.textContent = pad(m) + ':' + pad(s);
}

/**
 * Manually sets the clock based on user input fields.
 */
function setClock() {
  const m = parseInt(ui.clockMin.value) || 0;
  const s = parseInt(ui.clockSec.value) || 0;
  state.clockSec = m * 60 + s;
  renderClock();
  saveState();
}

/**
 * Starts or stops the match timer.
 */
function toggleClock() {
  if (state.running) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    state.running = false;
    ui.startBtn.textContent = '▶ Start';
    ui.startBtn.className = 'btn btn-green';
  } else {
    if (timerInterval) clearInterval(timerInterval); 
    state.running = true;
    ui.startBtn.textContent = '⏸ Pause';
    ui.startBtn.className = 'btn btn-secondary';
    timerInterval = setInterval(() => {
      state.clockSec++;
      renderClock(); 
      if (state.clockSec % 5 === 0) {
        saveState(); 
      }
    }, 1000);
  }
}

/**
 * Stops the clock and resets time to zero.
 */
function resetClock() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  state.running = false;
  state.clockSec = 0;
  renderClock();
  ui.startBtn.textContent = '▶ Start';
  ui.startBtn.className = 'btn btn-green';
  ui.clockMin.value = 0;
  ui.clockSec.value = 0;
  saveState();
}

/**
 * Manually updates the application theme.
 */
function setTheme(themeName) {
  state.theme = themeName;
  saveState();
  syncUI();
  
  // Remove focus to allow keyboard shortcuts to work immediately.
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

/**
 * Sets the match status (Live, FT, etc.) and highlights the active button.
 */
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
  saveState();
}

/**
 * Adds a match event (Goal/Card) to the timeline.
 * Normalizes text to uppercase and appends minute marks.
 */
function addMatchEvent(side) {
  const icon = ui.eventIcon.value;
  let text = ui.eventText.value.trim();
  
  if (!text) return;

  text = text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  // Automatically add minute sign if input ends with a digit
  if (/\d$/.test(text)) {
    text += "'";
  }

  state.events.push({ side, text, icon });
  syncEventsUI();
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
}

/**
 * Removes a specific event by its array index.
 */
function removeEvent(index) {
  state.events.splice(index, 1);
  syncEventsUI();
}

/**
 * Quickly removes the most recently added event.
 */
function removeLastEvent() {
  if (state.events.length > 0) {
    removeEvent(state.events.length - 1);
  }
}

/**
 * Combined helper for event state persistence and UI update
 */
function syncEventsUI() {
  ui.eventText.value = '';
  renderEvents();
  saveState();
}

/**
 * Renders the event lists for both teams under the score display.
 */
function renderEvents() {
  ui.homeEvents.innerHTML = '';
  ui.awayEvents.innerHTML = '';
  
  state.events.forEach((ev, idx) => {
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

/**
 * Toggles the visibility of the contact form.
 */
function toggleContactForm() {
  const form = document.getElementById('contact-form');
  form.classList.toggle('active');
}

/**
 * Triggers the confirmation modal to wipe all data.
 */
function resetAll() {
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

/**
 * Start Time Modal Functions
 */
function showStartTimeModal() {
  document.getElementById('start-time-modal').classList.add('active');
  document.getElementById('start-time-input').value = state.startTime || '';
}

function closeStartTimeModal() {
  document.getElementById('start-time-modal').classList.remove('active');
}

function confirmStartTime() {
  state.startTime = document.getElementById('start-time-input').value || null;
  setStatus('NOT STARTED');
  closeStartTimeModal();
}

/**
 * Wipes all data from state and local storage, effectively
 * restarting the application from scratch.
 */
function confirmResetAll() {
  closeModal();
  clearInterval(timerInterval); // Stop the clock if it was running
  
  // Reset state to defaults
  state = { ...INITIAL_STATE, theme: state.theme, mode: state.mode }; // Keep theme and mode preference
  
  // Re-prepare team data and repopulate dropdowns for the default mode
  prepareTeamData();

  syncUI();
  saveState();
}

/**
 * Copies the current page URL to the clipboard for use as an OBS Browser Source.
 */
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

// Global click handler to manage popups and clear element focus
document.addEventListener('click', (e) => {
  // 1. Close team search popups when clicking outside their container
  if (!e.target.closest('.search-container')) {
    document.querySelectorAll('.search-results-popup').forEach(p => p.classList.remove('active'));
  }

  // 2. Auto-blur selectors and inputs when clicking away
  // This ensures keyboard shortcuts (H, A, Space) work immediately after interacting with the UI
  const activeEl = document.activeElement;
  const isLocked = activeEl && ['SELECT', 'INPUT', 'TEXTAREA'].includes(activeEl.tagName);
  if (isLocked && !e.target.closest('select') && !e.target.closest('input') && !e.target.closest('textarea')) {
    activeEl.blur();
  }
});

/**
 * KEYBOARD SHORTCUTS
 * Listen for hotkeys to update the board quickly.
 */
document.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);

  if (isInput) return;

  switch(e.code) {
    case 'Space': e.preventDefault(); toggleClock(); break;
    case 'KeyH': changeScore('home', 1); break;
    case 'KeyA': changeScore('away', 1); break;
    case 'KeyX': if(e.shiftKey) resetAll(); break;
    case 'Backspace': removeLastEvent(); break;
  }
});

/**
 * Hides the preloader once all assets (images, fonts, scripts) are fully loaded.
 */
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('preloader-hidden');
    document.body.classList.add('content-loaded');
    // Remove from DOM after transition to free up resources
    setTimeout(() => preloader.remove(), 600);
  }
});

init();