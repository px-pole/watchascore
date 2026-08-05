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
  const searchVisibleItemLimit = 10;
  const searchPopupBadgeOverrides = new Map([
    ['Sevilla-FC', 'assets/badges/Spain-La-Liga/Sevilla-FC.png']
  ]);
  let allTeams = [];
  let teamsByLeague = [];
  const teamMap = new Map();
  let mirroredLeagueName = '';
  let preparedDataVersion = 0;
  const sideSearchState = {
    home: { navItems: [], currentIndex: -1, lastFilter: null, dataVersion: -1, delegated: false },
    away: { navItems: [], currentIndex: -1, lastFilter: null, dataVersion: -1, delegated: false }
  };

  // Returns the active tournament source for the current mode.
  function getActiveSource() {
    return tournaments[getState().mode];
  }

  // Flattens the current tournament data into searchable team records.
  function prepareTeamData() {
    allTeams = [];
    teamsByLeague = [];
    teamMap.clear();
    const source = getActiveSource();
    const groupedTeams = [];

    Object.keys(source)
      .sort()
      .forEach((leagueName) => {
        const sortedTeams = [...source[leagueName]].sort((a, b) => a.name.localeCompare(b.name));
        const leagueTeams = [];
        sortedTeams.forEach((team) => {
          const nameLower = team.name.toLowerCase();
          const teamObj = {
            ...team,
            league: leagueName,
            nameLower,
            idLower: team.id.toLowerCase(),
            nameWordsLower: nameLower.split(/\s+/).filter(Boolean)
          };
          allTeams.push(teamObj);
          leagueTeams.push(teamObj);
          teamMap.set(team.id, teamObj);
        });
        groupedTeams.push({ leagueName, teams: leagueTeams });
      });

    teamsByLeague = groupedTeams;
    preparedDataVersion += 1;
    ['home', 'away'].forEach((side) => {
      sideSearchState[side].navItems = [];
      sideSearchState[side].currentIndex = -1;
      sideSearchState[side].lastFilter = null;
      sideSearchState[side].dataVersion = -1;
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
    const visibleRows = Array.from(
      resultsDiv.querySelectorAll('.search-results-item, .search-results-header, .search-results-none')
    ).filter((row) => row.getBoundingClientRect().height > 0);
    const estimatedRowHeight = visibleRows.length
      ? Math.max(...visibleRows.slice(0, 3).map((row) => Math.ceil(row.getBoundingClientRect().height)))
      : 34;
    const rowLimitedHeight = estimatedRowHeight * searchVisibleItemLimit + 2;
    const maxPopupHeight = Math.floor(
      Math.max(140, Math.min(availableSpace, viewportHeight * 0.75, rowLimitedHeight))
    );

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
    const side = resultsDiv.id.startsWith('home-') ? 'home' : 'away';
    sideSearchState[side].currentIndex = -1;
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

  // Caches currently visible keyboard-navigable rows for one side.
  function refreshNavigableItems(side, resultsDiv) {
    const navItems = Array.from(resultsDiv.querySelectorAll('.search-results-item, .search-results-header.collapsible')).filter(
      (item) => item.offsetParent !== null
    );
    sideSearchState[side].navItems = navItems;
    sideSearchState[side].currentIndex = navItems.findIndex((item) => item.classList.contains('keyboard-focus'));
  }

  // Opens or closes a league group in browse mode and keeps ARIA state in sync.
  function toggleLeagueHeader(resultsDiv, header) {
    if (!resultsDiv || !header) return;
    const containerId = header.getAttribute('aria-controls');
    const teamContainer = containerId ? document.getElementById(containerId) : null;
    if (!teamContainer) return;

    const wasOpen = teamContainer.classList.contains('active');
    const anchorTop = header.getBoundingClientRect().top;
    const openContainers = Array.from(resultsDiv.querySelectorAll('.league-items-container.active'));
    const switchingGroup = !wasOpen && openContainers.some((container) => container !== teamContainer);

    openContainers.forEach((container) => {
      if (switchingGroup && container !== teamContainer) {
        // Collapse the previously open section instantly to avoid animated list shifting.
        container.style.transition = 'none';
        container.classList.remove('active');
        void container.offsetHeight;
        container.style.transition = '';
        return;
      }
      container.classList.remove('active');
    });
    resultsDiv.querySelectorAll('.search-results-header.collapsible[aria-expanded="true"]').forEach((openHeader) => {
      openHeader.setAttribute('aria-expanded', 'false');
    });

    const isOpen = !wasOpen;
    if (isOpen) teamContainer.classList.add('active');
    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    // Move the selected league title and its team block to the top of the popup.
    if (isOpen) {
      mirroredLeagueName = header.dataset.league || '';
      if (resultsDiv.firstElementChild !== header) {
        resultsDiv.insertBefore(header, resultsDiv.firstElementChild);
        resultsDiv.insertBefore(teamContainer, header.nextSibling);
      }

      const previousBehavior = resultsDiv.style.scrollBehavior;
      resultsDiv.style.scrollBehavior = 'auto';
      resultsDiv.scrollTop = 0;
      requestAnimationFrame(() => {
        resultsDiv.scrollTop = 0;
        resultsDiv.style.scrollBehavior = previousBehavior;
      });

      // Mirror the same opened league in the other search popup.
      const side = resultsDiv.id.startsWith('home-') ? 'home' : 'away';
      const otherSide = side === 'home' ? 'away' : 'home';
      const otherResultsDiv = document.getElementById(`${otherSide}-team-results`);
      const otherSearchInput = document.getElementById(`${otherSide}-team-search`);
      const canMirror =
        otherResultsDiv &&
        otherSearchInput &&
        otherResultsDiv.classList.contains('active') &&
        !otherSearchInput.value.trim();

      if (canMirror) {
        const targetHeader = Array.from(otherResultsDiv.querySelectorAll('.search-results-header.collapsible')).find(
          (candidate) => candidate.dataset.league === mirroredLeagueName
        );
        if (targetHeader) {
          const targetContainerId = targetHeader.getAttribute('aria-controls');
          const targetContainer = targetContainerId ? document.getElementById(targetContainerId) : null;
          if (targetContainer) {
            const openedContainers = Array.from(otherResultsDiv.querySelectorAll('.league-items-container.active'));
            const switchingInOther = openedContainers.some((container) => container !== targetContainer);

            openedContainers.forEach((container) => {
              if (switchingInOther && container !== targetContainer) {
                container.style.transition = 'none';
                container.classList.remove('active');
                void container.offsetHeight;
                container.style.transition = '';
                return;
              }
              container.classList.remove('active');
            });
            otherResultsDiv.querySelectorAll('.search-results-header.collapsible[aria-expanded="true"]').forEach((openHeader) => {
              openHeader.setAttribute('aria-expanded', 'false');
            });

            targetContainer.classList.add('active');
            targetHeader.setAttribute('aria-expanded', 'true');

            if (otherResultsDiv.firstElementChild !== targetHeader) {
              otherResultsDiv.insertBefore(targetHeader, otherResultsDiv.firstElementChild);
              otherResultsDiv.insertBefore(targetContainer, targetHeader.nextSibling);
            }

            const previousOtherBehavior = otherResultsDiv.style.scrollBehavior;
            otherResultsDiv.style.scrollBehavior = 'auto';
            otherResultsDiv.scrollTop = 0;
            requestAnimationFrame(() => {
              otherResultsDiv.scrollTop = 0;
              otherResultsDiv.style.scrollBehavior = previousOtherBehavior;
            });
          }
        }
      }
      return;
    }

    // For close-only actions, keep header from drifting after layout update.
    const keepHeaderAnchored = () => {
      const delta = header.getBoundingClientRect().top - anchorTop;
      if (delta !== 0) resultsDiv.scrollTop += delta;
    };
    keepHeaderAnchored();
    requestAnimationFrame(keepHeaderAnchored);
  }

  // Ensures popup interactions are delegated once per side instead of per item.
  function ensurePopupDelegation(side, resultsDiv, searchInput) {
    const sideState = sideSearchState[side];
    if (!resultsDiv || !searchInput || sideState.delegated) return;

    resultsDiv.addEventListener('click', (e) => {
      const teamItem = e.target.closest('.search-results-item');
      if (teamItem && resultsDiv.contains(teamItem)) {
        setTeam(side, teamItem.dataset.teamId);
        closeResultsPopup(resultsDiv, searchInput);
        searchInput.value = '';
        return;
      }

      const header = e.target.closest('.search-results-header.collapsible');
      if (header && resultsDiv.contains(header)) {
        e.stopPropagation();
        toggleLeagueHeader(resultsDiv, header);
        refreshNavigableItems(side, resultsDiv);
      }
    });

    resultsDiv.addEventListener('keydown', (e) => {
      const header = e.target.closest('.search-results-header.collapsible');
      if (!header || !resultsDiv.contains(header)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggleLeagueHeader(resultsDiv, header);
        refreshNavigableItems(side, resultsDiv);
      }
    });

    sideState.delegated = true;
  }

  // Renders one team option entry for the search popup.
  function renderTeamOption(side, team, resultsDiv, searchInput, highlightedName = team.name) {
    const item = document.createElement('div');
    item.className = 'search-results-item';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');
    item.dataset.teamId = team.id;
    item.id = `team-option-${side}-${team.id}`;
    const badgeSrc = searchPopupBadgeOverrides.get(team.id) || team.badge || placeholder;
    item.innerHTML = `<img src="${badgeSrc}" loading="lazy" alt=""> <span>${highlightedName}</span>`;
    return item;
  }

  // Renders filtered search results grouped by league.
  function renderSearchMode(fragment, side, filter, resultsDiv, searchInput) {
    const filteredByLeague = new Map();
    let foundCount = 0;
    let isCapped = false;
    const directMatches = new Set();

    for (const team of allTeams) {
      const subMatch = team.nameLower.includes(filter) || team.idLower.includes(filter);
      if (subMatch) {
        if (!filteredByLeague.has(team.league)) filteredByLeague.set(team.league, []);
        filteredByLeague.get(team.league).push(team);
        directMatches.add(team.id);
        if (++foundCount >= searchResultCap) {
          isCapped = true;
          break;
        }
      }
    }

    // Run fuzzy matching only if needed after direct matches to avoid heavy work on each keystroke.
    if (!isCapped && filter.length > 3) {
      for (const team of allTeams) {
        if (directMatches.has(team.id)) continue;
        const fuzzyMatch = team.nameWordsLower.some((word) =>
          levenshteinDistance(filter, word.substring(0, filter.length)) <= 1
        );
        if (!fuzzyMatch) continue;

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
    const orderedLeagues = mirroredLeagueName
      ? [
        ...teamsByLeague.filter(({ leagueName }) => leagueName === mirroredLeagueName),
        ...teamsByLeague.filter(({ leagueName }) => leagueName !== mirroredLeagueName)
      ]
      : teamsByLeague;

    orderedLeagues.forEach(({ leagueName, teams }) => {
      const header = document.createElement('div');
      header.className = 'search-results-header collapsible';
      const containerId = `league-items-${side}-${leagueName.replace(/\s/g, '-')}`;
      header.dataset.league = leagueName;
      header.tabIndex = 0;
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('aria-controls', containerId);
      header.innerHTML = `<span>${leagueName}</span> <i class="fa-solid fa-chevron-down"></i>`;

      const teamContainer = document.createElement('div');
      teamContainer.className = 'league-items-container';
      teamContainer.id = containerId;

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
    if (!resultsDiv || !searchInput) return;

    ensurePopupDelegation(side, resultsDiv, searchInput);
    const filter = text.toLowerCase().trim();
    const sideState = sideSearchState[side];

    if (sideState.lastFilter === filter && sideState.dataVersion === preparedDataVersion && resultsDiv.childElementCount > 0) {
      setPopupState(resultsDiv, searchInput, true);
      positionSearchPopup(resultsDiv, searchInput);
      searchInput.focus();
      return;
    }

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
    sideState.lastFilter = filter;
    sideState.dataVersion = preparedDataVersion;
    refreshNavigableItems(side, resultsDiv);
    setPopupState(resultsDiv, searchInput, true);
    positionSearchPopup(resultsDiv, searchInput);
    searchInput.focus();
    resultsDiv.scrollTop = 0;
  }, searchDebounceMs);

  // Handles keyboard navigation inside the active results popup.
  function handleSearchKeyboard(e, side) {
    const resultsDiv = document.getElementById(`${side}-team-results`);
    if (!resultsDiv.classList.contains('active')) return;
    const searchInput = document.getElementById(`${side}-team-search`);
    const sideState = sideSearchState[side];

    if (!sideState.navItems.length) refreshNavigableItems(side, resultsDiv);
    const items = sideState.navItems;
    let currentIndex = sideState.currentIndex;
    if (!items.length) return;

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
          searchInput?.setAttribute('aria-activedescendant', items[currentIndex].id);
        }
        sideState.currentIndex = currentIndex;
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
          searchInput?.setAttribute('aria-activedescendant', items[currentIndex].id);
        }
        sideState.currentIndex = currentIndex;
        items[currentIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      if (currentIndex >= 0) {
        e.preventDefault();
        items[currentIndex].click();
      }
    } else if (e.key === 'Escape') {
      closeResultsPopup(resultsDiv, searchInput);
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
    repositionActivePopups,
    closeAllSearchPopups
  };
}
