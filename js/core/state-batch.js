export function createStateBatchManager({ save, emit }) {
  let isApplyingBatch = false;
  let pendingChanges = new Map();

  function recordChange(target, prop, value) {
    if (isApplyingBatch) {
      pendingChanges.set(prop, value);
      return true;
    }

    save(target);
    emit(prop, value);
    return false;
  }

  function applyBatch(applyUpdates, target) {
    isApplyingBatch = true;

    try {
      applyUpdates();
    } finally {
      isApplyingBatch = false;
    }

    if (!pendingChanges.size) return;

    save(target);
    pendingChanges.forEach((value, key) => {
      emit(key, value);
    });
    pendingChanges = new Map();
  }

  return {
    recordChange,
    applyBatch
  };
}