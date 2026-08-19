import { describe, it, expect } from "vitest";
import {
  buildPenaltyMarkSlots,
  getPenaltyScore,
  buildPenaltyAttemptUpdate,
  buildUndoPenaltyUpdate,
  buildUndoLastPenaltyUpdate,
} from "../js/features/penalties.js";

describe("penalty state helpers", () => {
  it("counts only made penalties toward the score", () => {
    const state = {
      homePenalties: ["made", "missed", "made"],
    };

    expect(getPenaltyScore(state, "home")).toBe(2);
  });

  it("builds home penalty slots in mirrored visual order", () => {
    const state = {
      homePenalties: ["made", "missed", "made"],
    };

    expect(buildPenaltyMarkSlots(state, "home")).toEqual([
      { result: null, slotNumber: 5, absoluteAttemptNumber: 1 },
      { result: null, slotNumber: 4, absoluteAttemptNumber: 2 },
      { result: "made", slotNumber: 3, absoluteAttemptNumber: 3 },
      { result: "missed", slotNumber: 2, absoluteAttemptNumber: 2 },
      { result: "made", slotNumber: 1, absoluteAttemptNumber: 1 },
    ]);
  });

  it("builds away penalty slots in natural visual order", () => {
    const state = {
      awayPenalties: ["missed", "made"],
    };

    expect(buildPenaltyMarkSlots(state, "away")).toEqual([
      { result: "missed", slotNumber: 1, absoluteAttemptNumber: 1 },
      { result: "made", slotNumber: 2, absoluteAttemptNumber: 2 },
      { result: null, slotNumber: 3, absoluteAttemptNumber: 3 },
      { result: null, slotNumber: 4, absoluteAttemptNumber: 4 },
      { result: null, slotNumber: 5, absoluteAttemptNumber: 5 },
    ]);
  });

  it("builds appended attempts and history for a new penalty", () => {
    const state = {
      homePenalties: ["made"],
      penaltyHistory: ["home"],
    };

    expect(buildPenaltyAttemptUpdate(state, "away", "missed")).toEqual({
      awayPenalties: ["missed"],
      penaltyHistory: ["home", "away"],
    });
  });

  it("removes the latest attempt for one side and trims matching history", () => {
    const state = {
      homePenalties: ["made", "missed"],
      penaltyHistory: ["home", "away", "home"],
    };

    expect(buildUndoPenaltyUpdate(state, "home")).toEqual({
      homePenalties: ["made"],
      penaltyHistory: ["home", "away"],
    });
  });

  it("returns null when undoing a side with no attempts", () => {
    const state = {
      awayPenalties: [],
      penaltyHistory: ["home"],
    };

    expect(buildUndoPenaltyUpdate(state, "away")).toBeNull();
  });

  it("removes the most recent penalty using history order", () => {
    const state = {
      homePenalties: ["made"],
      awayPenalties: ["missed", "made"],
      penaltyHistory: ["home", "away", "away"],
    };

    expect(buildUndoLastPenaltyUpdate(state)).toEqual({
      awayPenalties: ["missed"],
      penaltyHistory: ["home", "away"],
    });
  });

  it("falls back to side-based undo when history is missing", () => {
    const state = {
      homePenalties: ["made"],
      awayPenalties: ["missed"],
    };

    expect(buildUndoLastPenaltyUpdate(state)).toEqual({
      awayPenalties: [],
      penaltyHistory: [],
    });
  });
});
