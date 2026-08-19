import { describe, it, expect, vi } from "vitest";
import { createStateBatchManager } from "../js/core/state-batch.js";

describe("createStateBatchManager", () => {
  it("saves and emits immediately for non-batched changes", () => {
    const save = vi.fn();
    const emit = vi.fn();
    const manager = createStateBatchManager({ save, emit });
    const target = { homeScore: 1 };

    expect(manager.recordChange(target, "homeScore", 1)).toBe(false);
    expect(save).toHaveBeenCalledWith(target);
    expect(emit).toHaveBeenCalledWith("homeScore", 1);
  });

  it("defers saves and emits until the batch finishes", () => {
    const save = vi.fn();
    const emit = vi.fn();
    const manager = createStateBatchManager({ save, emit });
    const target = { homeScore: 0, awayScore: 0 };

    manager.applyBatch(() => {
      target.homeScore = 2;
      expect(manager.recordChange(target, "homeScore", 2)).toBe(true);
      target.awayScore = 1;
      expect(manager.recordChange(target, "awayScore", 1)).toBe(true);
    }, target);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(target);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, "homeScore", 2);
    expect(emit).toHaveBeenNthCalledWith(2, "awayScore", 1);
  });

  it("emits only the latest value for a key changed multiple times in one batch", () => {
    const save = vi.fn();
    const emit = vi.fn();
    const manager = createStateBatchManager({ save, emit });
    const target = { homeScore: 0 };

    manager.applyBatch(() => {
      target.homeScore = 1;
      manager.recordChange(target, "homeScore", 1);
      target.homeScore = 2;
      manager.recordChange(target, "homeScore", 2);
    }, target);

    expect(save).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("homeScore", 2);
  });

  it("does nothing when a batch produces no tracked changes", () => {
    const save = vi.fn();
    const emit = vi.fn();
    const manager = createStateBatchManager({ save, emit });
    const target = { homeScore: 0 };

    manager.applyBatch(() => {}, target);

    expect(save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("can skip persistence for selected changes while still emitting them", () => {
    const save = vi.fn();
    const emit = vi.fn();
    const manager = createStateBatchManager({
      save,
      emit,
      shouldSave: (prop) => prop !== "clockSec",
    });
    const target = { clockSec: 12 };

    manager.recordChange(target, "clockSec", 13);

    expect(save).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("clockSec", 13);
  });
});
