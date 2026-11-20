import { isScenario } from './scenarios.js';

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  }
  return result >>> 0;
}

function profileWeight(profile, progress) {
  switch (profile) {
    case 'rush':
      if (progress < 0.25) return 0.50;
      if (progress < 0.66) return 1.75;
      return 0.46;
    case 'waves':
      if ((progress >= 0.16 && progress < 0.35) || (progress >= 0.57 && progress < 0.77)) return 1.70;
      return 0.55;
    default:
      return 1;
  }
}

export function arrivalsFor({ duration, demand, profile, seed }) {
  const roll = random(seed);
  const arrivals = [];
  const close = duration * 60;
  let totalWeight = 0;
  for (let second = 0; second < close; second++) {
    totalWeight += profileWeight(profile, second / close);
  }
  for (let second = 0; second < close; second++) {
    const probability = demand * duration / 60 * profileWeight(profile, second / close) / totalWeight;
    if (roll() < probability) {
      const sizeRoll = random(hash(`${seed}:${second}`))();
      const size = sizeRoll < 0.45 ? 1 : sizeRoll < 0.85 ? 2 : 3;
      arrivals.push({ id: arrivals.length + 1, time: second, size });
    }
  }
  return arrivals;
}

function serviceTime(seed, order, stage) {
  const variation = random(hash(`${seed}:${order.time}:${stage.id}`))();
  const sizeFactor = [0.76, 1.06, 1.42][order.size - 1];
  return Math.max(1, Math.round(stage.service * sizeFactor * (0.85 + 0.30 * variation)));
}

const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function nextEventTime(orders, nextOrder, stages) {
  let time = orders[nextOrder]?.time ?? Infinity;
  for (const stage of stages) {
    for (const task of stage.active) time = Math.min(time, task.end);
  }
  return time;
}

function startNext(stage, time, { seed, policy }) {
  let index = 0;
  if (policy === 'shortest') {
    for (let i = 1; i < stage.waiting.length; i++) {
      if (stage.waiting[i].order.size < stage.waiting[index].order.size) index = i;
    }
  }
  const [task] = stage.waiting.splice(index, 1);
  task.visit.start = time;
  task.end = time + serviceTime(seed, task.order, stage.config);
  task.visit.end = task.end;
  stage.active.push(task);
}

function stageFrame(stage) {
  const visibleTasks = stage.waiting.slice(0, 12);
  return {
    waiting: stage.waiting.length,
    orders: visibleTasks.map((task) => ({ id: task.order.id, size: task.order.size })),
    active: stage.active.map((task) => ({
      id: task.order.id, start: task.visit.start, end: task.end,
    })),
  };
}

export function simulate(config) {
  if (!isScenario(config)) throw new TypeError('Cenário inválido.');
  const orders = arrivalsFor(config).map((arrival) => ({ ...arrival, visits: [], completed: null }));
  const stages = config.stages.map((config) => ({ config, active: [], waiting: [], visits: [] }));
  const close = config.duration * 60;
  const frames = [];
  let arrivals = 0;
  let completed = 0;
  let lastCompletion = 0;
  let maxQueue = 0;

  function enqueue(order, stage, time) {
    const visit = { stageId: stage.config.id, enter: time, start: null, end: null };
    const task = { order, visit, end: null };
    order.visits.push(visit);
    stage.visits.push(visit);
    stage.waiting.push(task);
  }

  function snapshot(time) {
    const stageFrames = stages.map(stageFrame);
    const queue = stageFrames.reduce((total, stage) => total + stage.waiting, 0);
    maxQueue = Math.max(maxQueue, queue);
    frames.push({ time, arrivals, completed, queue, stages: stageFrames });
  }

  snapshot(0);
  for (let time = nextEventTime(orders, arrivals, stages); Number.isFinite(time); time = nextEventTime(orders, arrivals, stages)) {
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const finished = stage.active.filter((task) => task.end === time);
      stage.active = stage.active.filter((task) => task.end !== time);
      for (const { order } of finished) {
        if (i + 1 < stages.length) {
          enqueue(order, stages[i + 1], time);
        } else {
          order.completed = time;
          lastCompletion = time;
          completed++;
        }
      }
    }
    while (orders[arrivals]?.time === time) {
      enqueue(orders[arrivals], stages[0], time);
      arrivals++;
    }
    for (const stage of stages) {
      while (stage.waiting.length && stage.active.length < stage.config.workers) startNext(stage, time, config);
    }
    snapshot(time);
  }

  const end = Math.max(close, lastCompletion);
  const turnaround = orders.map((order) => order.completed - order.time).sort((a, b) => a - b);
  const stageStats = stages.map(({ config, visits }) => {
    const waiting = visits.map((visit) => visit.start - visit.enter);
    const busy = visits.reduce((time, visit) => time + visit.end - visit.start, 0);
    return { ...config, meanWait: mean(waiting), maxWait: Math.max(0, ...waiting), occupancy: busy / (end * config.workers) };
  });
  const bottleneck = stageStats.reduce((worst, item) => (item.meanWait ?? 0) > (worst?.meanWait ?? 0) ? item : worst, null);
  return {
    orders,
    frames,
    close,
    end,
    arrivalKey: JSON.stringify(orders.map(({ time, size }) => [time, size])),
    stats: {
      count: orders.length,
      meanTime: mean(turnaround),
      p90: turnaround[Math.ceil(0.90 * turnaround.length) - 1] ?? null,
      targetRate: turnaround.length ? turnaround.filter((time) => time <= config.target * 60).length / turnaround.length : null,
      maxQueue,
      overtime: end - close,
      stages: stageStats,
      bottleneck,
    },
  };
}

export function frameAt(frames, time) {
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (frames[mid].time <= time) low = mid + 1;
    else high = mid;
  }
  return frames[Math.max(0, low - 1)];
}

export function comparableInputs(current, reference, currentTape, referenceTape) {
  return current.target === reference.target &&
    currentTape.close === referenceTape.close &&
    currentTape.arrivalKey === referenceTape.arrivalKey;
}
