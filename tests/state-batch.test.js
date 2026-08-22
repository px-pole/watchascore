import { describe, it, expect, vi } from "vitest";
import { createStateBatchManager } from "../js/core/state-batch.js";
import {
  normalizeStateValue,
  shouldIgnoreGlobalShortcut,
} from "../js/utils/helpers.js";

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

  it("normalizes risky state values before they are written", () => {
    expect(normalizeStateValue("homeScore", -4)).toBe(0);
    expect(normalizeStateValue("awayScore", "12")).toBe(12);
    expect(normalizeStateValue("status", "FULL-TIME")).toBe("FULL-TIME");
    expect(normalizeStateValue("homeTeam", null)).toBeNull();
    expect(normalizeStateValue("homeTeam", { id: "abc", name: "A" })).toEqual({
      id: "abc",
      name: "A",
    });
    expect(normalizeStateValue("teamNamesVisible", "yes")).toBe(true);
  });

  it("supports the main scoreboard flow of scoring and starting the clock", () => {
    const save = vi.fn();
    const emit = vi.fn();
    const manager = createStateBatchManager({ save, emit });
    const target = {
      homeScore: 0,
      awayScore: 0,
      clockSec: 0,
      running: false,
      status: "",
    };

    manager.applyBatch(() => {
      target.homeScore = 2;
      manager.recordChange(target, "homeScore", 2);
      target.awayScore = 1;
      manager.recordChange(target, "awayScore", 1);
      target.clockSec = 45;
      manager.recordChange(target, "clockSec", 45);
      target.running = true;
      manager.recordChange(target, "running", true);
    }, target);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(target);
    expect(emit).toHaveBeenCalledTimes(4);
    expect(emit).toHaveBeenNthCalledWith(1, "homeScore", 2);
    expect(emit).toHaveBeenNthCalledWith(2, "awayScore", 1);
    expect(emit).toHaveBeenNthCalledWith(3, "clockSec", 45);
    expect(emit).toHaveBeenNthCalledWith(4, "running", true);
    expect(target).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      clockSec: 45,
      running: true,
    });
  });

  it("ignores global shortcuts when focus is on a button or editable control", () => {
    document.body.innerHTML = `
      <button id="start-btn">Start</button>
      <input id="score-input" value="" />
      <div id="content"></div>
    `;

    const startButton = document.getElementById("start-btn");
    const input = document.getElementById("score-input");
    const content = document.getElementById("content");

    expect(shouldIgnoreGlobalShortcut(startButton)).toBe(true);
    expect(shouldIgnoreGlobalShortcut(input)).toBe(true);
    expect(shouldIgnoreGlobalShortcut(content)).toBe(false);
  });
});
