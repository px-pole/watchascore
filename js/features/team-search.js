export function createTeamSearchManager({
  getState,
  debounce,
  levenshteinDistance,
  placeholder,
  searchResultCap,
  tournaments
}) {
  let allTeams = [];
  const teamMap = new Map();

  function getActiveSource() {
    return tournaments[getState().mode];
  }

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

  function setTeam(side, id) {
    const t = getTeam(id);
    const state = getState();
    state[`${side}Team`] = t || null;
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  }

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
        const item = document.createElement('div');
        item.className = 'search-results-item';
        item.setAttribute('role', 'option');
        item.dataset.teamId = t.id;
        item.id = `team-option-${side}-${t.id}`;
        const idx = t.nameLower.indexOf(filter);
        const highlightedName =
          idx >= 0
            ? `${t.name.substring(0, idx)}<span class="search-highlight">${t.name.substring(idx, idx + filter.length)}</span>${t.name.substring(idx + filter.length)}`
            : t.name;

        item.innerHTML = `<img src="${t.badge || placeholder}" loading="lazy" alt=""> <span>${highlightedName}</span>`;
        item.onclick = () => {
          setTeam(side, t.id);
          resultsDiv.classList.remove('active');
          searchInput.value = '';
        };
        fragment.appendChild(item);
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
      header.onclick = toggleLeague;
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleLeague(e);
        }
      });

      teams.forEach((t) => {
        const item = document.createElement('div');
        item.className = 'search-results-item';
        item.setAttribute('role', 'option');
        item.dataset.teamId = t.id;
        item.id = `team-option-${side}-${t.id}`;
        item.innerHTML = `<img src="${t.badge || placeholder}" loading="lazy" alt=""> <span>${t.name}</span>`;
        item.onclick = () => {
          setTeam(side, t.id);
          resultsDiv.classList.remove('active');
          searchInput.value = '';
        };
        teamContainer.appendChild(item);
      });

      fragment.appendChild(header);
      fragment.appendChild(teamContainer);
    });
  }

  const debouncedSearch = debounce((side, text) => {
    const resultsDiv = document.getElementById(`${side}-team-results`);
    const searchInput = document.getElementById(`${side}-team-search`);
    const filter = text.toLowerCase().trim();
    const fragment = document.createDocumentFragment();

    resultsDiv.setAttribute('role', 'listbox');
    if (filter) {
      renderSearchMode(fragment, side, filter, resultsDiv, searchInput);
    } else {
      renderBrowseMode(fragment, side, resultsDiv, searchInput);
    }

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
    positionSearchPopup(resultsDiv, searchInput);
    searchInput.focus();
    resultsDiv.scrollTop = 0;
  }, 0);

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

  function getTeam(id) {
    return teamMap.get(id);
  }

  function repositionActivePopups(getUi) {
    document.querySelectorAll('.search-results-popup.active').forEach((popup) => {
      const side = popup.id.startsWith('home-') ? 'home' : 'away';
      positionSearchPopup(popup, getUi()[`${side}TeamSearch`]);
    });
  }

  return {
    prepareTeamData,
    handleSearchKeyboard,
    debouncedSearch,
    getTeam,
    setTeam,
    repositionActivePopups
  };
}
