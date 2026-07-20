export const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSIzNiIgZmlsbD0iIzE1MmE1MCIgc3Ryb2tlPSIjMWUzYTZlIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI0MCIgeT0iNDYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjIiIGZpbGw9IiM3YTk5YzAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj4/PC90ZXh0Pjwvc3ZnPg==';

export const STATUS_LABELS = {
  'HT': 'HALF-TIME',
  'FULL-TIME': 'FULL-TIME',
  'NOT STARTED': 'NOT STARTED',
  'HT ET': 'HALF-TIME (ET)'
};

export const THEMES = ['crimson', 'forest', 'light', 'midnight'];

export const SEARCH_RESULT_CAP = 50;
export const SEARCH_DEBOUNCE_MS = 80;
export const CLOCK_MAX_MINUTES = 999;
export const CANVAS_SAMPLE_SIZE = 40;
export const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
export const HELP_FAB_SEEN_KEY = 'watchascore_help_fab_seen';

export const INITIAL_STATE = {
  homeScore: 0,
  awayScore: 0,
  clockSec: 0,
  running: false,
  status: '',
  homeTeam: null,
  awayTeam: null,
  theme: 'default',
  homeNameOverride: '',
  awayNameOverride: '',
  mode: 'leagues',
  visibilityMode: 'none',
  tournamentTitleOverride: '',
  startTime: null,
  clockVisible: true,
  teamNamesVisible: true
};
