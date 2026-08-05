export function createShellUiManager({
  getUi,
  helpFabSeenKey,
  storage = localStorage,
  isMobileViewport = () => window.matchMedia('(max-width: 820px)').matches
} = {}) {
  function isHelpPanelOpen() {
    return Boolean(getUi().helpPanel?.classList.contains('active'));
  }

  function initHelpAttentionHint() {
    const { helpFab } = getUi();
    if (!helpFab) return;

    const seen = storage.getItem(helpFabSeenKey) === '1';
    if (!seen) helpFab.classList.add('attention');
  }

  function setHelpPanel(open) {
    const ui = getUi();
    if (!ui.helpPanel || !ui.helpFab) return;

    ui.helpPanel.classList.toggle('active', open);
    ui.helpPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    ui.helpFab.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      storage.setItem(helpFabSeenKey, '1');
      ui.helpFab.classList.remove('attention');
      ui.helpCloseBtn?.focus();
      return;
    }

    ui.helpFab.focus();
  }

  function toggleHelpPanel() {
    setHelpPanel(!isHelpPanelOpen());
  }

  function isMobileHeaderViewport() {
    return isMobileViewport();
  }

  function setHeaderMenu(open) {
    const ui = getUi();
    const header = ui.header;
    if (!header || !ui.headerMenuToggle || !ui.headerControls) return;

    const shouldOpen = Boolean(open) && isMobileViewport();
    header.classList.toggle('menu-open', shouldOpen);
    ui.headerMenuToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    ui.headerControls.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  }

  function toggleHeaderMenu() {
    const ui = getUi();
    const header = ui.header;
    if (!header || !isMobileViewport()) return;
    setHeaderMenu(!header.classList.contains('menu-open'));
  }

  function syncHeaderMenuViewportState() {
    const ui = getUi();
    if (!ui.headerControls || !ui.headerMenuToggle) return;

    const header = ui.header;
    if (isMobileViewport()) {
      const isOpen = header?.classList.contains('menu-open');
      ui.headerControls.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      ui.headerMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      return;
    }

    if (header) header.classList.remove('menu-open');
    ui.headerControls.setAttribute('aria-hidden', 'false');
    ui.headerMenuToggle.setAttribute('aria-expanded', 'false');
  }

  return {
    initHelpAttentionHint,
    isHelpPanelOpen,
    setHelpPanel,
    toggleHelpPanel,
    isMobileHeaderViewport,
    setHeaderMenu,
    toggleHeaderMenu,
    syncHeaderMenuViewportState
  };
}