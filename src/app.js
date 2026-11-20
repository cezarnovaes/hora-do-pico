import '@fontsource-variable/manrope';
import './styles.css';
import { queueChart } from './chart.js';
import { downloadOrders } from './export.js';
import { displayClock, displayDuration, icon } from './format.js';
import { cleanScenario, isScenario, LIMITS, preset } from './scenarios.js';
import { comparableInputs, frameAt, simulate } from './simulation.js';
import { loadState, saveState } from './storage.js';
import { comparisonView, layout, simulationView, stageEditor } from './views.js';

const root = document.querySelector('#app');
root.innerHTML = layout();
const main = root.querySelector('main');
const announcement = root.querySelector('#announcement');
const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const saved = loadState(storage);
const readRoute = () => location.hash === '#comparar' ? 'comparison' : 'simulation';
let route = readRoute();
let config = saved.configs[saved.activeId] ?? preset(saved.activeId);
let draft = structuredClone(config);
let run = simulate(config);
let reference = saved.reference;
let referenceRun = reference ? simulate(reference) : null;
let speed = 1;
let advanced = false;
let time = 0;
let rolling = false;
let animation = 0;
let chart;
let compareTime = 0;
let dragIndex = null;
let announcerTimer = 0;
let previousSecond = -1;

function announce(message) {
  clearTimeout(announcerTimer);
  announcement.textContent = '';
  announcerTimer = setTimeout(() => { announcement.textContent = message; }, 30);
}

function persist(message) {
  const success = saveState(storage, { ...saved, activeId: config.id, reference });
  announce(success ? message : `${message} O navegador bloqueou o armazenamento local.`);
}

function isDirty() {
  return JSON.stringify(draft) !== JSON.stringify(config);
}

function updateDraftStatus() {
  const dirty = isDirty();
  const status = main.querySelector('#draft-status');
  const message = dirty ? 'Mudanças por aplicar' : 'Operação atualizada';
  if (status.textContent !== message) status.textContent = message;
  status.classList.toggle('dirty', dirty);
  main.querySelector('#apply').disabled = !dirty;
}

