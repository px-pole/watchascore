import { describe, it, expect, vi, beforeEach } from "vitest";
import { createModalStateManager } from "../js/core/modal-state.js";

function createModalFixture() {
  document.body.innerHTML = `
    <button id="trigger">Open</button>
    <div id="modal" class="modal-overlay" aria-hidden="true">
      <div class="modal-card">
        <button id="close-btn">Close</button>
      </div>
    </div>
  `;

  return {
    trigger: document.getElementById("trigger"),
    modal: document.getElementById("modal"),
    closeButton: document.getElementById("close-btn"),
  };
}

describe("createModalStateManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("opens a modal, marks it active, and focuses the requested control", () => {
    const { trigger, modal, closeButton } = createModalFixture();
    const manager = createModalStateManager();

    trigger.focus();
    manager.open(modal, { initialFocus: closeButton });

    expect(modal.classList.contains("active")).toBe(true);
    expect(modal.getAttribute("aria-hidden")).toBeNull();
    expect(document.activeElement).toBe(closeButton);
    expect(manager.getActiveModal()).toBe(modal);
  });

  it("closes the active modal, runs cleanup, and restores trigger focus", () => {
    const { trigger, modal, closeButton } = createModalFixture();
    const manager = createModalStateManager();
    const onClose = vi.fn();

    trigger.focus();
    manager.open(modal, { initialFocus: closeButton, onClose });
    manager.close();

    expect(modal.classList.contains("active")).toBe(false);
    expect(modal.getAttribute("aria-hidden")).toBe("true");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    expect(manager.getActiveModal()).toBeNull();
  });

  it("is a no-op when asked to close without an active modal", () => {
    const { modal } = createModalFixture();
    const manager = createModalStateManager();

    manager.close();

    expect(modal.classList.contains("active")).toBe(false);
    expect(modal.getAttribute("aria-hidden")).toBe("true");
  });
});
