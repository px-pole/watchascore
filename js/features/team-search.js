export function createTeamSearchManager({
  getState,
  debounce,
  levenshteinDistance,
  placeholder,
  searchResultCap,
  searchDebounceMs,
  setSelectedTeam,
  tournaments
}) {
  let allTeams = [];
  const teamMap = new Map();

  // Returns the active tournament source for the current mode.
  function getActiveSource() {
    return tournaments[getState().mode];
  }

  // Flattens the current tournament data into searchable team records.
  function prepareTeamData() {
    allTeams = [];
    teamMap.clear();
    const source = getActiveSource();

    Object.keys(source)
      .sort()
      .forEach((leagueName) => {
        const sortedTeams = [...source[leagueName]].sort((a, b) => a.name.localeCompare(b.name));
        sortedTeams.forEach((team) => {
          const teamObj = {
            ...team,
            league: leagueName,
            nameLower: team.name.toLowerCase(),
            idLower: team.id.toLowerCase()
          };
          allTeams.push(teamObj);
          teamMap.set(team.id, teamObj);
        });
      });
  }

  // Positions the search popup so it stays within the visible viewport.
  function positionSearchPopup(resultsDiv, searchInput) {
    if (!resultsDiv || !searchInput) return;

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const inputRect = searchInput.getBoundingClientRect();
    const edgeGap = 8;
    const minUsefulHeight = 180;

    const spaceBelow = viewportHeight - inputRect.bottom - edgeGap;
    const spaceAbove = inputRect.top - edgeGap;
    const openUp = spaceBelow < minUsefulHeight && spaceAbove > spaceBelow;
    const availableSpace = openUp ? spaceAbove : spaceBelow;
    const maxPopupHeight = Math.floor(Math.max(140, Math.min(availableSpace, viewportHeight * 0.75)));

    resultsDiv.classList.toggle('open-up', openUp);
    resultsDiv.style.maxHeight = `${maxPopupHeight}px`;
  }

  // Stores the selected team and clears focus from the active element.
  function setTeam(side, id) {
    const t = getTeam(id);
    setSelectedTeam(side, t || null);
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }

  // Clears keyboard focus styling from popup options.
  function clearKeyboardFocus(resultsDiv, searchInput) {
    resultsDiv.querySelectorAll('.keyboard-focus').forEach((item) => {
      item.classList.remove('keyboard-focus');
      if (item.hasAttribute('aria-selected')) item.setAttribute('aria-selected', 'false');
    });
    if (searchInput) searchInput.removeAttribute('aria-activedescendant');
  }

  // Updates ARIA state for the popup open or closed state.
  function setPopupState(resultsDiv, searchInput, open) {
    if (!resultsDiv || !searchInput) return;
    resultsDiv.classList.toggle('active', open);
    resultsDiv.setAttribute('aria-hidden', open ? 'false' : 'true');
    searchInput.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (!open) {
      clearKeyboardFocus(resultsDiv, searchInput);
    }
  }

  // Closes the search popup and clears its active selection.
  function closeResultsPopup(resultsDiv, searchInput) {
    setPopupState(resultsDiv, searchInput, false);
  }

  // Renders one team option entry for the search popup.
  function renderTeamOption(side, team, resultsDiv, searchInput, highlightedName = team.name) {
    const item = document.createElement('div');
    item.className = 'search-results-item';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');
    item.dataset.teamId = team.id;
    item.id = `team-option-${side}-${team.id}`;
    item.innerHTML = `<img src="${team.badge || placeholder}" loading="lazy" alt=""> <span>${highlightedName}</span>`;
    item.addEventListener('click', () => {
      setTeam(side, team.id);
      closeResultsPopup(resultsDiv, searchInput);
      searchInput.value = '';
    });
    return item;
  }

  // Renders filtered search results grouped by league.
  function renderSearchMode(fragment, side, filter, resultsDiv, searchInput) {
    const filteredByLeague = new Map();
    let foundCount = 0;
    let isCapped = false;

    for (const team of allTeams) {
      const subMatch = team.nameLower.includes(filter) || team.idLower.includes(filter);
      const fuzzyMatch =
        !subMatch &&
        filter.length > 3 &&
        team.nameLower.split(' ').some((word) => levenshteinDistance(filter, word.substring(0, filter.length)) <= 1);

      if (subMatch || fuzzyMatch) {
        if (!filteredByLeague.has(team.league)) filteredByLeague.set(team.league, []);
        filteredByLeague.get(team.league).push(team);
        if (++foundCount >= searchResultCap) {
          isCapped = true;
          break;
        }
      }
    }

    filteredByLeague.forEach((teams, leagueName) => {
      const header = document.createElement('div');
      header.setAttribute('role', 'presentation');
      header.className = 'search-results-header';
      header.textContent = leagueName;
      fragment.appendChild(header);

      teams.forEach((t) => {
        const idx = t.nameLower.indexOf(filter);
        const highlightedName =
          idx >= 0
            ? `${t.name.substring(0, idx)}<span class="search-highlight">${t.name.substring(idx, idx + filter.length)}</span>${t.name.substring(idx + filter.length)}`
            : t.name;

        fragment.appendChild(renderTeamOption(side, t, resultsDiv, searchInput, highlightedName));
      });
    });

    if (foundCount === 0) {
      const none = document.createElement('div');
      none.className = 'search-results-none empty-state';
      none.setAttribute('aria-live', 'polite');
      none.innerHTML = '<i class="fa-solid fa-magnifying-glass-question"></i><span>No teams matched your search</span>';
      fragment.appendChild(none);
    } else if (isCapped) {
      const more = document.createElement('div');
      more.className = 'search-results-none';
      more.style.borderTop = '1px solid var(--border-color)';
      more.textContent = 'Keep typing to narrow results...';
      fragment.appendChild(more);
    }
  }

  // Renders the browse view with collapsible league groups.
  function renderBrowseMode(fragment, side, resultsDiv, searchInput) {
    const leagues = new Map();
    allTeams.forEach((t) => {
      if (!leagues.has(t.league)) leagues.set(t.league, []);
      leagues.get(t.league).push(t);
    });

    leagues.forEach((teams, leagueName) => {
      const header = document.createElement('div');
      header.className = 'search-results-header collapsible';
      const containerId = `league-items-${side}-${leagueName.replace(/\s/g, '-')}`;
      header.tabIndex = 0;
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('aria-controls', containerId);
      header.innerHTML = `<span>${leagueName}</span> <i class="fa-solid fa-chevron-down"></i>`;

      const teamContainer = document.createElement('div');
      teamContainer.className = 'league-items-container';
      teamContainer.id = containerId;
      const toggleLeague = (e) => {
        e.stopPropagation();
        const isOpen = teamContainer.classList.toggle('active');
        header.setAttribute('aria-expanded', isOpen);
      };
      header.addEventListener('click', toggleLeague);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleLeague(e);
        }
      });

      teams.forEach((t) => {
        teamContainer.appendChild(renderTeamOption(side, t, resultsDiv, searchInput));
      });

      fragment.appendChild(header);
      fragment.appendChild(teamContainer);
    });
  }

  // Debounced entry point that opens the popup and fills it with results.
  const debouncedSearch = debounce((side, text) => {
    const resultsDiv = document.getElementById(`${side}-team-results`);
    const searchInput = document.getElementById(`${side}-team-search`);
    const filter = text.toLowerCase().trim();
    const fragment = document.createDocumentFragment();

    searchInput.setAttribute('aria-autocomplete', 'list');
    resultsDiv.setAttribute('role', 'listbox');
    resultsDiv.setAttribute('aria-labelledby', searchInput.id);
    if (filter) {
      renderSearchMode(fragment, side, filter, resultsDiv, searchInput);
    } else {
      renderBrowseMode(fragment, side, resultsDiv, searchInput);
    }

    resultsDiv.replaceChildren(fragment);
    setPopupState(resultsDiv, searchInput, true);
    positionSearchPopup(resultsDiv, searchInput);
    searchInput.focus();
    resultsDiv.scrollTop = 0;
  }, searchDebounceMs);

  // Handles keyboard navigation inside the active results popup.
  function handleSearchKeyboard(e, side) {
    const resultsDiv = document.getElementById(`${side}-team-results`);
    if (!resultsDiv.classList.contains('active')) return;

    const items = Array.from(resultsDiv.querySelectorAll('.search-results-item, .search-results-header.collapsible')).filter(
      (item) => item.offsetHeight > 0
    );
    let currentIndex = items.findIndex((item) => item.classList.contains('keyboard-focus'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < items.length - 1) {
        if (currentIndex >= 0) {
          items[currentIndex].classList.remove('keyboard-focus');
          if (items[currentIndex].hasAttribute('aria-selected')) items[currentIndex].setAttribute('aria-selected', 'false');
        }
        currentIndex++;
        items[currentIndex].classList.add('keyboard-focus');
        if (items[currentIndex].hasAttribute('aria-selected')) {
          items[currentIndex].setAttribute('aria-selected', 'true');
          document.getElementById(`${side}-team-search`)?.setAttribute('aria-activedescendant', items[currentIndex].id);
        }
        items[currentIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        items[currentIndex].classList.remove('keyboard-focus');
        if (items[currentIndex].hasAttribute('aria-selected')) items[currentIndex].setAttribute('aria-selected', 'false');
        currentIndex--;
        items[currentIndex].classList.add('keyboard-focus');
        if (items[currentIndex].hasAttribute('aria-selected')) {
          items[currentIndex].setAttribute('aria-selected', 'true');
          document.getElementById(`${side}-team-search`)?.setAttribute('aria-activedescendant', items[currentIndex].id);
        }
        items[currentIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      if (currentIndex >= 0) {
        e.preventDefault();
        items[currentIndex].click();
      }
    } else if (e.key === 'Escape') {
      closeResultsPopup(resultsDiv, document.getElementById(`${side}-team-search`));
    }
  }

  // Looks up a team by its identifier.
  function getTeam(id) {
    return teamMap.get(id);
  }

  // Repositions any open search popups after layout changes.
  function repositionActivePopups(getUi) {
    document.querySelectorAll('.search-results-popup.active').forEach((popup) => {
      const side = popup.id.startsWith('home-') ? 'home' : 'away';
      positionSearchPopup(popup, getUi()[`${side}TeamSearch`]);
    });
  }

  // Closes both search popups at once.
  function closeAllSearchPopups() {
    ['home', 'away'].forEach((side) => {
      const resultsDiv = document.getElementById(`${side}-team-results`);
      const searchInput = document.getElementById(`${side}-team-search`);
      if (resultsDiv && searchInput) closeResultsPopup(resultsDiv, searchInput);
    });
  }

  return {
    prepareTeamData,
    handleSearchKeyboard,
    debouncedSearch,
    getTeam,
    setTeam,
    repositionActivePopups,
    closeAllSearchPopups
  };
}
