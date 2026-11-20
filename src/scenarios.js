const stage = (id, icon, name, workers, service) => ({ id, icon, name, workers, service });

export const PRESETS = [
  {
    id: 'cafe',
    name: 'Café da Estação',
    description: 'Acompanhe o almoço de uma cafeteria e descubra onde os pedidos acumulam.',
    duration: 60,
    demand: 52,
    profile: 'rush',
    seed: 42,
    target: 10,
    policy: 'fifo',
    stages: [
      stage('register', 'register', 'Caixa', 1, 32),
      stage('kitchen', 'kitchen', 'Preparo', 2, 162),
      stage('pickup', 'pickup', 'Retirada', 1, 24),
    ],
  },
  {
    id: 'truck',
    name: 'Food Truck da Praça',
    description: 'Teste como organizar a fila quando os pedidos chegam em ondas.',
    duration: 45,
    demand: 46,
    profile: 'waves',
    seed: 81,
    target: 12,
    policy: 'shortest',
    stages: [
      stage('register', 'register', 'Pedidos', 1, 44),
      stage('kitchen', 'kitchen', 'Chapa', 2, 135),
      stage('packing', 'package', 'Embalagem', 1, 45),
      stage('pickup', 'pickup', 'Entrega', 1, 19),
    ],
  },
  {
    id: 'canteen',
    name: 'Cantina do Campus',
    description: 'Simule a saída das aulas e a disputa por espaço no balcão.',
    duration: 40,
    demand: 78,
    profile: 'rush',
    seed: 127,
    target: 8,
    policy: 'fifo',
    stages: [
      stage('register', 'register', 'Caixa', 2, 45),
      stage('kitchen', 'kitchen', 'Balcão', 3, 86),
      stage('pickup', 'pickup', 'Retirada', 1, 54),
    ],
  },
];

export const PROFILES = {
  rush: 'Pico concentrado',
  steady: 'Ritmo constante',
  waves: 'Duas ondas',
};

export const POLICIES = {
  fifo: 'Por ordem de chegada',
  shortest: 'Pedidos menores primeiro',
};

export const LIMITS = {
  duration: [15, 120],
  demand: [10, 240],
  seed: [1, 4294967295],
  target: [1, 60],
  workers: [1, 8],
  service: [10, 300],
  stages: [1, 6],
};

export function preset(id = 'cafe') {
  return structuredClone(PRESETS.find((item) => item.id === id) ?? PRESETS[0]);
}

export function isScenario(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const isInt = (value, [min, max]) => Number.isInteger(value) && value >= min && value <= max;
  if (
    !PRESETS.some((item) => item.id === candidate.id) ||
    !Object.hasOwn(PROFILES, candidate.profile) ||
    !Object.hasOwn(POLICIES, candidate.policy) ||
    !['duration', 'demand', 'seed', 'target'].every((field) => isInt(candidate[field], LIMITS[field])) ||
    !Array.isArray(candidate.stages) ||
    !isInt(candidate.stages.length, LIMITS.stages)
  ) return false;

  const ids = new Set();
  for (const item of candidate.stages) {
    if (
      !item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(item.id) ||
      ids.has(item.id) || typeof item.name !== 'string' ||
      !item.name.trim() || item.name.length > 28 ||
      !['register', 'kitchen', 'pickup', 'package'].includes(item.icon) ||
      !isInt(item.workers, LIMITS.workers) || !isInt(item.service, LIMITS.service)
    ) return false;
    ids.add(item.id);
  }
  return true;
}

export function cleanScenario(config) {
  const { id, duration, demand, profile, seed, target, policy, stages } = config;
  const { name, description } = preset(id);
  return {
    id, name, description, duration, demand, profile, seed, target, policy,
    stages: stages.map(({ id, icon, name, workers, service }) => ({
      id, icon, name: name.trim(), workers, service,
    })),
  };
}
