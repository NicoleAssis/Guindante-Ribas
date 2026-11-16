import seed from '../data/seed.json';

const PREFIX = 'ribas.rigging.';
const KEY = {
  workstations: PREFIX + 'workstations',
  activeWsId: PREFIX + 'activeWsId',
  cranes: PREFIX + 'cranes',
  accessories: PREFIX + 'accessories',
  auditLogs: PREFIX + 'auditLogs',
  plan: PREFIX + 'currentPlan',
  savedPlans: PREFIX + 'savedPlans',
  sequences: PREFIX + 'sequences',
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
    read(KEY.savedPlans, []);
  },

  get: (name, fallback) => read(KEY[name], fallback),
  set: (name, value) => write(KEY[name], value),

  /**
   * Salva ou atualiza um plano de guindaste na lista de planos salvos.
   */
  savePlan(planToSave) {
    const plans = read(KEY.savedPlans, []);
    const index = plans.findIndex(
      (p) => String(p.assignedPlanNumber) === String(planToSave.assignedPlanNumber)
    );
    let updatedPlans;
    if (index >= 0) {
      updatedPlans = [...plans];
      updatedPlans[index] = { ...planToSave, updatedAt: new Date().toISOString() };
    } else {
      updatedPlans = [{ ...planToSave, createdAt: new Date().toISOString() }, ...plans];
    }
    write(KEY.savedPlans, updatedPlans);
    write(KEY.plan, planToSave);
    return updatedPlans;
  },

  /**
   * Remove um plano salvo por número do plano.
   */
  deletePlan(planNumber) {
    const plans = read(KEY.savedPlans, []);
    const updatedPlans = plans.filter((p) => String(p.assignedPlanNumber) !== String(planNumber));
    write(KEY.savedPlans, updatedPlans);
    return updatedPlans;
  },

  /**
   * Exporta todo o estado do sistema como string JSON.
   */
  exportJSON() {
    return JSON.stringify(
      Object.fromEntries(Object.entries(KEY).map(([k, v]) => [k, read(v, null)])),
      null,
      2
    );
  },

  /**
   * Realiza o download do arquivo JSON completo com o banco de planos e cadastros.
   */
  downloadJSONFile(filename = `banco_rigging_${Date.now()}.json`) {
    const jsonStr = this.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Exporta todos os planos salvos no formato CSV.
   */
  exportCSV() {
    const plans = read(KEY.savedPlans, []);
    if (!plans || plans.length === 0) {
      return 'Nº do Plano,Cliente,CNPJ,Descrição da Carga,Peso Líquido (t),Guindaste ID,Raio (m),Status,Data de Salvamento\n';
    }

    const headers = [
      'Nº do Plano',
      'Cliente',
      'CNPJ',
      'Descrição da Carga',
      'Peso Líquido (t)',
      'Guindaste ID',
      'Raio (m)',
      'Status',
      'Data de Salvamento',
    ];

    const rows = plans.map((p) => {
      const planNum = `"${p.assignedPlanNumber || ''}"`;
      const clientName = `"${(p.clientName || '').replace(/"/g, '""')}"`;
      const clientCnpj = `"${p.clientCnpj || ''}"`;
      const loadDesc = `"${(p.loadDescription || '').replace(/"/g, '""')}"`;
      const netWeight = p.netWeightVal ? `"${p.netWeightVal} ${p.netWeightUnit || 't'}"` : '""';
      const craneId = `"${p.selectedCraneId || ''}"`;
      const radius = `"${p.operatingRadiusM || ''}"`;
      const status = `"${p.status || 'RASCUNHO'}"`;
      const dateSaved = `"${p.savedAt ? new Date(p.savedAt).toLocaleDateString('pt-BR') : ''}"`;

      return [planNum, clientName, clientCnpj, loadDesc, netWeight, craneId, radius, status, dateSaved].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Realiza o download do arquivo CSV com todos os planos salvos.
   */
  downloadCSVFile(filename = `planos_rigging_${Date.now()}.csv`) {
    const csvContent = '\uFEFF' + this.exportCSV(); // Adiciona BOM para suporte correto a acentos no Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  reset() {
    Object.values(KEY).forEach((k) => localStorage.removeItem(k));
    this.init();
  },
};