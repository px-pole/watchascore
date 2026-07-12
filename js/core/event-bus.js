export function createEventBus() {
  return {
    listeners: {},
    // Registers a callback for the given event.
    on(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    },
    // Emits data to every listener registered for the event.
    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((cb) => cb(data));
      }
    }
  };
}
