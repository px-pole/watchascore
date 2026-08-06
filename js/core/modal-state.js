export function createModalStateManager({ doc = document } = {}) {
	let modalTriggerElement = null;
	let activeModalCleanup = null;

	function getActiveModal() {
		return doc.querySelector(".modal-overlay.active");
	}

	function open(modal, { initialFocus = null, onClose = null } = {}) {
		if (!modal) return;

		modalTriggerElement =
			doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
		activeModalCleanup = typeof onClose === "function" ? onClose : null;
		modal.classList.add("active");
		modal.removeAttribute("aria-hidden");

		const targetFocus =
			initialFocus ||
			modal.querySelector(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
		targetFocus?.focus();
	}

	function close() {
		const active = getActiveModal();
		if (!active) return;

		active.classList.remove("active");
		active.setAttribute("aria-hidden", "true");

		if (activeModalCleanup) {
			const cleanup = activeModalCleanup;
			activeModalCleanup = null;
			cleanup();
		}

		if (modalTriggerElement) {
			modalTriggerElement.focus();
			modalTriggerElement = null;
		}
	}

	return {
		getActiveModal,
		open,
		close,
	};
}
