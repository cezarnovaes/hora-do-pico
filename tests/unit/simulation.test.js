import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ordersCsv } from '../../src/export.js';
import { cleanScenario, isScenario, LIMITS, preset, PRESETS } from '../../src/scenarios.js';
import { arrivalsFor, comparableInputs, frameAt, simulate } from '../../src/simulation.js';
import { loadState, saveState } from '../../src/storage.js';

test('a semente reproduz todo o turno e mudar capacidade preserva os pedidos', () => {
  const config = preset();
  const baseline = simulate(config);
  assert.deepEqual(simulate(structuredClone(config)), baseline);
  const variant = structuredClone(config);
  variant.stages[1].workers++;
  const result = simulate(variant);
  assert.equal(baseline.stats.count, 37);
  assert.equal(baseline.stats.maxQueue, 9);
  assert.equal(baseline.stats.bottleneck.name, 'Preparo');
  assert.equal(result.stats.maxQueue, 6);
  assert.equal(result.stats.targetRate, 1);
  assert.ok(result.stats.meanTime < baseline.stats.meanTime);
  assert.ok(comparableInputs(variant, config, result, baseline));
  const serviceDurations = (run) => run.orders.map((order) => order.visits.map((visit) => visit.end - visit.start));
  assert.deepEqual(serviceDurations(result), serviceDurations(baseline));
});

test('ordens são conservadas e a ocupação respeita a capacidade, inclusive no limite', () => {
  const maximum = {
    ...preset(),
    duration: LIMITS.duration[1],
    demand: LIMITS.demand[1],
    stages: Array.from({ length: LIMITS.stages[1] }, (_, i) => ({
      id: `etapa-${i}`, name: `Etapa ${i}`, workers: 1, service: LIMITS.service[1], icon: 'package',
    })),
  };
  for (const config of [...PRESETS, maximum]) {
    const result = simulate(config);
    const closing = frameAt(result.frames, result.close);
    assert.equal(closing.arrivals, result.orders.length);
    assert.equal(frameAt(result.frames, result.end).completed, result.orders.length);
    assert.equal(frameAt(result.frames, result.end).queue, 0);
    for (const { arrivals, stages, completed } of result.frames) {
      let inProgress = 0;
      stages.forEach((stage, index) => {
        assert.ok(stage.active.length <= config.stages[index].workers);
        inProgress += stage.active.length + stage.waiting;
      });
      assert.equal(arrivals, inProgress + completed);
    }
    for (const order of result.orders) {
      let nextArrival = order.time;
      for (const [index, visit] of order.visits.entries()) {
        assert.equal(visit.stageId, config.stages[index].id);
        assert.equal(visit.enter, nextArrival);
        assert.ok(visit.start >= visit.enter && visit.end > visit.start);
        nextArrival = visit.end;
      }
      assert.equal(order.visits.length, config.stages.length);
      assert.equal(order.completed, nextArrival);
    }
    assert.ok(result.stats.stages.every(({ occupancy }) => occupancy >= 0 && occupancy <= 1));
    assert.equal(result.stats.overtime, result.end - result.close);
  }
  assert.ok(simulate(maximum).stats.overtime > 0);
});

test('prioridade adianta pedidos menores na fila sem interromper pedidos em atendimento', () => {
  const config = { ...preset('canteen') };
  config.stages.length = 1;
  Object.assign(config.stages[0], { workers: 1, service: 180 });
  const fifo = simulate(config);
  const priority = simulate({ ...config, policy: 'shortest' });
  assert.deepEqual(priority.orders[0], fifo.orders[0]);
  assert.equal(priority.arrivalKey, fifo.arrivalKey);
  const visit = (order) => order.visits[0];
  assert.ok(fifo.orders.every((order, i) => !i || visit(order).start >= visit(fifo.orders[i - 1]).start));
  assert.ok(priority.orders.some((order, i) =>
    priority.orders.slice(i + 1).some((later) =>
      later.size < order.size && visit(later).start < visit(order).start)));
});

