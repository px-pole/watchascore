export function createScoreboardUiManager({
	getState,
	getUi,
	capitalize,
	placeholder,
	themes,
	statusLabels,
	syncCustomSelectValue,
	getTeam,
	setBadge,
	syncTeamNameDisplay,
	getPenaltyScore,
	buildPenaltyMarkSlots,
	renderClock,
	runWithViewTransition,
	updateTeamNamesVisibilityUI,
	scheduleObsBackgroundHoleSync,
}) {
	// Retrieves a trimmed string value from state, with optional default.
	function getTrimmedValue(obj, key, defaultValue = "") {
		const val = (obj && obj[key]) || defaultValue;
		return val.trim();
	}

	// Renders the full UI from the current state snapshot.
	function syncUI() {
		checkWrapperState();
		updateScoreUI();
		updatePenaltyUI();
		updateTeamsUI();
		updateClockUI();
		updateThemeUI();
		updateTeamNamesVisibilityUI();
		updateVisibilityHighlight();
		scheduleObsBackgroundHoleSync();
	}

	// Toggles the wrapper class that reflects whether both teams are selected.
	function checkWrapperState() {
		const state = getState();
		const ui = getUi();
		if (!ui.wrapper) return;

		const bothTeamsPicked = !!(state.homeTeam && state.awayTeam);
		const currentlySelectedClass =
			ui.wrapper.classList.contains("teams-selected");

		if (bothTeamsPicked === currentlySelectedClass) return;
		runWithViewTransition(() => {
			ui.wrapper.classList.toggle("teams-selected", bothTeamsPicked);
		});
	}

	// Updates the scoreboard and control panel scores for one or both sides.
	function updateScoreUI(side, value) {
		const state = getState();
		const ui = getUi();
		const sides = side ? [side] : ["home", "away"];

		sides.forEach((currentSide) => {
			const sideKey = capitalize(currentSide);
			const score =
				side === currentSide && value !== undefined
					? value
					: state[`${currentSide}Score`];
			if (ui[`score${sideKey}`]) ui[`score${sideKey}`].textContent = score;
			if (ui[`ctrl${sideKey}Score`])
				ui[`ctrl${sideKey}Score`].textContent = score;
		});
	}

	// Syncs selected teams, overrides, badges, and tournament group text.
	function updateTeamsUI() {
		const state = getState();
		const ui = getUi();
		checkWrapperState();

		["home", "away"].forEach((side) => {
			const team = state[`${side}Team`];
			const override = getTrimmedValue(state, `${side}NameOverride`);
			const name = override || team?.name || capitalize(side);

			if (ui[`${side}NameOverride`]) ui[`${side}NameOverride`].value = override;
			syncTeamNameDisplay(side, name);

			let badgeSrc = placeholder;
			if (team) {
				const freshTeamData = getTeam(team.id);
				badgeSrc = team.badge?.startsWith("data:")
					? team.badge
					: freshTeamData?.badge || placeholder;
			}
			setBadge(side, badgeSrc);
		});

		if (ui.tournamentGroupDisplay) {
			if (ui.tournamentTitleOverride) {
				ui.tournamentTitleOverride.value = state.tournamentTitleOverride || "";
			}

			let groupInfo = "";
			const titleOverride = getTrimmedValue(state, "tournamentTitleOverride");

			if (titleOverride) {
				groupInfo = titleOverride;
			} else {
				const formatLeagueTitle = (label = "") => {
					const separatorIndex = label.indexOf("- ");
					return separatorIndex >= 0
						? label.slice(separatorIndex + 2).trim()
						: label;
				};

				const hGroup = formatLeagueTitle(state.homeTeam?.league || "");
				const aGroup = formatLeagueTitle(state.awayTeam?.league || "");
				if (hGroup && aGroup)
					groupInfo = hGroup === aGroup ? hGroup : `${hGroup} / ${aGroup}`;
				else groupInfo = hGroup || aGroup || "";
			}

			const displayElement = ui.tournamentGroupDisplay;
			displayElement.textContent = groupInfo.toUpperCase();
			displayElement.style.opacity = groupInfo ? "1" : "0";
		}
	}

	// Updates the clock controls and status text to match current timer state.
	function updateClockUI() {
		const state = getState();
		const ui = getUi();

		if (ui.startBtn) {
			ui.startBtn.textContent = state.running ? "⏸ Pause" : "▶ Start";
			ui.startBtn.className = state.running
				? "btn btn-secondary"
				: "btn btn-green";
		}

		if (ui.clockWrap) {
			ui.clockWrap.classList.toggle(
				"is-hidden",
				state.clockVisible === false || state.penaltyMode === true,
			);
		}
		if (ui.toggleClockBtn) {
			if (state.penaltyMode === true) {
				ui.toggleClockBtn.textContent = "Penalty Mode";
				ui.toggleClockBtn.disabled = true;
			} else {
				ui.toggleClockBtn.disabled = false;
				ui.toggleClockBtn.textContent =
					state.clockVisible === false ? "Show" : "Hide";
			}
		}

		syncScoreboardLayoutState();
		renderClock();
		renderStatusUI(state.status);
	}

	// Keeps the scoreboard wrapper on one explicit layout state instead of stacked overrides.
	function syncScoreboardLayoutState() {
		const state = getState();
		const ui = getUi();
		if (!ui.scoreboardWrap) return;

		const penaltyMode = state.penaltyMode === true;
		const teamNamesHidden = state.teamNamesVisible === false;
		const clockHidden = penaltyMode || state.clockVisible === false;
		const layoutClasses = [
			"layout-normal",
			"layout-normal-hidden-names",
			"layout-normal-hidden-clock",
			"layout-normal-hidden-names-clock",
			"layout-penalty",
			"layout-penalty-hidden-names",
		];

		let layoutClass = "layout-normal";
		if (penaltyMode) {
			layoutClass = teamNamesHidden
				? "layout-penalty-hidden-names"
				: "layout-penalty";
		} else if (teamNamesHidden && clockHidden) {
			layoutClass = "layout-normal-hidden-names-clock";
		} else if (clockHidden) {
			layoutClass = "layout-normal-hidden-clock";
		} else if (teamNamesHidden) {
			layoutClass = "layout-normal-hidden-names";
		}

		ui.scoreboardWrap.classList.remove(...layoutClasses);
		ui.scoreboardWrap.classList.add(layoutClass);
	}

	// Updates penalty-mode layout, penalty scores, and visual shot notation.
	function updatePenaltyUI() {
		const state = getState();
		const ui = getUi();
		const penaltyMode = state.penaltyMode === true;
		const homePenaltyScore = getPenaltyScore(state, "home");
		const awayPenaltyScore = getPenaltyScore(state, "away");

		ui.scoreboardWrap?.classList.toggle("penalty-mode", penaltyMode);

		if (ui.togglePenaltyModeBtn) {
			ui.togglePenaltyModeBtn.classList.toggle("active", penaltyMode);
			ui.togglePenaltyModeBtn.setAttribute(
				"aria-pressed",
				penaltyMode ? "true" : "false",
			);
			ui.togglePenaltyModeBtn.innerHTML = penaltyMode
				? '<i class="fa-solid fa-ban"></i> Exit Penalty Mode'
				: '<i class="fa-solid fa-futbol"></i> Enter Penalty Mode';
		}

		if (ui.toggleClockBtn) {
			ui.toggleClockBtn.style.display = penaltyMode ? "none" : "";
			ui.toggleClockBtn.setAttribute(
				"aria-hidden",
				penaltyMode ? "true" : "false",
			);
		}

		if (ui.toggleTeamNamesBtn) {
			ui.toggleTeamNamesBtn.style.display = "";
			ui.toggleTeamNamesBtn.setAttribute("aria-hidden", "false");
		}

		if (ui.penaltyControls) {
			ui.penaltyControls.style.display = penaltyMode ? "" : "none";
			ui.penaltyControls.setAttribute(
				"aria-hidden",
				penaltyMode ? "false" : "true",
			);
		}

		if (ui.normalScoreControls) {
			ui.normalScoreControls.style.display = penaltyMode ? "none" : "";
			ui.normalScoreControls.setAttribute(
				"aria-hidden",
				penaltyMode ? "true" : "false",
			);
		}

		if (ui.penaltyHomeScore) ui.penaltyHomeScore.textContent = homePenaltyScore;
		if (ui.penaltyAwayScore) ui.penaltyAwayScore.textContent = awayPenaltyScore;
		if (ui.ctrlHomePenaltyScore)
			ui.ctrlHomePenaltyScore.textContent = homePenaltyScore;
		if (ui.ctrlAwayPenaltyScore)
			ui.ctrlAwayPenaltyScore.textContent = awayPenaltyScore;

		renderPenaltyMarks("home");
		renderPenaltyMarks("away");

		if (ui.penaltyTracker) {
			ui.penaltyTracker.classList.toggle("is-visible", penaltyMode);
			ui.penaltyTracker.setAttribute(
				"aria-hidden",
				penaltyMode ? "false" : "true",
			);
		}

		if (ui.scoreboardWrap) {
			ui.scoreboardWrap.classList.toggle(
				"penalty-double-digit-home",
				penaltyMode && homePenaltyScore >= 10,
			);
			ui.scoreboardWrap.classList.toggle(
				"penalty-double-digit-away",
				penaltyMode && awayPenaltyScore >= 10,
			);
		}

		requestAnimationFrame(() => {
			syncPenaltyTrackerLane();
			syncPenaltyTightSpace();
		});
		syncScoreboardLayoutState();
	}

	// Anchors penalty marks inside the same lane the clock normally occupies.
	function syncPenaltyTrackerLane() {
		const state = getState();
		const ui = getUi();
		if (!ui.penaltyTracker || !ui.clockWrap) return;

		if (state.penaltyMode !== true) {
			ui.penaltyTracker.style.top = "";
			return;
		}

		const trackerHeight = ui.penaltyTracker.offsetHeight || 22;
		const laneTop = ui.clockWrap.offsetTop;
		const laneHeight = ui.clockWrap.offsetHeight;
		const centeredTop = laneTop + Math.max(0, (laneHeight - trackerHeight) / 2);
		const hiddenNamesOffset = state.teamNamesVisible === false ? -6 : 0;
		ui.penaltyTracker.style.top = `${Math.round(centeredTop + hiddenNamesOffset)}px`;
	}

	// Moves badges outward only when penalty marks would overlap the center lane.
	function syncPenaltyTightSpace() {
		const state = getState();
		const ui = getUi();
		if (!ui.scoreboardWrap) return;

		const penaltyMode = state.penaltyMode === true;
		if (
			!penaltyMode ||
			!ui.penaltyTracker ||
			!ui.homeBadgeWrap ||
			!ui.awayBadgeWrap
		) {
			ui.scoreboardWrap.classList.remove("penalty-tight-space");
			return;
		}

		ui.scoreboardWrap.classList.remove("penalty-tight-space");

		const trackerRect = ui.penaltyTracker.getBoundingClientRect();
		const homeBadgeRect = ui.homeBadgeWrap.getBoundingClientRect();
		const awayBadgeRect = ui.awayBadgeWrap.getBoundingClientRect();
		const guardPx = 6;
		const hasNoSpace =
			trackerRect.left < homeBadgeRect.right + guardPx ||
			trackerRect.right > awayBadgeRect.left - guardPx;

		ui.scoreboardWrap.classList.toggle("penalty-tight-space", hasNoSpace);
	}

	// Renders per-kick notation (scored/missed) for one side.
	function renderPenaltyMarks(side) {
		const state = getState();
		const ui = getUi();
		const marksEl = side === "home" ? ui.penaltyHomeMarks : ui.penaltyAwayMarks;
		if (!marksEl) return;

		const slots = buildPenaltyMarkSlots(state, side);
		marksEl.textContent = "";

		slots.forEach(({ result, slotNumber, absoluteAttemptNumber }) => {
			const slot = document.createElement("span");
			slot.className = "penalty-attempt";
			const mark = document.createElement("span");
			const isMade = result === "made";

			if (!result) {
				mark.className = "penalty-mark is-empty";
				mark.textContent = String(slotNumber);
				mark.setAttribute(
					"aria-label",
					`${capitalize(side)} penalty ${absoluteAttemptNumber}: pending`,
				);
			} else {
				mark.className = `penalty-mark ${isMade ? "is-made" : "is-missed"}`;
				mark.textContent = isMade ? "✓" : "✕";
				mark.setAttribute(
					"aria-label",
					`${capitalize(side)} penalty ${absoluteAttemptNumber}: ${isMade ? "scored" : "missed"}`,
				);
			}

			slot.appendChild(mark);
			marksEl.appendChild(slot);
		});
	}

	// Renders the textual match status label.
	function renderStatusUI(status) {
		const state = getState();
		const ui = getUi();
		let label = statusLabels[status] || status;
		if (status === "NOT STARTED" && state.startTime) {
			label = `KICK OFF ${state.startTime}`;
		}
		if (ui.clockStatusText) ui.clockStatusText.textContent = label;
		ui.statusBtns.forEach((button) => {
			const isActive = button.dataset.status === status;
			button.classList.toggle("active", isActive);
			button.setAttribute("aria-pressed", isActive);
		});
	}

	// Applies theme, mode, and visibility classes to the document root.
	function updateThemeUI() {
		const state = getState();
		const ui = getUi();
		syncCustomSelectValue(ui.themeSelect, state.theme);
		syncCustomSelectValue(ui.modeSelect, state.mode);

		const visMode = state.visibilityMode || "none";
		syncCustomSelectValue(ui.visibilityModeSelect, visMode);

		document.documentElement.classList.remove(
			"visibility-none",
			"visibility-glow",
			"visibility-contrast",
		);
		document.documentElement.classList.add(`visibility-${visMode}`);

		document.documentElement.classList.remove(
			...themes.map((theme) => `theme-${theme}`),
		);
		if (state.theme && state.theme !== "default") {
			document.documentElement.classList.add(`theme-${state.theme}`);
		}
	}

	// Shows or hides the visibility enhancement indicator.
	function updateVisibilityHighlight() {
		const state = getState();
		const ui = getUi();
		if (!ui.visibilityModeSelect) return;

		const isNone = state.visibilityMode === "none";
		const isLightTheme = state.theme === "light";

		// Checks whether a badge needs the visibility enhancement icon.
		const needsFx = (imgEl) => {
			// Ignore if element is missing or it's just the placeholder SVG
			if (!imgEl || (imgEl.src && imgEl.src.includes("PHN2Zy"))) return false;
			// If dark theme, suggest if badge is dark. If light theme, suggest if badge is light.
			return isLightTheme
				? imgEl.classList.contains("is-light")
				: imgEl.classList.contains("is-dark");
		};

		// Check both main and mini badges to ensure the state is captured correctly
		const highlight =
			isNone &&
			(needsFx(ui.homeBadge) ||
				needsFx(ui.awayBadge) ||
				needsFx(ui.miniHomeBadge) ||
				needsFx(ui.miniAwayBadge));

		if (ui.fxSuggestionIcon) {
			ui.fxSuggestionIcon.style.display = highlight ? "block" : "none";
		}
	}

	return {
		syncUI,
		checkWrapperState,
		updateScoreUI,
		updateTeamsUI,
		updateClockUI,
		syncScoreboardLayoutState,
		updatePenaltyUI,
		syncPenaltyTrackerLane,
		syncPenaltyTightSpace,
		renderPenaltyMarks,
		renderStatusUI,
		updateThemeUI,
		updateVisibilityHighlight,
	};
}
