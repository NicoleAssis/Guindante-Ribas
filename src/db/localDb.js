import seed from '../data/seed.json';

const PREFIX = 'ribas.rigging.';

const KEY = {
  workstations: PREFIX + 'workstations',
  activeWsId:   PREFIX + 'activeWsId',
  cranes:       PREFIX + 'cranes',
  accessories:  PREFIX + 'accessories',
  auditLogs:    PREFIX + 'auditLogs',
  plan:         PREFIX + 'currentPlan',
  sequences:    PREFIX + 'sequences',
};

function read(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const db = {
  init() {
    read(KEY.workstations, seed.workstations);
    read(KEY.activeWsId, seed.workstations[0].id);
    read(KEY.cranes, seed.cranes);
    read(KEY.accessories, seed.accessories);
    read(KEY.auditLogs, seed.auditLogs);
    read(KEY.sequences, seed.sequences);
    // plan fica opcional — começa null e o App cria o primeiro
  },

  get: (name, fallback) => read(KEY[name], fallback),
  set: (name, value) => write(KEY[name], value),

  exportJSON() {
    return JSON.stringify(
      Object.fromEntries(Object.entries(KEY).map(([k, v]) => [k, read(v, null)])),
      null,
      2
    );
  },

  reset() {
    Object.values(KEY).forEach((k) => localStorage.removeItem(k));
    this.init();
  },
};