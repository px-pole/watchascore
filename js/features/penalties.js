function getPenaltyAttempts(state, side) {
  const attempts = state?.[`${side}Penalties`];
  return Array.isArray(attempts) ? attempts : [];
}

function getPenaltyHistory(state) {
  return Array.isArray(state?.penaltyHistory) ? state.penaltyHistory : [];
}

export function buildPenaltyMarkSlots(state, side, maxVisibleSlots = 5) {
  const attempts = getPenaltyAttempts(state, side);
  const visibleAttempts = attempts.slice(-maxVisibleSlots);
  const orderedSlots = new Array(maxVisibleSlots).fill(null);

  visibleAttempts.forEach((result, index) => {
    const visualIndex = side === "home" ? maxVisibleSlots - 1 - index : index;

    orderedSlots[visualIndex] = {
      result,
      absoluteAttemptNumber:
        attempts.length - visibleAttempts.length + index + 1,
    };
  });

  return orderedSlots.map((slotData, index) => ({
    result: slotData?.result || null,
    slotNumber: side === "away" ? index + 1 : maxVisibleSlots - index,
    absoluteAttemptNumber: slotData?.absoluteAttemptNumber ?? index + 1,
  }));
}

export function getPenaltyScore(state, side) {
  return getPenaltyAttempts(state, side).reduce(
    (total, result) => total + (result === "made" ? 1 : 0),
    0,
  );
}

export function buildPenaltyAttemptUpdate(state, side, result) {
  const attempts = getPenaltyAttempts(state, side);
  const history = getPenaltyHistory(state);

  return {
    [`${side}Penalties`]: [...attempts, result],
    penaltyHistory: [...history, side],
  };
}

export function buildUndoPenaltyUpdate(state, side) {
  const attempts = getPenaltyAttempts(state, side);
  if (!attempts.length) return null;

  const history = getPenaltyHistory(state);
  const historyIndex = history.lastIndexOf(side);
  const nextHistory =
    historyIndex >= 0
      ? [...history.slice(0, historyIndex), ...history.slice(historyIndex + 1)]
      : history;

  return {
    [`${side}Penalties`]: attempts.slice(0, -1),
    penaltyHistory: nextHistory,
  };
}

export function buildUndoLastPenaltyUpdate(state) {
  const history = getPenaltyHistory(state);

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const side = history[index];
    const attempts = getPenaltyAttempts(state, side);
    if (!attempts.length) continue;

    return {
      [`${side}Penalties`]: attempts.slice(0, -1),
      penaltyHistory: history.slice(0, index),
    };
  }

  return (
    buildUndoPenaltyUpdate(state, "away") ||
    buildUndoPenaltyUpdate(state, "home")
  );
}