test('P90, pico e percentual usam o turno completo e o arredondamento documentado', () => {
  const config = preset();
  const { orders, stats, frames } = simulate(config);
  const times = orders.map((order) => order.completed - order.time).sort((a, b) => a - b);
  assert.equal(stats.p90, times[Math.ceil(times.length * 0.9) - 1]);
  assert.equal(stats.targetRate, times.filter((time) => time <= config.target * 60).length / times.length);
  assert.equal(stats.maxQueue, Math.max(...frames.map((frame) => frame.queue)));
  assert.equal(stats.meanTime, times.reduce((total, time) => total + time, 0) / times.length);
});

test('cenário sem pedidos tem turno íntegro e métricas indefinidas quando cabível', () => {
  const config = { ...preset(), duration: 15, demand: 10, seed: 36 };
  const result = simulate(config);
  assert.deepEqual(arrivalsFor(config), []);
  assert.equal(result.end, 900);
  assert.equal(result.stats.meanTime, null);
  assert.equal(result.stats.p90, null);
  assert.equal(result.stats.targetRate, null);
  assert.equal(result.stats.maxQueue, 0);
  assert.equal(result.stats.bottleneck, null);
  assert.equal(frameAt(result.frames, 900).completed, 0);
  assert.equal(ordersCsv(config, result).trimEnd().split('\r\n').length, 1);
});

test('comparação exige os mesmos pedidos, duração e meta', () => {
  const config = preset();
  const current = simulate(config);
  for (const change of [{ seed: 43 }, { demand: 74 }, { target: 9 }]) {
    const other = { ...config, ...change };
    assert.equal(comparableInputs(config, other, current, simulate(other)), false);
  }
  const longer = { ...config, duration: 65 };
  assert.equal(comparableInputs(config, longer, current, { ...current, close: longer.duration * 60 }), false);
});

test('rejeita configuração com campos fora dos limites, etapa inválida ou identidade repetida', () => {
  const base = preset();
  for (const change of [
    { duration: 121 }, { policy: 'toString' }, { profile: null }, { id: '__proto__' },
    { stages: [] }, { stages: [base.stages[0], base.stages[0]] },
    { stages: [{ ...base.stages[0], name: ' ' }] },
    { stages: [{ ...base.stages[0], service: 10.5 }] },
  ]) {
    assert.equal(isScenario({ ...base, ...change }), false);
    assert.throws(() => simulate({ ...base, ...change }), TypeError);
  }
  assert.equal(cleanScenario({ ...base, name: 'Rótulo inválido' }).name, base.name);
});

test('CSV inclui uma linha por passagem e preserva textos sem interpretar fórmulas', () => {
  const config = preset();
  config.stages[0].name = '=1+"teste"; café';
  const run = simulate(config);
  const csv = ordersCsv(config, run);
  assert.ok(csv.startsWith('\uFEFF"pedido";'));
  assert.ok(csv.includes(`"'=1+""teste""; café"`));
  assert.equal(csv.trimEnd().split('\r\n').length, 1 + run.orders.length * config.stages.length);
});

test('armazenamento preserva cenários válidos e recupera dados corrompidos ou inacessíveis', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const state = { activeId: 'truck', configs: { truck: preset('truck'), cafe: { ...preset(), seed: -1 } }, reference: preset() };
  assert.equal(saveState(storage, state), true);
  const parsed = loadState(storage);
  assert.equal(parsed.activeId, 'truck');
  assert.deepEqual(parsed.configs.truck, state.configs.truck);
  assert.deepEqual(parsed.reference, state.reference);
  assert.equal(parsed.configs.cafe, undefined);
  const blocked = { getItem() { throw new Error('Bloqueado'); }, setItem() { throw new Error('Bloqueado'); } };
  assert.equal(saveState(blocked, state), false);
  assert.deepEqual(loadState(blocked), loadState({ getItem: () => 'json inválido' }));
});
