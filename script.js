/**
 * FALLBACKS & CONSTANTS
 * A default SVG to display when a team badge is missing or fails to load.
 */
const PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><circle cx='40' cy='40' r='36' fill='%23152a50' stroke='%231e3a6e' stroke-width='2'/><text x='40' y='46' text-anchor='middle' font-size='22' fill='%237a99c0' font-family='sans-serif'>?</text></svg>`;

/**
 * APP STATE
 * Centralized object tracking the current condition of the scoreboard.
 */
const INITIAL_STATE = {
  homeScore: 0, awayScore: 0,
  clockSec: 0, running: false,
  status: 'NOT STARTED',
  homeTeam: null, awayTeam: null,
  events: [],
  theme: 'default',
  homeNameOverride: '',
  awayNameOverride: ''
};

let state = { ...INITIAL_STATE };
let timerInterval = null; // Use a runtime variable instead of state for the interval ID
let ALL_TEAMS = []; // Global array to store all teams for efficient searching

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
  ui.clockDisplay = document.getElementById('clock-display');
  ui.clockStatusText = document.getElementById('clock-status-text');
  ui.startBtn = document.getElementById('start-btn');
  ui.homeEvents = document.getElementById('home-events');
  ui.awayEvents = document.getElementById('away-events');
  ui.homeTeamSelect = document.getElementById('home-team-select');
  ui.awayTeamSelect = document.getElementById('away-team-select');
  ui.homeName = document.getElementById('home-name');
  ui.awayName = document.getElementById('away-name');
  ui.eventIcon = document.getElementById('event-icon');
  ui.eventText = document.getElementById('event-text');
  ui.homeNameOverride = document.getElementById('home-name-override');
  ui.awayNameOverride = document.getElementById('away-name-override');
  ui.homeTeamSearch = document.getElementById('home-team-search');
  ui.awayTeamSearch = document.getElementById('away-team-search');
  ui.themeSelect = document.getElementById('theme-select');
}

/**
 * Initialization function called on page load.
 * Restores saved data from localStorage and prepares the UI.
 */
function init() {
  const savedState = localStorage.getItem('scoreboard_state');
  if (savedState) {
    state = JSON.parse(savedState);
    // Safety: ensure timer doesn't start automatically on refresh
    state.running = false;
  }

  cacheElements();
  prepareTeamData(); // Prepare team data for efficient searching
  populateTeamSelect('home-team-select');
  populateTeamSelect('away-team-select');
  syncUI();

  // Set current year in footer
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/**
 * Flattens the LEAGUES object into a single array of teams,
 * adding the league name to each team object for easier searching and grouping.
 */
function prepareTeamData() {
  for (const leagueName in LEAGUES) {
    LEAGUES[leagueName].forEach(team => {
      ALL_TEAMS.push({ ...team, league: leagueName });
    });
  }
}

/**
 * Populates the standard dropdown menus with teams grouped by league.
 */
function populateTeamSelect(selectId, filterText = '') {
  const select = document.getElementById(selectId);
  const side = selectId.startsWith('home') ? 'home' : 'away';
  const currentValue = state[side + 'Team'] ? state[side + 'Team'].id : '';
  
  select.innerHTML = `<option value="">— Select ${side.charAt(0).toUpperCase() + side.slice(1)} Team —</option>`;

  const filter = filterText.toLowerCase();
  for (const leagueName in LEAGUES) {
    const teams = LEAGUES[leagueName].filter(t => t.name.toLowerCase().includes(filter));
    if (teams.length > 0) {
      const group = document.createElement('optgroup');
      group.label = leagueName;
      teams.sort((a,b) => a.name.localeCompare(b.name)).forEach(t => {
        const opt = new Option(t.name, t.id);
        if (t.id === currentValue) opt.selected = true;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
  }
}

/**
 * Filters the team list for the searchable autocomplete inputs.
 */
function filterTeams(side, text) {
  const resultsDiv = document.getElementById(side + '-team-results');
  
  if (!text.trim()) {
    resultsDiv.classList.remove('active');
    return;
  }

  // Clear previous results
  resultsDiv.innerHTML = '';
  resultsDiv.classList.add('active');

  let foundCount = 0;
  const filter = text.toLowerCase();
  const searchInput = document.getElementById(side + '-team-search');

  // Use a Map to group filtered teams by league
  const filteredTeamsByLeague = new Map();

  ALL_TEAMS.forEach(team => {
    const teamNameLower = team.name.toLowerCase();
    if (teamNameLower.includes(filter)) {
      if (!filteredTeamsByLeague.has(team.league)) {
        filteredTeamsByLeague.set(team.league, []);
      }
      filteredTeamsByLeague.get(team.league).push(team);
    }
  });

  // Render results grouped by league
  for (const [leagueName, teams] of filteredTeamsByLeague.entries()) {
    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.textContent = leagueName;
    resultsDiv.appendChild(header);

    teams.sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
      const item = document.createElement('div');
      item.className = 'search-results-item';
      // Highlight matched text
      const startIndex = t.name.toLowerCase().indexOf(filter);
      const endIndex = startIndex + filter.length;
      const highlightedName = t.name.substring(0, startIndex) + `<span class="search-highlight">${t.name.substring(startIndex, endIndex)}</span>` + t.name.substring(endIndex);
      item.innerHTML = `<img src="${t.badge || PLACEHOLDER}" loading="lazy" decoding="async"> <span>${highlightedName}</span>`;
      item.onclick = () => {
        setTeam(side, t.id);
        resultsDiv.classList.remove('active');
        searchInput.value = t.name; // Set the input value to the selected team's name
      };
      resultsDiv.appendChild(item);
      foundCount++;
    });
  }

  if (foundCount === 0) {
    resultsDiv.innerHTML = '<div class="search-results-none">No teams matched your search</div>';
  }
}

/**
 * Helper to find a team object by ID within the global LEAGUES constant.
 */
function getTeam(id) {
  // Optimized to search the flattened ALL_TEAMS array
  return ALL_TEAMS.find(team => team.id === id);
}

/**
 * Assigns a team to either side and updates UI components.
 */
function setTeam(side, id) {
  const t = getTeam(id);
  state[side + 'Team'] = t ? t : null;
  saveState();
  syncUI();
}

/**
 * Persists current state to the browser's local storage.
 */
function saveState() {
  localStorage.setItem('scoreboard_state', JSON.stringify(state));
}

/**
 * Updates all DOM elements to match the current 'state' object.
 * This is the single source of truth for the UI.
 */
function syncUI() {
  ui.scoreHome.textContent = state.homeScore;
  ui.scoreAway.textContent = state.awayScore;
  ui.ctrlHomeScore.textContent = state.homeScore;
  ui.ctrlAwayScore.textContent = state.awayScore;

  // Sync Selection Inputs
  ui.homeTeamSelect.value = state.homeTeam ? state.homeTeam.id : '';
  ui.awayTeamSelect.value = state.awayTeam ? state.awayTeam.id : '';
  ui.homeNameOverride.value = state.homeNameOverride || '';
  ui.awayNameOverride.value = state.awayNameOverride || '';
  if (ui.themeSelect) ui.themeSelect.value = state.theme;

  // Update Scoreboard Team Names
  ui.homeName.textContent = state.homeNameOverride || (state.homeTeam ? state.homeTeam.name : 'Home');
  ui.awayName.textContent = state.awayNameOverride || (state.awayTeam ? state.awayTeam.name : 'Away');

  ['home', 'away'].forEach(side => {
    const team = state[side + 'Team'];
    let badgeSrc = PLACEHOLDER;
    
    if (team) {
      const fullTeam = team.id ? getTeam(team.id) : null;
      // Use custom base64 badge if exists, otherwise fallback to league list
      badgeSrc = (team.badge && team.badge.startsWith('data:')) ? team.badge : (fullTeam ? fullTeam.badge : PLACEHOLDER);
    }
    setBadge(side, badgeSrc);
  });
  
  renderClock();
  setStatus(state.status);
  renderEvents();
  applyTheme(state.theme);
}

/**
 * Updates team badge images with error handling and loading states.
 */
function setBadge(side, src) {
  const badgeConfigs = [
    { 
      img: document.getElementById(side + '-badge'), 
      wrap: document.getElementById(side + '-badge-wrap') 
    },
    { 
      img: document.getElementById('mini-' + side + '-badge'), 
      wrap: document.getElementById('mini-' + side + '-badge')?.parentElement 
    }
  ];

  badgeConfigs.forEach(({ img, wrap }) => {
    if (!img) return;

    // Offload image decoding to a background thread to keep the UI smooth
    img.decoding = 'async';

    // Show loading state
    if (wrap) wrap.classList.add('loading');
    img.style.opacity = '0';

    const finishLoading = () => {
      if (wrap) wrap.classList.remove('loading');
      img.style.opacity = '1';
    };

    img.onload = finishLoading;
    img.onerror = function() {
      this.onerror = null;
      this.src = PLACEHOLDER;
      finishLoading();
    };

    img.src = src || PLACEHOLDER;
    
    // Immediate check for cached images
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

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    
    // If no team is selected, create a placeholder object in state
    if (!state[side + 'Team']) {
      state[side + 'Team'] = { id: 'custom-' + side, name: side === 'home' ? 'Home' : 'Away' };
    }
    
    state[side + 'Team'].badge = base64;
    setBadge(side, base64);
    saveState();
  };
  reader.readAsDataURL(file);
}

/**
 * Handles custom text input to override default team names.
 */
function overrideName(side, val) {
  state[side + 'NameOverride'] = val;
  saveState();
  // Sync only the names to avoid full UI re-render on every keystroke
  const sideNameEl = side === 'home' ? ui.homeName : ui.awayName;
  const teamObj = state[side + 'Team'];
  sideNameEl.textContent = val || (teamObj ? teamObj.name : (side === 'home' ? 'Home' : 'Away'));
}

/**
 * Increments or decrements score and triggers a visual 'bump' animation.
 */
function changeScore(side, delta) {
  const key = side + 'Score';
  state[key] = Math.max(0, state[key] + delta);
  const el = side === 'home' ? ui.scoreHome : ui.scoreAway;
  const ctrlEl = side === 'home' ? ui.ctrlHomeScore : ui.ctrlAwayScore;
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
    const el = s === 'home' ? ui.scoreHome : ui.scoreAway;
    const ctrlEl = s === 'home' ? ui.ctrlHomeScore : ui.ctrlAwayScore;
    el.textContent = '0';
    ctrlEl.textContent = '0';
  });
  saveState();
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
  const m = parseInt(document.getElementById('clock-min').value) || 0;
  const s = parseInt(document.getElementById('clock-sec').value) || 0;
  state.clockSec = m * 60 + s;
  renderClock();
  saveState();
}

/**
 * Starts or stops the match timer.
 */
function toggleClock() {
  if (state.running) {
    clearInterval(timerInterval);
    state.running = false;
    ui.startBtn.textContent = '▶ Start';
    ui.startBtn.className = 'btn btn-green';
  } else {
    // No need to clear here as it was handled when 'running' was true
    state.running = true;
    ui.startBtn.textContent = '⏸ Pause';
    ui.startBtn.className = 'btn btn-secondary';
    timerInterval = setInterval(() => {
      state.clockSec++;
      renderClock(); 
      const m = Math.floor(state.clockSec / 60);
      if (state.status === 'LIVE') {
        ui.clockStatusText.textContent = m + "'";
      }
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
  clearInterval(timerInterval);
  state.running = false;
  state.clockSec = 0;
  renderClock();
  ui.startBtn.textContent = '▶ Start';
  ui.startBtn.className = 'btn btn-green';
  document.getElementById('clock-min').value = 0;
  document.getElementById('clock-sec').value = 0;
  saveState();
}

/**
 * Changes the visual theme of the entire application.
 */
function changeTheme(themeName) {
  state.theme = themeName;
  applyTheme(themeName);
  saveState();
}

/**
 * Applies the specific CSS class to the body to trigger theme variable overrides.
 */
function applyTheme(themeName) {
  const body = document.body;
  const newClass = themeName === 'default' ? '' : `theme-${themeName}`;
  
  if (newClass && body.classList.contains(newClass)) return;

  body.classList.forEach(cls => {
    if (cls.startsWith('theme-')) body.classList.remove(cls);
  });

  if (newClass) body.classList.add(newClass);
}

/**
 * Sets the match status (Live, FT, etc.) and highlights the active button.
 */
function setStatus(s) {
  state.status = s;
  ui.clockStatusText.textContent = s;

  const buttons = document.querySelectorAll('.status-btn');
  buttons.forEach(b => {
    const isActive = b.textContent.trim().toUpperCase() === s.toUpperCase() || b.textContent.trim() === s;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive);
  });
  
  if (s === 'FULL-TIME') {
    ui.clockStatusText.textContent = 'FULL-TIME';
  } else if (s === 'HT') {
    ui.clockStatusText.textContent = 'HALF-TIME';
  }
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
  ui.eventText.value = '';
  renderEvents();
  saveState();
}

/**
 * Removes a specific event by its array index.
 */
function removeEvent(index) {
  state.events.splice(index, 1);
  renderEvents();
  saveState();
}

/**
 * Quickly removes the most recently added event.
 */
function removeLastEvent() {
  if (state.events.length > 0) {
    state.events.pop();
    renderEvents();
    saveState();
  }
}

/**
 * Renders the event lists for both teams under the score display.
 */
function renderEvents() {
  ui.homeEvents.innerHTML = '';
  ui.awayEvents.innerHTML = '';
  state.events.forEach((ev, idx) => {
    const iconMap = {
      goal: { class: 'fa-futbol', color: '' },
      yellow: { class: 'fa-square', color: 'var(--card-yellow)' },
      red: { class: 'fa-square', color: 'var(--card-red)' }
    };
    const iconData = iconMap[ev.icon] || iconMap.goal;
    const iconHtml = `<i class="fa-solid ${iconData.class}" style="cursor:default; font-size:10px; ${iconData.color ? 'color:' + iconData.color : ''}" onclick="removeEvent(${idx})"></i>`;

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
 * Wipes all data from state and local storage, effectively
 * restarting the application from scratch.
 */
function confirmResetAll() {
  closeModal();
  clearInterval(timerInterval); // Stop the clock if it was running
  
  // Reset state to defaults
  state = { ...INITIAL_STATE, theme: state.theme }; // Keep theme preference
  
  syncUI();
  localStorage.removeItem('scoreboard_state');
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

// Close search popups when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    document.querySelectorAll('.search-results-popup').forEach(p => p.classList.remove('active'));
  }
});

/**
 * KEYBOARD SHORTCUTS
 * Listen for hotkeys to update the board quickly.
 */
document.addEventListener('keydown', (e) => {
  // Don't trigger if user is typing in an input or textarea
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

  switch(e.code) {
    case 'Space': e.preventDefault(); toggleClock(); break;
    case 'KeyH': changeScore('home', 1); break;
    case 'KeyA': changeScore('away', 1); break;
    case 'KeyR': if(e.shiftKey) resetAll(); break;
    case 'Backspace': removeLastEvent(); break;
  }
});

init();