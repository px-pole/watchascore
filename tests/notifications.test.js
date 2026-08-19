import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createNotificationManager } from "../js/core/notifications.js";

describe("createNotificationManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a toast message in the DOM", () => {
    const manager = createNotificationManager({ containerId: "toast-stack" });

    manager.show("Scores reset");

    const toast = document.querySelector(".toast");
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain("Scores reset");
  });

  it("removes the toast after its duration expires", () => {
    const manager = createNotificationManager({ containerId: "toast-stack" });

    manager.show("Logo updated", { duration: 400 });
    expect(document.querySelector(".toast")).toBeTruthy();

    vi.advanceTimersByTime(620);
    expect(document.querySelector(".toast")).toBeNull();
  });
});
