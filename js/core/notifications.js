export function createNotificationManager({
	containerId = "toast-stack",
	defaultDuration = 2600,
} = {}) {
	let container = null;

	function ensureContainer() {
		if (container) return container;

		container = document.getElementById(containerId);
		if (!container) {
			container = document.createElement("div");
			container.id = containerId;
			container.className = "toast-stack";
			document.body.appendChild(container);
		}
		return container;
	}

	function show(message, { duration = defaultDuration, type = "info" } = {}) {
		const stack = ensureContainer();
		const toast = document.createElement("div");
		toast.className = `toast toast-${type}`;
		toast.setAttribute("role", "status");
		toast.setAttribute("aria-live", "polite");
		toast.textContent = message;

		stack.appendChild(toast);

		window.setTimeout(() => {
			toast.classList.add("is-leaving");
			window.setTimeout(() => toast.remove(), 220);
		}, duration);

		return toast;
	}

	return { show, ensureContainer };
}
