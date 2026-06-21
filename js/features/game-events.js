export function createGameEventsManager({ getState, getUi, eventIconMap, eventTextMaxLength }) {
  function updateEventsUI(events) {
    const state = getState();
    const ui = getUi();
    const evList = events || state.events;
    if (!ui.homeEvents || !ui.awayEvents) return;
    ui.homeEvents.innerHTML = '';
    ui.awayEvents.innerHTML = '';

    evList.forEach((ev, idx) => {
      const iconData = eventIconMap[ev.icon] || eventIconMap.goal;

      const icon = document.createElement('i');
      icon.className = `fa-solid ${iconData.class}`;
      icon.style.cursor = 'pointer';
      icon.style.fontSize = '10px';
      if (iconData.color) icon.style.color = iconData.color;
      icon.dataset.index = idx;
      icon.title = 'Click to remove';

      const textSpan = document.createElement('span');
      textSpan.textContent = ev.text;

      const item = document.createElement('div');
      item.className = 'event-item';
      if (ev.side === 'home') {
        item.append(textSpan, ' ', icon);
      } else {
        item.append(icon, ' ', textSpan);
      }
      (ev.side === 'home' ? ui.homeEvents : ui.awayEvents).appendChild(item);
    });
  }

  function addGameEvent(side) {
    const state = getState();
    const ui = getUi();

    const icon = ui.eventIcon.value;
    let text = ui.eventText.value.trim().slice(0, eventTextMaxLength);
    if (!text) return;
    text = text.toLowerCase().replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toUpperCase());
    if (/\d$/.test(text)) text += "'";

    state.events = [...state.events, { side, text, icon }];

    ui.eventText.value = '';
    if (document.activeElement?.blur) document.activeElement.blur();
  }

  function removeEvent(index) {
    const state = getState();
    state.events = state.events.filter((_, i) => i !== index);
  }

  function removeLastEvent() {
    const state = getState();
    if (state.events.length > 0) removeEvent(state.events.length - 1);
  }

  return {
    updateEventsUI,
    addGameEvent,
    removeEvent,
    removeLastEvent
  };
}
