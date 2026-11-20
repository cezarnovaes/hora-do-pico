import { cleanScenario, isScenario, PRESETS } from './scenarios.js';

const key = 'hora-do-pico:v1';

function emptyState() {
  return { activeId: 'cafe', configs: {}, reference: null };
}

export function loadState(storage) {
  const state = emptyState();
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (PRESETS.some(({ id }) => id === saved?.activeId)) state.activeId = saved.activeId;
    for (const { id } of PRESETS) {
      const candidate = saved?.configs?.[id];
      if (candidate?.id === id && isScenario(candidate)) state.configs[id] = cleanScenario(candidate);
    }
    if (isScenario(saved?.reference)) state.reference = cleanScenario(saved.reference);
  } catch {
    return state;
  }
  return state;
}

export function saveState(storage, state) {
  try {
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
