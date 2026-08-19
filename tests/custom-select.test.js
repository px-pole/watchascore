import { describe, it, expect } from "vitest";
import {
  syncCustomSelectValue,
  setupCustomSelect,
  closeAllCustomSelects,
  openCustomSelect,
} from "../js/core/custom-select.js";

function createCustomSelectFixture() {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="custom-select" data-value="default">
      <span class="custom-select-label">Default</span>
      <button class="custom-select-option focused" data-value="default" aria-selected="true">Default</button>
      <button class="custom-select-option focused" data-value="forest" aria-selected="false">Forest</button>
      <button class="custom-select-option" data-value="light" aria-selected="false">Light</button>
    </div>
  `;
  return root.firstElementChild;
}

describe("syncCustomSelectValue", () => {
  it("updates selected state, label text, and dataset value", () => {
    const sel = createCustomSelectFixture();

    const option = syncCustomSelectValue(sel, "forest");

    expect(option?.dataset.value).toBe("forest");
    expect(sel.dataset.value).toBe("forest");
    expect(sel.querySelector(".custom-select-label")?.textContent).toBe(
      "Forest",
    );
    expect(
      sel
        .querySelector('[data-value="default"]')
        ?.getAttribute("aria-selected"),
    ).toBe("false");
    expect(
      sel.querySelector('[data-value="forest"]')?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("optionally clears focused classes while syncing", () => {
    const sel = createCustomSelectFixture();

    syncCustomSelectValue(sel, "light", { clearFocused: true });

    expect(sel.querySelectorAll(".focused")).toHaveLength(0);
  });

  it("returns null and leaves the select unchanged for unknown values", () => {
    const sel = createCustomSelectFixture();

    expect(syncCustomSelectValue(sel, "unknown")).toBeNull();
    expect(sel.dataset.value).toBe("default");
    expect(sel.querySelector(".custom-select-label")?.textContent).toBe(
      "Default",
    );
  });
});

describe("setupCustomSelect", () => {
  it("applies selected option on click and invokes onSelect callback", () => {
    const sel = createCustomSelectFixture();
    const selectedValues = [];

    setupCustomSelect(sel, {
      onSelect: (value) => selectedValues.push(value),
    });

    const forestOption = sel.querySelector('[data-value="forest"]');
    forestOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(sel.dataset.value).toBe("forest");
    expect(selectedValues).toEqual(["forest"]);
    expect(sel.getAttribute("aria-expanded")).toBe("false");
  });

  it("supports keyboard selection with Enter after ArrowDown focus change", () => {
    const sel = createCustomSelectFixture();
    const selectedValues = [];

    setupCustomSelect(sel, {
      onSelect: (value) => selectedValues.push(value),
    });

    sel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    sel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    sel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(sel.dataset.value).toBe("forest");
    expect(selectedValues).toEqual(["forest"]);
  });
});

describe("closeAllCustomSelects", () => {
  it("closes all currently open custom-select elements", () => {
    const root = document.createElement("div");
    const first = createCustomSelectFixture();
    const second = createCustomSelectFixture();
    root.append(first, second);

    openCustomSelect(first);
    openCustomSelect(second);

    closeAllCustomSelects(root);

    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("false");
    expect(root.querySelectorAll(".focused")).toHaveLength(0);
  });
});