function render() {
  chart?.dispose();
  chart = null;
  for (const link of root.querySelectorAll('[data-route]')) {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (route === 'simulation') {
    main.innerHTML = simulationView(config, draft, run, speed, advanced);
    chart = queueChart(main.querySelector('#queue-chart'), main.querySelector('#chart-tooltip'), run);
    updateDraftStatus();
    drawPlayback();
  } else {
    const comparable = reference && comparableInputs(config, reference, run, referenceRun);
    main.innerHTML = comparisonView(config, run, reference, referenceRun, comparable, isDirty());
    const canvas = main.querySelector('#compare-chart');
    if (canvas) {
      chart = queueChart(canvas, main.querySelector('#compare-tooltip'), run, referenceRun);
      drawComparison();
    }
  }
}

function drawComparison() {
  const slider = main.querySelector('#compare-timeline');
  const current = frameAt(run.frames, compareTime).queue;
  const before = frameAt(referenceRun.frames, compareTime).queue;
  slider.value = compareTime;
  slider.setAttribute('aria-valuetext', `${displayDuration(compareTime)}, referência ${before}, atual ${current} na fila`);
  main.querySelector('#compare-readout').textContent = `${displayClock(compareTime)} · Referência: ${before} · Atual: ${current}`;
  chart.draw(compareTime);
}

function drawPlayback() {
  if (route !== 'simulation') return;
  const second = Math.floor(time);
  const frame = frameAt(run.frames, second);
  const timeLabel = displayClock(second);
  const state = rolling ? 'Em andamento' : time >= run.end ? 'Turno concluído' : time === 0 ? 'Pronta para iniciar' : 'Pausada';
  const playback = main.querySelector('#playback-state');
  playback.textContent = !rolling || second < run.close ? state : 'Finalizando pedidos';
  playback.classList.toggle('running', rolling);
  main.querySelector('#time').textContent = timeLabel;
  main.querySelector('#arrivals').textContent = frame.arrivals;
  main.querySelector('#completed').textContent = frame.completed;

  const slider = main.querySelector('#timeline');
  slider.value = second;
  slider.style.setProperty('--progress', `${100 * second / run.end}%`);
  slider.setAttribute('aria-valuetext', displayDuration(second));

  const playButton = main.querySelector('[data-action="play"]');
  const label = rolling ? 'Pausar' : time >= run.end ? 'Reproduzir' : time === 0 ? 'Iniciar' : 'Continuar';
  if (playButton.textContent.trim() !== label) {
    playButton.innerHTML = `${icon(rolling ? 'Pause' : 'Play', 17)} ${label}`;
  }

  for (const row of main.querySelectorAll('[data-station]')) {
    const index = Number(row.dataset.station);
    const stage = frame.stages[index];
    const workers = config.stages[index].workers;
    row.classList.toggle('has-queue', stage.waiting > 0);
    row.querySelector('[data-waiting]').textContent = stage.waiting;
    const tickets = stage.orders.slice(0, 5).map((order) => `<i class="ticket size-${order.size}" title="Pedido ${order.id}"></i>`);
    if (stage.waiting > 5) tickets.push(`<span class="extra-tickets">+${stage.waiting - 5}</span>`);
    const ticketsNode = row.querySelector('[data-tickets]');
    const ticketKey = stage.orders.map((order) => order.id).join(',') + '/' + stage.waiting;
    if (ticketsNode.dataset.frame !== ticketKey) {
      ticketsNode.innerHTML = tickets.join('') || '<span class="queue-placeholder"></span>';
      ticketsNode.dataset.frame = ticketKey;
    }
    const active = row.querySelector('[data-active]');
    const activeKey = `${stage.active.length}/${workers}`;
    if (active.dataset.frame !== activeKey) {
      active.innerHTML = `<span class="worker-slots" aria-hidden="true">${Array.from({ length: workers }, (_, slot) => `<i${slot < stage.active.length ? ' class="busy"' : ''}></i>`).join('')}</span>
        <span>${stage.active.length}/${workers} em uso</span>`;
      active.dataset.frame = activeKey;
    }
  }
  main.querySelector('#chart-readout').textContent = `Aos ${timeLabel} · ${frame.queue} ${frame.queue === 1 ? 'pedido na fila' : 'pedidos na fila'}${run.close < run.end ? ` · Entradas até ${displayClock(run.close)}` : ''}`;
  chart?.draw(second);
}

function stop() {
  rolling = false;
  cancelAnimationFrame(animation);
}

function seek(value) {
  stop();
  time = Math.max(0, Math.min(value, run.end));
  drawPlayback();
}

function play() {
  if (rolling) {
    seek(time);
    return;
  }
  if (time >= run.end) time = 0;
  rolling = true;
  previousSecond = -1;
  let last = performance.now();
  function tick(now) {
    if (!rolling) return;
    time = Math.min(run.end, time + Math.max(0, now - last) * 0.06 * speed);
    last = now;
    if (time >= run.end) {
      stop();
      drawPlayback();
      announce(`Turno concluído. ${run.stats.count} pedidos entregues.`);
      return;
    }
    const second = Math.floor(time);
    if (second !== previousSecond && (second % 5 === 0 || second - previousSecond >= 5)) {
      drawPlayback();
      previousSecond = second;
    }
    animation = requestAnimationFrame(tick);
  }
  drawPlayback();
  animation = requestAnimationFrame(tick);
}

function useConfig(next, message, nextDraft = structuredClone(next)) {
  stop();
  config = next;
  draft = nextDraft;
  run = simulate(next);
  time = 0;
  compareTime = 0;
  saved.configs[next.id] = next;
  persist(message);
  render();
}

function renderStages(focusIndex, action) {
  main.querySelector('#stage-editor').innerHTML = stageEditor(draft.stages);
  const add = main.querySelector('[data-action="add"]');
  add.disabled = draft.stages.length >= LIMITS.stages[1];
  updateDraftStatus();
  const row = main.querySelector(`[data-edit-stage="${focusIndex}"]`);
  const button = action && row?.querySelector(`[data-action="${action}"]:enabled`);
  (button || row?.querySelector('[data-field="name"]') || add).focus();
}

function reorder(from, to, action) {
  if (from === null || !draft.stages[to] || from === to) return;
  const [moved] = draft.stages.splice(from, 1);
  draft.stages.splice(to, 0, moved);
  renderStages(to, action);
  announce(`${moved.name.trim() || 'Etapa'} movida para a posição ${to + 1}.`);
}

function pin() {
  const dialog = main.querySelector('#replace-dialog');
  if (dialog.open) dialog.close();
  reference = structuredClone(config);
  referenceRun = run;
  compareTime = 0;
  persist('Cenário fixado como referência.');
  render();
  main.focus();
}

const demandFields = ['duration', 'demand', 'profile', 'seed', 'target'];
const actions = {
  help: () => root.querySelector('#guide').showModal(),
  edit: () => {
    const editor = main.querySelector('.editor');
    editor.focus({ preventScroll: true });
    editor.scrollIntoView({ block: 'start' });
  },
  play,
  reset: () => seek(0),
  end: () => seek(run.end),
  download: () => downloadOrders(config, run),
  add: () => {
    if (draft.stages.length >= LIMITS.stages[1]) return;
    let number = draft.stages.length + 1;
    while (draft.stages.some((stage) => stage.name === `Etapa ${number}`)) number++;
    const id = `custom-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`;
    draft.stages.push({ id, icon: 'package', name: `Etapa ${number}`, workers: 1, service: 40 });
    renderStages(draft.stages.length - 1);
  },
  up: (index) => reorder(index, index - 1, 'up'),
  down: (index) => reorder(index, index + 1, 'down'),
  remove: (index) => {
    if (draft.stages.length <= LIMITS.stages[0]) return;
    draft.stages.splice(index, 1);
    renderStages(Math.min(index, draft.stages.length - 1), 'remove');
  },
  pin,
  replace: () => main.querySelector('#replace-dialog').showModal(),
  unpin: () => {
    reference = null;
    referenceRun = null;
    persist('Referência removida.');
    render();
    main.querySelector('[data-action="pin"]').focus();
  },
  'restore-inputs': () => {
    const fields = Object.fromEntries(demandFields.map((key) => [key, reference[key]]));
    useConfig({ ...config, ...fields }, 'Demanda e meta da referência restauradas.', { ...draft, ...fields });
    main.focus();
  },
};

root.addEventListener('click', (event) => {
  const skipLink = event.target.closest('.skip-link');
  if (skipLink) {
    event.preventDefault();
    main.focus();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) {
    const index = Number(button.closest('[data-edit-stage]')?.dataset.editStage);
    actions[button.dataset.action]?.(index);
  }
});

function updateField(event) {
  const input = event.target;
  if (input.id === 'timeline') {
    seek(Number(input.value));
    return;
  }
  if (input.id === 'compare-timeline') {
    compareTime = Number(input.value);
    drawComparison();
    return;
  }
  const field = input.dataset.field;
  if (!field) return;
  const row = input.closest('[data-edit-stage]');
  const record = row ? draft.stages[Number(row.dataset.editStage)] : draft;
  record[field] = input.type === 'number' ? input.valueAsNumber : input.value;
  if (field === 'name') input.setCustomValidity(input.value.trim() ? '' : 'Digite o nome da etapa.');
  updateDraftStatus();
}

root.addEventListener('input', updateField);
root.addEventListener('change', (event) => {
  const { id, value, dataset } = event.target;
  if (id === 'preset') {
    useConfig(saved.configs[value] ?? preset(value), 'Cenário carregado.');
    main.querySelector('#preset').focus();
  } else if (id === 'speed') speed = Number(value);
  else if (dataset.field) updateField(event);
});
root.addEventListener('toggle', (event) => {
  if (event.target.id === 'advanced') advanced = event.target.open;
}, true);
root.addEventListener('invalid', (event) => {
  const details = event.target.closest('#advanced');
  if (details) details.open = true;
}, true);

root.addEventListener('submit', (event) => {
  if (event.target.id !== 'scenario-form') return;
  event.preventDefault();
  if (!isScenario(draft)) {
    const invalidName = Array.from(main.querySelectorAll('[data-field="name"]')).find((input) => !input.value.trim());
    if (invalidName) {
      invalidName.setCustomValidity('Digite o nome da etapa.');
      invalidName.reportValidity();
    }
    announce('Confira os valores da operação antes de aplicar.');
    return;
  }
  useConfig(cleanScenario(draft), 'Mudanças aplicadas. A linha do tempo foi reiniciada.');
  main.querySelector('[data-action="play"]').focus({ preventScroll: true });
});

root.addEventListener('dragstart', (event) => {
  const grip = event.target.closest('.stage-grip');
  if (!grip) return;
  dragIndex = Number(grip.closest('[data-edit-stage]').dataset.editStage);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(dragIndex));
});
root.addEventListener('dragover', (event) => {
  const row = event.target.closest('[data-edit-stage]');
  if (!row || dragIndex === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  main.querySelector('.drop-target')?.classList.remove('drop-target');
  row.classList.add('drop-target');
});
root.addEventListener('drop', (event) => {
  const row = event.target.closest('[data-edit-stage]');
  if (!row || dragIndex === null) return;
  event.preventDefault();
  const from = dragIndex;
  dragIndex = null;
  row.classList.remove('drop-target');
  reorder(from, Number(row.dataset.editStage));
});
root.addEventListener('dragend', () => {
  dragIndex = null;
  main.querySelector('.drop-target')?.classList.remove('drop-target');
});

window.addEventListener('hashchange', () => {
  const next = readRoute();
  if (next === route) return;
  stop();
  route = next;
  render();
  main.focus();
});

render();
