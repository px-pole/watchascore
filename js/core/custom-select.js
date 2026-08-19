export function syncCustomSelectValue(
  sel,
  value,
  { clearFocused = false } = {},
) {
  if (!sel) return null;

  const options = [...sel.querySelectorAll(".custom-select-option")];
  const option = options.find((candidate) => candidate.dataset.value === value);
  if (!option) return null;

  options.forEach((candidate) => {
    candidate.setAttribute("aria-selected", "false");
    if (clearFocused) candidate.classList.remove("focused");
  });

  option.setAttribute("aria-selected", "true");
  sel.setAttribute("aria-activedescendant", option.id);
  const label = sel.querySelector(".custom-select-label");
  if (label) label.textContent = option.textContent.trim();
  sel.dataset.value = value;

  return option;
}

export function openCustomSelect(sel) {
  if (!sel) return;
  sel.setAttribute("aria-expanded", "true");
  sel
    .querySelectorAll(".custom-select-option")
    .forEach((option) => option.classList.remove("focused"));
  const selected = sel.querySelector('[aria-selected="true"]');
  if (selected) {
    selected.classList.add("focused");
    sel.setAttribute("aria-activedescendant", selected.id);
  }
}

export function closeCustomSelect(sel) {
  if (!sel) return;
  sel.setAttribute("aria-expanded", "false");
  sel.removeAttribute("aria-activedescendant");
  sel
    .querySelectorAll(".custom-select-option")
    .forEach((option) => option.classList.remove("focused"));
}

export function closeAllCustomSelects(root = document) {
  root
    .querySelectorAll('.custom-select[aria-expanded="true"]')
    .forEach((sel) => {
      closeCustomSelect(sel);
    });
}

export function applyCustomSelectOption(sel, value, { onSelect } = {}) {
  const option = syncCustomSelectValue(sel, value, { clearFocused: true });
  if (!option) return null;

  sel.setAttribute("aria-expanded", "false");
  if (typeof onSelect === "function") onSelect(value, sel, option);
  return option;
}

export function setupCustomSelect(
  sel,
  { onSelect, closeOthers = closeAllCustomSelects } = {},
) {
  if (!sel) return () => {};

  const menu = sel.querySelector(".custom-select-menu");
  if (menu) {
    if (!menu.id) menu.id = `${sel.id || "custom-select"}-menu`;
    sel.setAttribute("aria-controls", menu.id);
  }
  sel.querySelectorAll(".custom-select-option").forEach((option, index) => {
    if (!option.id) option.id = `${sel.id || "custom-select"}-option-${index}`;
  });

  const handleClick = (e) => {
    const option = e.target.closest(".custom-select-option");
    if (option) {
      applyCustomSelectOption(sel, option.dataset.value, { onSelect });
      return;
    }

    if (!e.target.closest(".custom-select-menu")) {
      const isOpen = sel.getAttribute("aria-expanded") === "true";
      closeOthers();
      if (!isOpen) openCustomSelect(sel);
    }
  };

  const handleKeydown = (e) => {
    const isOpen = sel.getAttribute("aria-expanded") === "true";
    const options = [...sel.querySelectorAll(".custom-select-option")];
    if (!options.length) return;

    const focusedIdx = options.findIndex((option) =>
      option.classList.contains("focused"),
    );

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        openCustomSelect(sel);
        return;
      }
      if (focusedIdx >= 0) {
        applyCustomSelectOption(sel, options[focusedIdx].dataset.value, {
          onSelect,
        });
      }
      return;
    }

    if (e.key === "Escape") {
      closeOthers();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        openCustomSelect(sel);
        return;
      }

      const next =
        e.key === "ArrowDown"
          ? focusedIdx < options.length - 1
            ? focusedIdx + 1
            : 0
          : focusedIdx > 0
            ? focusedIdx - 1
            : options.length - 1;
      options.forEach((option) => option.classList.remove("focused"));
      options[next].classList.add("focused");
      sel.setAttribute("aria-activedescendant", options[next].id);
    }
  };

  sel.addEventListener("click", handleClick);
  sel.addEventListener("keydown", handleKeydown);

  return () => {
    sel.removeEventListener("click", handleClick);
    sel.removeEventListener("keydown", handleKeydown);
  };
}
