import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Truck, Package, FileText, CheckCircle2, AlertTriangle,
  XCircle, Plus, Trash2, Edit3, Copy, Printer, History, Monitor,
  Network, Calculator, Check, Info, RefreshCw, Ban, Layers, Eye
} from 'lucide-react';

import seed from './data/seed.json';
import { DEFAULT_PLAN } from './data/defaultPlan';
import { usePersistedState } from './db/usePersistedState';

export default function App() {
  // --------------------------------------------------------------------------
  // 1. ESTADO DE REDE E IDENTIFICAÇÃO DE MÁQUINA / IP (PERSISTIDO)
  // --------------------------------------------------------------------------
  const [workstations, setWorkstations] = usePersistedState(
    'workstations',
    seed.workstations
  );
  const [activeWsId, setActiveWsId] = usePersistedState(
    'activeWsId',
    seed.workstations[0].id
  );

  const [detectedBrowserHost, setDetectedBrowserHost] = useState('');
  const [customHostModal, setCustomHostModal] = useState(false);
  const [newWsForm, setNewWsForm] = useState({
    hostname: '',
    ip: '',
    userName: '',
    role: 'Engenheiro Planejador',
    crea: ''
  });

  const activeWs = useMemo(
    () => workstations.find((w) => w.id === activeWsId) || workstations[0],
    [workstations, activeWsId]
  );

  // Trilha de Auditoria persistida
  const [auditLogs, setAuditLogs] = usePersistedState(
    'auditLogs',
    seed.auditLogs
  );

  const registerAuditLog = (moduleName, actionText, overrideWs = null) => {
    const ws = overrideWs || activeWs;
    const now = new Date();
    const formattedDate =
      now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    const newEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      timestamp: formattedDate,
      hostname: ws.hostname,
      ip: ws.ip,
      userName: ws.userName,
      role: ws.role,
      module: moduleName,
      action: actionText
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    setDetectedBrowserHost(host);
  }, []);

  // --------------------------------------------------------------------------
  // 2. NAVEGAÇÃO ENTRE OS MÓDULOS
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState('uc05'); // 'uc05' | 'uc02' | 'uc03_04' | 'uc07' | 'audit'

  // --------------------------------------------------------------------------
  // 3. CONTROLE SEQUENCIAL (PERSISTIDO)
  // --------------------------------------------------------------------------
  const [lastPlanSeq, setLastPlanSeq] = usePersistedState(
    'lastPlanSeq',
    seed.sequences.lastPlanSeq
  );
  const [lastArtSeq, setLastArtSeq] = usePersistedState(
    'lastArtSeq',
    seed.sequences.lastArtSeq
  );

  // --------------------------------------------------------------------------
  // 4. GUINDASTES E ACESSÓRIOS (PERSISTIDOS)
  // --------------------------------------------------------------------------
  const [cranes, setCranes] = usePersistedState('cranes', seed.cranes);
  const [accessories, setAccessories] = usePersistedState(
    'accessories',
    seed.accessories
  );

  // --------------------------------------------------------------------------
  // 5. PLANO EM ELABORAÇÃO (PERSISTIDO)
  // --------------------------------------------------------------------------
  const [plan, setPlan] = usePersistedState('plan', DEFAULT_PLAN);

  // Alerta de seleção de acessório com desgaste (Subfluxo 11 — Passo 11.6)
  const [wearWarningModal, setWearWarningModal] = useState(null);
  const [emissionFeedback, setEmissionFeedback] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // --------------------------------------------------------------------------
  // SUBFLUXO 9: VALIDAÇÃO E PADRONIZAÇÃO DE UNIDADES (CONVERSÃO INTERNA)
  // --------------------------------------------------------------------------
  const toStandardKg = (val, unit) => {
    const num = Number(val) || 0;
    if (unit === 't') return num * 1000;
    if (unit === 'kgf') return num;
    return num;
  };

  const toStandardMeters = (val, unit) => {
    const num = Number(val) || 0;
    if (unit === 'cm') return num / 100;
    if (unit === 'mm') return num / 1000;
    return num;
  };

  const selectedCrane = useMemo(
    () => cranes.find((c) => c.id === plan.selectedCraneId) || cranes[0],
    [cranes, plan.selectedCraneId]
  );

  // --------------------------------------------------------------------------
  // SUBFLUXO 10: CAPACIDADE DO GUINDASTE POR INTERPOLAÇÃO (COM TRAVA R05)
  // --------------------------------------------------------------------------
  const interpolationResult = useMemo(() => {
    if (!selectedCrane || !selectedCrane.loadTable || selectedCrane.loadTable.length === 0) {
      return { valid: false, status: 'SEM_TABELA', capacityKgf: 0, capacityTons: 0, message: 'Guindaste sem tabela cadastrada.' };
    }
    const sorted = [...selectedCrane.loadTable].sort((a, b) => a.radiusM - b.radiusM);
    const r = Number(plan.operatingRadiusM);
    const minR = sorted[0].radiusM;
    const maxR = sorted[sorted.length - 1].radiusM;

    if (isNaN(r) || r < minR || r > maxR) {
      return {
        valid: false,
        status: 'FORA_DA_FAIXA',
        capacityKgf: 0,
        capacityTons: 0,
        minR,
        maxR,
        message: `Raio ${r || 0}m fora da faixa da tabela do fabricante (${minR}m a ${maxR}m). O sistema não extrapola valores (R05).`
      };
    }

    const exactMatch = sorted.find((pt) => Math.abs(pt.radiusM - r) < 0.0001);
    if (exactMatch) {
      return {
        valid: true,
        status: 'TABELADA',
        capacityKgf: exactMatch.capacityKgf,
        capacityTons: exactMatch.capacityKgf / 1000,
        message: `Capacidade tabelada exata para o raio de ${r.toFixed(2)} m.`
      };
    }

    let lower = sorted[0];
    let upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (r > sorted[i].radiusM && r < sorted[i + 1].radiusM) {
        lower = sorted[i];
        upper = sorted[i + 1];
        break;
      }
    }

    const ratio = (r - lower.radiusM) / (upper.radiusM - lower.radiusM);
    const interpolatedKgf = Math.round(lower.capacityKgf + ratio * (upper.capacityKgf - lower.capacityKgf));

    return {
      valid: true,
      status: 'INTERPOLADA',
      capacityKgf: interpolatedKgf,
      capacityTons: interpolatedKgf / 1000,
      lowerPoint: lower,
      upperPoint: upper,
      message: `Interpolado entre ${lower.radiusM}m (${lower.capacityKgf} kgf) e ${upper.radiusM}m (${upper.capacityKgf} kgf) → ${interpolatedKgf} kgf.`
    };
  }, [selectedCrane, plan.operatingRadiusM]);

  // --------------------------------------------------------------------------
  // SUBFLUXO 12 E 13: CARGA BRUTA, TAXAS DE UTILIZAÇÃO, SAPATAS E RMET
  // --------------------------------------------------------------------------
  const calculations = useMemo(() => {
    const netLoadKg = toStandardKg(plan.netWeightVal, plan.netWeightUnit);
    const extraLoadKg = toStandardKg(plan.extraWeightVal, plan.extraWeightUnit);
    const stdLengthM = toStandardMeters(plan.lengthVal, plan.lengthUnit);
    const stdWidthM = toStandardMeters(plan.widthVal, plan.widthUnit);
    const stdHeightM = toStandardMeters(plan.heightVal, plan.heightUnit);

    const slingDetails = plan.selectedSlings.map((row) => {
      const acc = accessories.find((a) => a.id === row.accessoryId);
      if (!acc) return null;
      const totalItemWeightKg = Number((row.qty * acc.unitWeightKg).toFixed(2));
      const rad = (Number(row.angleDeg) * Math.PI) / 180;
      const cosAlpha = Math.cos(rad) > 0.05 ? Math.cos(rad) : 1;

      const isShackle = acc.type === 'Manilha';
      const tensionTons = isShackle
        ? Number(row.supportedWeightTons) / Math.max(1, Number(row.loadSharingFactor))
        : (1 / cosAlpha) * (Number(row.supportedWeightTons) / Math.max(1, Number(row.loadSharingFactor)));

      const utilizationPct = acc.capacityTons > 0 ? (tensionTons / acc.capacityTons) * 100 : 0;

      return {
        ...row,
        accessory: acc,
        totalItemWeightKg,
        tensionTons,
        utilizationPct,
        isOverLimit: utilizationPct > 85.0
      };
    }).filter(Boolean);

    const totalSlingsWeightKg = Number(
      slingDetails.reduce((acc, item) => acc + item.totalItemWeightKg, 0).toFixed(2)
    );

    const balancimTotalKg = plan.useBalancim
      ? Number((plan.balancimQty * toStandardKg(plan.balancimUnitWeightVal, plan.balancimWeightUnit)).toFixed(2))
      : 0;

    const grossLoadKg = Number((netLoadKg + totalSlingsWeightKg + balancimTotalKg + extraLoadKg).toFixed(2));
    const grossLoadTons = grossLoadKg / 1000;

    const craneCapTons = interpolationResult.valid ? interpolationResult.capacityTons : 0;
    const craneUtilizationPct = craneCapTons > 0 ? (grossLoadTons / craneCapTons) * 100 : 0;

    const maxCintaPlanaPct = slingDetails
      .filter((s) => s.accessory.type === 'Cinta Plana')
      .reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    const maxCintaTubularPct = slingDetails
      .filter((s) => s.accessory.type === 'Cinta Tubular')
      .reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    const maxCaboAcoPct = slingDetails
      .filter((s) => s.accessory.type === 'Laço de Cabo de Aço')
      .reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    const maxManilhaPct = slingDetails
      .filter((s) => s.accessory.type === 'Manilha')
      .reduce((max, s) => Math.max(max, s.utilizationPct), 0);

    const liftedForcePcKgf = netLoadKg + balancimTotalKg;
    const momentKgfM = liftedForcePcKgf * Number(plan.operatingRadiusM);
    const denomAB = Number(plan.columnDistA) + Number(plan.outriggerSpanB);
    const forceFKgf = denomAB > 0 ? Math.round(momentKgfM / denomAB) : 0;
    const craneSelfWeightKgf = selectedCrane ? selectedCrane.selfWeightKgf : 11550;
    const outriggerEffortEsKgf = Math.round(craneSelfWeightKgf / 2 + forceFKgf);

    const patolamentoAreaCm2 =
      Number(plan.sleeperLengthCm) * Number(plan.sleeperWidthCm) * Number(plan.sleeperCount);
    const rmetKgfCm2 = patolamentoAreaCm2 > 0 ? outriggerEffortEsKgf / patolamentoAreaCm2 : 0;

    const overloadedItems = [];
    if (craneUtilizationPct > 85.0) {
      overloadedItems.push(`Guindaste ${selectedCrane?.model} (${craneUtilizationPct.toFixed(1)}% > 85%)`);
    }
    slingDetails.forEach((s) => {
      if (s.isOverLimit) {
        overloadedItems.push(`${s.accessory.code} - ${s.accessory.description} (${s.utilizationPct.toFixed(1)}% > 85%)`);
      }
    });

    const validationErrors = [];
    if (!plan.clientName.trim()) validationErrors.push('Nome do Cliente é obrigatório (RF01).');
    if (!plan.serviceSite.trim()) validationErrors.push('Local da Obra/Serviço é obrigatório (RF01).');
    if (!plan.loadDescription.trim()) validationErrors.push('Descrição da carga é obrigatória (RF01).');
    if (netLoadKg <= 0) validationErrors.push('Peso líquido da carga deve ser maior que zero e ter unidade (Subfluxo 9).');
    if (stdLengthM <= 0 || stdWidthM <= 0 || stdHeightM <= 0) {
      validationErrors.push('Dimensões da carga (Comprimento, Largura, Altura) devem ser maiores que zero (Subfluxo 9).');
    }
    if (!interpolationResult.valid) {
      validationErrors.push(interpolationResult.message);
    }
    if (slingDetails.length === 0) {
      validationErrors.push('Selecione ao menos um acessório de içamento cadastrado (UC05 Passo 6.11).');
    }
    if (patolamentoAreaCm2 <= 0) {
      validationErrors.push('Área de patolamento (dormentes) deve ser maior que zero (Subfluxo 13).');
    }

    return {
      netLoadKg,
      stdLengthM,
      stdWidthM,
      stdHeightM,
      slingDetails,
      totalSlingsWeightKg,
      balancimTotalKg,
      grossLoadKg,
      grossLoadTons,
      craneCapTons,
      craneUtilizationPct,
      maxCintaPlanaPct,
      maxCintaTubularPct,
      maxCaboAcoPct,
      maxManilhaPct,
      liftedForcePcKgf,
      momentKgfM,
      forceFKgf,
      outriggerEffortEsKgf,
      patolamentoAreaCm2,
      rmetKgfCm2,
      overloadedItems,
      validationErrors
    };
  }, [plan, accessories, selectedCrane, interpolationResult]);

  // --------------------------------------------------------------------------
  // HANDLERS DO PLANO DE RIGGING (UC05 e SUBFLUXO 11)
  // --------------------------------------------------------------------------
  const handleAddAccessoryToPlan = (accessoryId, forceAdd = false) => {
    const acc = accessories.find((a) => a.id === accessoryId);
    if (!acc || acc.wearStatus === 'DESCARTADO') return;

    if (acc.wearStatus === 'ALERTA_DESGASTE' && !forceAdd) {
      setWearWarningModal(acc);
      return;
    }

    const newRow = {
      rowId: 'row-' + Date.now(),
      accessoryId: acc.id,
      qty: 2,
      angleDeg: acc.type === 'Manilha' ? 90 : 45,
      supportedWeightTons: Number((calculations.netLoadKg / 1000).toFixed(2)),
      loadSharingFactor: acc.type === 'Manilha' ? 1 : 2
    };

    setPlan((prev) => ({
      ...prev,
      selectedSlings: [...prev.selectedSlings, newRow]
    }));

    registerAuditLog(
      'UC05 — Elaborar Plano',
      `Adicionou acessório ${acc.code} (${acc.description}) ao plano${acc.wearStatus === 'ALERTA_DESGASTE' ? ' [COM ALERTA DE DESGASTE CONFIRMADO]' : ''}.`
    );
    setWearWarningModal(null);
  };

  const handleRemoveSlingRow = (rowId) => {
    setPlan((prev) => ({
      ...prev,
      selectedSlings: prev.selectedSlings.filter((r) => r.rowId !== rowId)
    }));
  };

  const handleUpdateSlingRow = (rowId, field, value) => {
    setPlan((prev) => ({
      ...prev,
      selectedSlings: prev.selectedSlings.map((r) =>
        r.rowId === rowId ? { ...r, [field]: value } : r
      )
    }));
  };

  const handleStartNewPlan = () => {
    setPlan((prev) => ({
      ...prev,
      assignedPlanNumber: null,
      assignedInternalArtNumber: null,
      clientName: '',
      clientCnpj: '',
      serviceSite: '',
      operationName: 'Novo Içamento',
      loadDescription: '',
      netWeightVal: 1000,
      netWeightUnit: 'kg'
    }));
    registerAuditLog('UC05 — Elaborar Plano', 'Iniciou o preenchimento de um novo Plano de Rigging do zero (RN04).');
  };

  // --------------------------------------------------------------------------
  // UC06 — EMISSÃO DO PLANO DE RIGGING EM PDF E SUBFLUXO 14 (NUMERAÇÃO)
  // --------------------------------------------------------------------------
  const handleEmitPdf = () => {
    if (calculations.validationErrors.length > 0) {
      setEmissionFeedback({
        type: 'error',
        title: 'Emissão Recusada — Dados Incompletos ou Inválidos (UC06 Fluxo Alternativo 2a)',
        messages: calculations.validationErrors
      });
      registerAuditLog('UC06 — Emitir PDF', 'Tentativa de emissão bloqueada por dados pendentes/fora da faixa.');
      return;
    }

    if (plan.blockPdfOnOverload && calculations.overloadedItems.length > 0) {
      setEmissionFeedback({
        type: 'error',
        title: 'Emissão Bloqueada — Taxa de Utilização Acima de 85%',
        messages: calculations.overloadedItems
      });
      registerAuditLog('UC06 — Emitir PDF', 'Emissão bloqueada por sobrecarga (> 85%).');
      return;
    }

    let finalPlanNumber = plan.assignedPlanNumber;
    if (!finalPlanNumber) {
      const nextNum = lastPlanSeq + 1;
      setLastPlanSeq(nextNum);
      finalPlanNumber = String(nextNum);
      setPlan((prev) => ({ ...prev, assignedPlanNumber: finalPlanNumber }));
    }

    const todayStr = new Date().toLocaleDateString('pt-BR');
    setAccessories((prevAccs) =>
      prevAccs.map((acc) => {
        const isUsed = plan.selectedSlings.some((s) => s.accessoryId === acc.id);
        if (!isUsed) return acc;
        const alreadyLogged = acc.history.some((h) => h.planNumber === finalPlanNumber);
        const newUsesCount = alreadyLogged ? acc.usesCount : acc.usesCount + 1;
        const reachedWear = newUsesCount >= acc.maxUsesLimit * 0.9 && acc.wearStatus === 'OK';
        return {
          ...acc,
          usesCount: newUsesCount,
          wearStatus: reachedWear ? 'ALERTA_DESGASTE' : acc.wearStatus,
          history: alreadyLogged
            ? acc.history
            : [
                {
                  date: todayStr,
                  planNumber: finalPlanNumber,
                  client: plan.clientName,
                  host: activeWs.hostname,
                  user: activeWs.userName
                },
                ...acc.history
              ]
        };
      })
    );

    setEmissionFeedback({
      type: 'success',
      title: `Plano de Rigging Nº ${finalPlanNumber} Emitido com Sucesso (NR-11 / NR-12)`,
      messages: [
        `Numeração sequencial garantida pelo Subfluxo 14: Nº ${finalPlanNumber}.`,
        `Estação emissora registrada: ${activeWs.hostname} (${activeWs.ip}) — ${activeWs.userName}.`
      ]
    });

    registerAuditLog(
      'UC06 — Emitir PDF',
      `Emitiu o PDF definitivo do Plano de Rigging Nº ${finalPlanNumber} para o cliente ${plan.clientName}.`
    );

    setTimeout(() => {
      window.print();
    }, 300);
  };

  // --------------------------------------------------------------------------
  // UC02 — CADASTRO E EDIÇÃO DE GUINDASTES E TABELA DE CARGA (FLUXO 3)
  // --------------------------------------------------------------------------
  const [editingCraneId, setEditingCraneId] = useState(null);
  const [craneForm, setCraneForm] = useState({
    code: '',
    model: '',
    type: 'Guindaste Articulado (Munck)',
    truck: '',
    plate: '',
    chassis: '',
    year: 2024,
    nominalCapacityTons: '',
    nominalUnit: 't',
    selfWeightVal: '',
    selfWeightUnit: 'kgf',
    defaultColumnDistA: 2.95,
    defaultOutriggerSpanB: 5.7,
    laudoArt: '',
    laudoValidade: '',
    loadTable: [
      { radiusM: 4.0, radiusUnit: 'm', boomM: 5.1, capacityVal: 8500, capacityUnit: 'kgf' },
      { radiusM: 6.0, radiusUnit: 'm', boomM: 5.1, capacityVal: 6200, capacityUnit: 'kgf' }
    ]
  });
  const [craneFormErrors, setCraneFormErrors] = useState([]);
  const [craneFormSuccess, setCraneFormSuccess] = useState('');

  const handleLoadCraneForEdit = (crane) => {
    setEditingCraneId(crane.id);
    setCraneForm({
      code: crane.code,
      model: crane.model,
      type: crane.type,
      truck: crane.truck,
      plate: crane.plate,
      chassis: crane.chassis,
      year: crane.year,
      nominalCapacityTons: crane.nominalCapacityTons,
      nominalUnit: 't',
      selfWeightVal: crane.selfWeightKgf,
      selfWeightUnit: 'kgf',
      defaultColumnDistA: crane.defaultColumnDistA,
      defaultOutriggerSpanB: crane.defaultOutriggerSpanB,
      laudoArt: crane.laudoArt,
      laudoValidade: crane.laudoValidade,
      loadTable: crane.loadTable.map((r) => ({
        radiusM: r.radiusM,
        radiusUnit: 'm',
        boomM: r.boomM,
        capacityVal: r.capacityKgf,
        capacityUnit: 'kgf'
      }))
    });
    setCraneFormErrors([]);
    setCraneFormSuccess('');
  };

  const handleSaveCrane = (e) => {
    e.preventDefault();
    const errors = [];

    if (!craneForm.code.trim() || !craneForm.model.trim()) {
      errors.push('Código e Modelo do guindaste são obrigatórios (Passo 3.3).');
    }
    if (Number(craneForm.nominalCapacityTons) <= 0 || !craneForm.nominalUnit) {
      errors.push('Capacidade nominal deve ser numérica positiva e possuir unidade.');
    }
    if (Number(craneForm.selfWeightVal) <= 0 || !craneForm.selfWeightUnit) {
      errors.push('Peso próprio do conjunto (Pg) deve ser numérico positivo e possuir unidade.');
    }
    if (craneForm.loadTable.length < 2) {
      errors.push('A tabela de carga deve conter pelo menos 2 pontos de raio para permitir interpolação (RF02/RF03).');
    }

    const seenRadii = new Set();
    craneForm.loadTable.forEach((row, idx) => {
      const r = Number(row.radiusM);
      const c = Number(row.capacityVal);
      if (isNaN(r) || r <= 0 || !row.radiusUnit) {
        errors.push(`Linha ${idx + 1} da tabela: Raio inválido ou sem unidade informada.`);
      }
      if (isNaN(c) || c <= 0 || !row.capacityUnit) {
        errors.push(`Linha ${idx + 1} da tabela: Capacidade inválida ou sem unidade informada.`);
      }
      if (seenRadii.has(r)) {
        errors.push(`Linha ${idx + 1} da tabela: Raio de ${r}m está repetido (Fluxo de Exceção UC02 4a).`);
      }
      seenRadii.add(r);
    });

    if (errors.length > 0) {
      setCraneFormErrors(errors);
      setCraneFormSuccess('');
      return;
    }

    const normalizedTable = craneForm.loadTable
      .map((row) => ({
        radiusM: row.radiusUnit === 'cm' ? Number(row.radiusM) / 100 : Number(row.radiusM),
        boomM: Number(row.boomM) || 5.1,
        capacityKgf:
          row.capacityUnit === 't'
            ? Number(row.capacityVal) * 1000
            : Number(row.capacityVal)
      }))
      .sort((a, b) => a.radiusM - b.radiusM);

    const newCraneObj = {
      id: editingCraneId || 'crane-' + Date.now(),
      code: craneForm.code.trim(),
      model: craneForm.model.trim(),
      type: craneForm.type,
      truck: craneForm.truck.trim() || 'Caminhão Padrão',
      plate: craneForm.plate.trim() || '---',
      chassis: craneForm.chassis.trim() || '---',
      year: Number(craneForm.year) || 2024,
      nominalCapacityTons:
        craneForm.nominalUnit === 'kg'
          ? Number(craneForm.nominalCapacityTons) / 1000
          : Number(craneForm.nominalCapacityTons),
      selfWeightKgf:
        craneForm.selfWeightUnit === 't'
          ? Number(craneForm.selfWeightVal) * 1000
          : Number(craneForm.selfWeightVal),
      defaultColumnDistA: Number(craneForm.defaultColumnDistA) || 2.95,
      defaultOutriggerSpanB: Number(craneForm.defaultOutriggerSpanB) || 5.7,
      laudoArt: craneForm.laudoArt.trim() || '1720261926954',
      laudoValidade: craneForm.laudoValidade.trim() || '31/12/2026',
      createdByHost: `${activeWs.hostname} (${activeWs.ip})`,
      loadTable: normalizedTable
    };

    if (editingCraneId) {
      setCranes((prev) => prev.map((c) => (c.id === editingCraneId ? newCraneObj : c)));
      registerAuditLog('UC02 — Guindastes', `Editou guindaste e tabela de carga: ${newCraneObj.model} (${newCraneObj.code}).`);
      setCraneFormSuccess(`Guindaste ${newCraneObj.model} atualizado com sucesso por ${activeWs.hostname}!`);
    } else {
      setCranes((prev) => [...prev, newCraneObj]);
      registerAuditLog('UC02 — Guindastes', `Cadastrou novo guindaste e tabela de carga: ${newCraneObj.model} (${newCraneObj.code}).`);
      setCraneFormSuccess(`Guindaste ${newCraneObj.model} cadastrado com sucesso por ${activeWs.hostname}!`);
    }

    setCraneFormErrors([]);
    setEditingCraneId(null);
  };

  // --------------------------------------------------------------------------
  // UC03 E UC04 — CADASTRO, HISTÓRICO E DESCARTE DE ACESSÓRIOS (FLUXOS 4 E 5)
  // --------------------------------------------------------------------------
  const [accForm, setAccForm] = useState({
    code: '',
    type: 'Cinta Plana',
    description: '',
    capacityVal: '',
    capacityUnit: 't',
    weightVal: '',
    weightUnit: 'kg',
    maxUsesLimit: 30,
    wearNotes: 'Item novo cadastrado no estoque.'
  });
  const [accFormError, setAccFormError] = useState('');
  const [accFormSuccess, setAccFormSuccess] = useState('');
  const [selectedAccForHistory, setSelectedAccForHistory] = useState(accessories[0]);

  const handleSaveAccessory = (e) => {
    e.preventDefault();
    setAccFormError('');
    setAccFormSuccess('');

    if (!accForm.code.trim() || !accForm.description.trim()) {
      setAccFormError('Identificação (código) e descrição do acessório são obrigatórias (Passo 4.2).');
      return;
    }
    if (Number(accForm.capacityVal) <= 0 || !accForm.capacityUnit) {
      setAccFormError('Capacidade nominal deve ser maior que zero e ter unidade informada (Subfluxo 9).');
      return;
    }
    if (Number(accForm.weightVal) <= 0 || !accForm.weightUnit) {
      setAccFormError('Peso unitário deve ser maior que zero e ter unidade informada (Subfluxo 9).');
      return;
    }

    const duplicate = accessories.some(
      (a) => a.code.trim().toLowerCase() === accForm.code.trim().toLowerCase()
    );
    if (duplicate) {
      setAccFormError(
        `Duplicidade detectada (UC03 Exceção 3a): Já existe um acessório cadastrado com a identificação "${accForm.code.trim()}".`
      );
      registerAuditLog('UC03 — Acessórios', `Tentativa recusada por duplicidade de código: ${accForm.code.trim()}.`);
      return;
    }

    const stdCapTons =
      accForm.capacityUnit === 'kg' || accForm.capacityUnit === 'kgf'
        ? Number(accForm.capacityVal) / 1000
        : Number(accForm.capacityVal);
    const stdWeightKg =
      accForm.weightUnit === 't'
        ? Number(accForm.weightVal) * 1000
        : Number(accForm.weightVal);

    const today = new Date().toLocaleDateString('pt-BR');
    const newAcc = {
      id: 'acc-' + Date.now(),
      code: accForm.code.trim().toUpperCase(),
      type: accForm.type,
      description: accForm.description.trim(),
      capacityTons: stdCapTons,
      nominalLabelTons: stdCapTons,
      unitWeightKg: stdWeightKg,
      registeredAt: today,
      registeredByHost: `${activeWs.hostname} (${activeWs.ip})`,
      usesCount: 0,
      maxUsesLimit: Number(accForm.maxUsesLimit) || 30,
      wearStatus: 'OK',
      wearNotes: accForm.wearNotes.trim(),
      history: []
    };

    setAccessories((prev) => [newAcc, ...prev]);
    setSelectedAccForHistory(newAcc);
    setAccFormSuccess(`Acessório ${newAcc.code} cadastrado com início de histórico em ${today}!`);
    registerAuditLog('UC03 — Acessórios', `Cadastrou novo acessório ${newAcc.code} (${newAcc.type}) com cap. ${stdCapTons}t.`);
    setAccForm({
      code: '',
      type: 'Cinta Plana',
      description: '',
      capacityVal: '',
      capacityUnit: 't',
      weightVal: '',
      weightUnit: 'kg',
      maxUsesLimit: 30,
      wearNotes: 'Item novo cadastrado no estoque.'
    });
  };

  const handleDiscardAccessory = (accId) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setAccessories((prev) =>
      prev.map((a) => {
        if (a.id !== accId) return a;
        const updated = {
          ...a,
          wearStatus: 'DESCARTADO',
          discardedAt: today,
          discardedByHost: `${activeWs.hostname} (${activeWs.ip}) — ${activeWs.userName}`,
          wearNotes: `DESCARTADO em ${today} por ${activeWs.userName} (${activeWs.hostname}). Retirado de seleção para novos planos.`
        };
        setSelectedAccForHistory(updated);
        return updated;
      })
    );

    setPlan((prev) => ({
      ...prev,
      selectedSlings: prev.selectedSlings.filter((s) => s.accessoryId !== accId)
    }));

    const target = accessories.find((a) => a.id === accId);
    registerAuditLog('UC04 — Descarte', `Registrou o DESCARTE definitivo do acessório ${target?.code}.`);
  };

  const handleToggleWearAlert = (accId) => {
    setAccessories((prev) =>
      prev.map((a) => {
        if (a.id !== accId || a.wearStatus === 'DESCARTADO') return a;
        const nextStatus = a.wearStatus === 'OK' ? 'ALERTA_DESGASTE' : 'OK';
        const updated = {
          ...a,
          wearStatus: nextStatus,
          wearNotes:
            nextStatus === 'ALERTA_DESGASTE'
              ? `Sinalizado com alerta de desgaste por ${activeWs.userName} (${activeWs.hostname}).`
              : `Inspeção revalidada como OK por ${activeWs.userName} (${activeWs.hostname}).`
        };
        setSelectedAccForHistory(updated);
        return updated;
      })
    );
  };

  // --------------------------------------------------------------------------
  // UC07 — ORGANIZAR DADOS PARA A ART (FLUXO 8 / SUBFLUXO 14)
  // --------------------------------------------------------------------------
  const handleGenerateInternalArtOrganization = () => {
    if (!plan.assignedInternalArtNumber) {
      const nextArt = lastArtSeq + 1;
      setLastArtSeq(nextArt);
      const formattedArtControl = `ART-INT-${nextArt}`;
      setPlan((prev) => ({ ...prev, assignedInternalArtNumber: formattedArtControl }));
      registerAuditLog(
        'UC07 — Organizar ART',
        `Gerou organização e numeração sequencial interna ${formattedArtControl} para transcrição no Portal CREA-PR.`
      );
    } else {
      registerAuditLog(
        'UC07 — Organizar ART',
        `Consultou dados organizados da ART (${plan.assignedInternalArtNumber}).`
      );
    }
  };

  const copyToClipboard = (label, text) => {
    navigator.clipboard.writeText(String(text));
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleAddCustomWorkstation = (e) => {
    e.preventDefault();
    if (!newWsForm.hostname.trim() || !newWsForm.ip.trim() || !newWsForm.userName.trim()) return;
    const newWs = {
      id: 'ws-' + Date.now(),
      hostname: newWsForm.hostname.trim().toUpperCase(),
      ip: newWsForm.ip.trim(),
      mac: '00:1B:44:FE:DC:BA',
      userName: newWsForm.userName.trim(),
      role: newWsForm.role,
      crea: newWsForm.crea.trim() || 'Equipe Interna Guindastes Ribas',
      department: 'Rede Interna Local'
    };
    setWorkstations((prev) => [...prev, newWs]);
    setActiveWsId(newWs.id);
    setCustomHostModal(false);
    registerAuditLog(
      'Sistema / Rede',
      `Nova estação mapeada por Hostname/IP: ${newWs.hostname} (${newWs.ip}) — ${newWs.userName}.`,
      newWs
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* =====================================================================
          BARRA SUPERIOR DE REDE LOCAL (SEM LOGIN — IDENTIFICAÇÃO POR HOST E IP)
          ===================================================================== */}
      <header className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Identidade da Empresa */}
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg font-black text-lg tracking-tighter flex items-center gap-1">
              <Shield className="w-5 h-5" />
              GR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight">GUINDASTES RIBAS LTDA.</h1>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                  Web Local v2.0 (Out/2026)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sistema Centralizado de Plano de Rigging • Conformidade NR-11 e NR-12 • Sem Integração Externa (R01/R02)
              </p>
            </div>
          </div>

          {/* Seletor / Detector de Estação por Nome da Máquina e IP */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
            <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Monitor className="w-4 h-4 text-amber-400" />
              <div className="text-xs">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Acesso por Máquina / IP (Host Local: {detectedBrowserHost})
                </div>
                <div className="font-mono font-bold text-emerald-300">
                  {activeWs.hostname} • {activeWs.ip}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={activeWsId}
                onChange={(e) => {
                  const nextWs = workstations.find((w) => w.id === e.target.value);
                  setActiveWsId(e.target.value);
                  if (nextWs) {
                    registerAuditLog(
                      'Identificação de Rede',
                      `Alternou estação ativa para ${nextWs.hostname} (${nextWs.ip}) — Operador: ${nextWs.userName} (${nextWs.role}).`,
                      nextWs
                    );
                  }
                }}
                className="bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-600 focus:outline-none focus:border-amber-400"
                title="Simular ou alternar acesso de outra máquina/IP na rede da Guindastes Ribas"
              >
                {workstations.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    [{ws.hostname} | {ws.ip}] {ws.userName} ({ws.role})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setCustomHostModal(true)}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                title="Configurar ou adicionar máquina/IP personalizado"
              >
                <Network className="w-3.5 h-3.5 text-amber-400" />
                + Máquina/IP
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Navegação dos Casos de Uso (UC02 a UC07 + Auditoria de IP) */}
        <div className="bg-slate-950/80 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 py-2">
            <nav className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTab('uc05')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'uc05'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                UC05 & UC06: Elaborar e Emitir Plano (PDF)
              </button>

              <button
                onClick={() => setActiveTab('uc02')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'uc02'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                UC02: Guindastes e Tabelas ({cranes.length})
              </button>

              <button
                onClick={() => setActiveTab('uc03_04')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'uc03_04'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                UC03 & UC04: Acessórios, Histórico e Descarte ({accessories.length})
              </button>

              <button
                onClick={() => {
                  setActiveTab('uc07');
                  handleGenerateInternalArtOrganization();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'uc07'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                UC07: Organizar Dados p/ ART (CREA-PR)
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'audit'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Histórico de Acessos por Máquina/IP ({auditLogs.length})
              </button>
            </nav>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                Plano Atual:{' '}
                <strong className="text-amber-400 font-mono">
                  {plan.assignedPlanNumber ? `Nº ${plan.assignedPlanNumber}` : 'A gerar na emissão (Subfluxo 14)'}
                </strong>
              </span>
              <button
                onClick={handleEmitPdf}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Emitir PDF Consolidado (UC06)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MODAL DE ALERTA DE DESGASTE DE ACESSÓRIO (SUBFLUXO 11 — PASSO 11.6)
          ===================================================================== */}
      {wearWarningModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border-2 border-amber-500">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Alerta de Desgaste de Acessório (Subfluxo 11 — Passo 11.6)
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  O acessório <strong className="font-mono">{wearWarningModal.code}</strong> ({wearWarningModal.description}) atingiu um critério de alerta definido pela empresa:
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 text-xs text-amber-900">
                  <p className="font-semibold">Ciclos de uso: {wearWarningModal.usesCount} / {wearWarningModal.maxUsesLimit}</p>
                  <p className="mt-0.5">{wearWarningModal.wearNotes}</p>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Deseja manter a seleção deste acessório no Plano de Rigging atual (com registro de alerta no log da máquina <span className="font-mono font-semibold">{activeWs.hostname}</span>)?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
              <button
                onClick={() => setWearWarningModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800"
              >
                Cancelar Seleção (Passo 11.9)
              </button>
              <button
                onClick={() => handleAddAccessoryToPlan(wearWarningModal.id, true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950"
              >
                Manter Acessório com Alerta (Passo 11.8)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL PARA ADICIONAR/SIMULAR NOVA MÁQUINA E IP NA REDE LOCAL
          ===================================================================== */}
      {customHostModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-300">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Network className="w-5 h-5 text-amber-600" />
              Mapear Estação de Trabalho (Nome da Máquina + IP)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Como o sistema não utiliza tela de login tradicional, cada acesso e ação é vinculado automaticamente ao Hostname, IP e operador da máquina na rede interna.
            </p>
            <form onSubmit={handleAddCustomWorkstation} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nome da Máquina (Hostname)</label>
                <input
                  type="text"
                  placeholder="Ex: RIBAS-ENG-WS04"
                  value={newWsForm.hostname}
                  onChange={(e) => setNewWsForm({ ...newWsForm, hostname: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Endereço IP na Rede Local</label>
                <input
                  type="text"
                  placeholder="Ex: 192.168.1.155"
                  value={newWsForm.ip}
                  onChange={(e) => setNewWsForm({ ...newWsForm, ip: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Responsável / Operador da Máquina</label>
                <input
                  type="text"
                  placeholder="Ex: Eduardo Luciano"
                  value={newWsForm.userName}
                  onChange={(e) => setNewWsForm({ ...newWsForm, userName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Perfil Operacional (Atores do Sistema)</label>
                <select
                  value={newWsForm.role}
                  onChange={(e) => setNewWsForm({ ...newWsForm, role: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5"
                >
                  <option value="Engenheiro Planejador">Engenheiro Planejador</option>
                  <option value="Rigger">Rigger</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomHostModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold"
                >
                  Ativar Máquina/IP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONTEÚDO PRINCIPAL (OCULTO NA IMPRESSÃO A4)
          ===================================================================== */}
      <main className="max-w-7xl mx-auto px-4 py-5 print:hidden">
        {/* Banner de Feedback de Emissão ou Validação */}
        {emissionFeedback && (
          <div
            className={`mb-4 p-4 rounded-xl border flex items-start justify-between gap-3 ${
              emissionFeedback.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {emissionFeedback.type === 'error' ? (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <h4 className="font-bold text-sm">{emissionFeedback.title}</h4>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {emissionFeedback.messages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              onClick={() => setEmissionFeedback(null)}
              className="text-xs font-bold underline opacity-75 hover:opacity-100"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ===================================================================
            ABA 1: UC05 (ELABORAR PLANO) + UC06 (PREVIEW E EMISSÃO PDF)
            =================================================================== */}
        {activeTab === 'uc05' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUNA ESQUERDA: INPUTS DO PLANO (UC05 / SUBFLUXOS 9, 10, 11, 12, 13) */}
            <div className="lg:col-span-6 space-y-4">
              {/* 1. Cabeçalho e Numeração Sequencial (RF01 / RF10) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-600" />
                      1. Dados do Serviço e Numeração Sequencial (RF01 / RF10)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Dados digitados a cada novo trabalho sem importação externa (RN04 / P6).
                    </p>
                  </div>
                  <button
                    onClick={handleStartNewPlan}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Novo Plano (Do Zero)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Nº Sequencial do Plano (Subfluxo 14)
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {plan.assignedPlanNumber
                        ? `Nº ${plan.assignedPlanNumber}`
                        : `Próximo: Nº ${lastPlanSeq + 1} (Ao emitir)`}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Estação Atual Vinculada
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {activeWs.hostname} ({activeWs.ip})
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Cliente Contratante *</label>
                    <input
                      type="text"
                      value={plan.clientName}
                      onChange={(e) => setPlan({ ...plan, clientName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                      placeholder="Ex: Kaefer Rip Serviços Industriais Ltda."
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">CNPJ do Contratante</label>
                    <input
                      type="text"
                      value={plan.clientCnpj}
                      onChange={(e) => setPlan({ ...plan, clientCnpj: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Data do Serviço</label>
                    <input
                      type="date"
                      value={plan.date}
                      onChange={(e) => setPlan({ ...plan, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Local da Obra / Site *</label>
                    <input
                      type="text"
                      value={plan.serviceSite}
                      onChange={(e) => setPlan({ ...plan, serviceSite: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                      placeholder="Ex: Curitiba / Site Bosch"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Carga e Padronização de Unidades (Subfluxo 9) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 mb-3">
                  2. Dados da Carga com Unidade Obrigatória (RF01 / Subfluxo 9)
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Descrição da Carga *</label>
                    <input
                      type="text"
                      value={plan.loadDescription}
                      onChange={(e) => setPlan({ ...plan, loadDescription: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Nome da Operação (Procedimento)</label>
                    <input
                      type="text"
                      value={plan.operationName}
                      onChange={(e) => setPlan({ ...plan, operationName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Peso da Carga (Carga Líquida) *</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={plan.netWeightVal}
                        onChange={(e) => setPlan({ ...plan, netWeightVal: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                      />
                      <select
                        value={plan.netWeightUnit}
                        onChange={(e) => setPlan({ ...plan, netWeightUnit: e.target.value })}
                        className="bg-slate-100 border border-slate-300 rounded-lg px-2 font-bold text-slate-800"
                      >
                        <option value="kg">kg</option>
                        <option value="t">t</option>
                        <option value="kgf">kgf</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-mono">
                      Padrão convertido: {calculations.netLoadKg.toFixed(2)} kg ({(calculations.netLoadKg / 1000).toFixed(3)} t)
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Cargas Extras Adicionais</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={plan.extraWeightVal}
                        onChange={(e) => setPlan({ ...plan, extraWeightVal: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                      />
                      <select
                        value={plan.extraWeightUnit}
                        onChange={(e) => setPlan({ ...plan, extraWeightUnit: e.target.value })}
                        className="bg-slate-100 border border-slate-300 rounded-lg px-2 font-bold text-slate-800"
                      >
                        <option value="kg">kg</option>
                        <option value="t">t</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Comprimento *</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={plan.lengthVal}
                          onChange={(e) => setPlan({ ...plan, lengthVal: e.target.value })}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                        />
                        <select
                          value={plan.lengthUnit}
                          onChange={(e) => setPlan({ ...plan, lengthUnit: e.target.value })}
                          className="bg-slate-100 border border-slate-300 rounded-lg px-1.5 font-semibold"
                        >
                          <option value="m">m</option>
                          <option value="cm">cm</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Largura *</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={plan.widthVal}
                          onChange={(e) => setPlan({ ...plan, widthVal: e.target.value })}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                        />
                        <select
                          value={plan.widthUnit}
                          onChange={(e) => setPlan({ ...plan, widthUnit: e.target.value })}
                          className="bg-slate-100 border border-slate-300 rounded-lg px-1.5 font-semibold"
                        >
                          <option value="m">m</option>
                          <option value="cm">cm</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Altura *</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={plan.heightVal}
                          onChange={(e) => setPlan({ ...plan, heightVal: e.target.value })}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                        />
                        <select
                          value={plan.heightUnit}
                          onChange={(e) => setPlan({ ...plan, heightUnit: e.target.value })}
                          className="bg-slate-100 border border-slate-300 rounded-lg px-1.5 font-semibold"
                        >
                          <option value="m">m</option>
                          <option value="cm">cm</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Guindaste e Interpolação Automática (Subfluxo 10) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 mb-3">
                  3. Seleção do Guindaste e Interpolação da Tabela (RF02 / RF03 / R05)
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Guindaste Cadastrado (UC02)</label>
                    <select
                      value={plan.selectedCraneId}
                      onChange={(e) => {
                        const cr = cranes.find((c) => c.id === e.target.value);
                        setPlan({
                          ...plan,
                          selectedCraneId: e.target.value,
                          columnDistA: cr ? cr.defaultColumnDistA : plan.columnDistA,
                          outriggerSpanB: cr ? cr.defaultOutriggerSpanB : plan.outriggerSpanB
                        });
                      }}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 font-semibold bg-slate-50"
                    >
                      {cranes.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.code}] {c.model} — Cap. Nominal {c.nominalCapacityTons}t ({c.truck} | Placa {c.plate})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Raio de Operação (m) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={plan.operatingRadiusM}
                        onChange={(e) => setPlan({ ...plan, operatingRadiusM: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Comp. Lança (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={plan.boomLengthM}
                        onChange={(e) => setPlan({ ...plan, boomLengthM: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Raio Isolamento (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={plan.isolationRadiusM}
                        onChange={(e) => setPlan({ ...plan, isolationRadiusM: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border ${
                      !interpolationResult.valid
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : interpolationResult.status === 'INTERPOLADA'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        Status Subfluxo 10:{' '}
                        <span className="uppercase px-1.5 py-0.5 rounded bg-white/80 font-mono text-[11px]">
                          {interpolationResult.status}
                        </span>
                      </span>
                      {interpolationResult.valid && (
                        <span className="font-mono text-sm">
                          Cap.: {interpolationResult.capacityKgf} kgf ({interpolationResult.capacityTons.toFixed(2)} t)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-1">{interpolationResult.message}</p>
                  </div>
                </div>
              </div>

              {/* 4. Seleção de Acessórios e Dispositivos Adicionais */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 mb-3">
                  4. Lingadas / Acessórios Cadastrados e Balancim (RF04 / RF05 / Subfluxo 11)
                </h2>

                <div className="mb-3">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Adicionar Acessório do Banco Fixo (Itens descartados são ocultados automaticamente):
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="select-acc-to-add"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Selecione uma cinta, manilha ou laço cadastrado...
                      </option>
                      {accessories
                        .filter((a) => a.wearStatus !== 'DESCARTADO')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            [{a.code}] {a.description} — Peso: {a.unitWeightKg}kg | Cap: {a.capacityTons}t{' '}
                            {a.wearStatus === 'ALERTA_DESGASTE' ? '⚠️ [ALERTA DE DESGASTE]' : '✓ [OK]'}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById('select-acc-to-add');
                        if (sel && sel.value) handleAddAccessoryToPlan(sel.value);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Incluir
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {calculations.slingDetails.map((item) => (
                    <div
                      key={item.rowId}
                      className={`p-2.5 rounded-lg border text-xs ${
                        item.isOverLimit
                          ? 'bg-red-50 border-red-300'
                          : item.accessory.wearStatus === 'ALERTA_DESGASTE'
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900">
                          <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-[11px] mr-1.5">
                            {item.accessory.code}
                          </span>
                          {item.accessory.description}
                          {item.accessory.wearStatus === 'ALERTA_DESGASTE' && (
                            <span className="ml-1.5 text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              ⚠️ Alerta Desgaste
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveSlingRow(item.rowId)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Remover acessório do plano"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-2 items-center">
                        <div>
                          <label className="text-[10px] text-slate-500 block">Qtd. (pç)</label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdateSlingRow(item.rowId, 'qty', Number(e.target.value))}
                            className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Ângulo α (°)</label>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={item.angleDeg}
                            onChange={(e) => handleUpdateSlingRow(item.rowId, 'angleDeg', Number(e.target.value))}
                            className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Peso Total</label>
                          <span className="font-mono font-semibold block py-1">
                            {item.totalItemWeightKg.toFixed(2)} kg
                          </span>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Taxa Utiliz. (TU)</label>
                          <span
                            className={`font-mono font-bold block py-1 ${
                              item.isOverLimit ? 'text-red-600' : 'text-emerald-700'
                            }`}
                          >
                            {item.utilizationPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.useBalancim}
                      onChange={(e) => setPlan({ ...plan, useBalancim: e.target.checked })}
                      className="rounded"
                    />
                    Utilizar Dispositivo Adicional / Balancim (Passo 6.13)
                  </label>

                  {plan.useBalancim && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">Peso Unit.:</span>
                      <input
                        type="number"
                        value={plan.balancimUnitWeightVal}
                        onChange={(e) => setPlan({ ...plan, balancimUnitWeightVal: e.target.value })}
                        className="w-20 border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                      <select
                        value={plan.balancimWeightUnit}
                        onChange={(e) => setPlan({ ...plan, balancimWeightUnit: e.target.value })}
                        className="border border-slate-300 rounded px-1.5 py-1 bg-slate-100 font-bold"
                      >
                        <option value="kg">kg</option>
                        <option value="t">t</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Patolamento, Esforço nas Sapatas e RMET */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 mb-3">
                  5. Patolamento, Esforço nas Sapatas e RMET (RF08 / Subfluxo 13)
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Dist. Coluna a (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={plan.columnDistA}
                      onChange={(e) => setPlan({ ...plan, columnDistA: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Abertura Sapatas b (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={plan.outriggerSpanB}
                      onChange={(e) => setPlan({ ...plan, outriggerSpanB: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Comp. Dormente (cm)</label>
                    <input
                      type="number"
                      value={plan.sleeperLengthCm}
                      onChange={(e) => setPlan({ ...plan, sleeperLengthCm: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Larg. Dormente (cm)</label>
                    <input
                      type="number"
                      value={plan.sleeperWidthCm}
                      onChange={(e) => setPlan({ ...plan, sleeperWidthCm: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Qtd. Dormentes (ND)</label>
                    <input
                      type="number"
                      min="1"
                      value={plan.sleeperCount}
                      onChange={(e) => setPlan({ ...plan, sleeperCount: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Área Patolamento (AP)</span>
                    <span className="font-mono font-bold text-slate-900">{calculations.patolamentoAreaCm2} cm²</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Esforço Sapatas (ES)</span>
                    <span className="font-mono font-bold text-slate-900">{calculations.outriggerEffortEsKgf} kgf</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">RMET Calculada</span>
                    <span className="font-mono font-bold text-amber-700">
                      {calculations.rmetKgfCm2.toFixed(2)} kgf/cm²
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Parametrização dos Pontos em Aberto (Documento de Fluxos / Escopo v1.0):
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.blockPdfOnOverload}
                      onChange={(e) => setPlan({ ...plan, blockPdfOnOverload: e.target.checked })}
                    />
                    <span>
                      Bloquear emissão do PDF caso alguma Taxa de Utilização ultrapasse 85% (Desmarcado = Apenas sinalizar conforme Passo 6.18)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.includeTechnicalDrawings}
                      onChange={(e) => setPlan({ ...plan, includeTechnicalDrawings: e.target.checked })}
                    />
                    <span>Incluir Pranchas Técnicas e Laudo de Inspeção na compilação do PDF</span>
                  </label>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PREVIEW EM TEMPO REAL */}
            <div className="lg:col-span-6 space-y-4">
              {calculations.overloadedItems.length > 0 && (
                <div className="bg-red-600 text-white p-3.5 rounded-xl shadow-lg flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h3 className="font-bold text-sm">
                      SINALIZAÇÃO CRÍTICA: Taxa de Utilização Acima do Limite de 85% (UC05 Passo 6.18)
                    </h3>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono">
                      {calculations.overloadedItems.map((it, idx) => (
                        <li key={idx}>{it}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-md border border-slate-300 p-5 text-xs space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <div>
                    <h3 className="font-black text-base tracking-tight text-slate-900">
                      GUINDASTES RIBAS LTDA.
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      PLANO DE RIGGING PADRONIZADO (CONFORMIDADE NR-11 E NR-12)
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <div className="bg-slate-900 text-amber-400 font-bold px-2.5 py-1 rounded text-xs">
                      PLANO Nº {plan.assignedPlanNumber || 'PENDENTE (EMITIR)'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Data: {plan.date.split('-').reverse().join('/')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">CLIENTE:</span>
                    <strong className="text-slate-900">{plan.clientName || '---'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">LOCAL / OBRA:</span>
                    <strong className="text-slate-900">{plan.serviceSite || '---'}</strong>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-[11px] uppercase bg-slate-800 text-white px-2.5 py-1">
                    Dados da Carga (Unidades Padronizadas — Subfluxo 9)
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 p-1.5">Descrição</th>
                        <th className="border border-slate-300 p-1.5">Comp. (m)</th>
                        <th className="border border-slate-300 p-1.5">Largura (m)</th>
                        <th className="border border-slate-300 p-1.5">Altura (m)</th>
                        <th className="border border-slate-300 p-1.5">Peso Líquido (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-mono font-semibold">
                        <td className="border border-slate-300 p-1.5 font-sans">{plan.loadDescription}</td>
                        <td className="border border-slate-300 p-1.5">{calculations.stdLengthM.toFixed(2)}</td>
                        <td className="border border-slate-300 p-1.5">{calculations.stdWidthM.toFixed(2)}</td>
                        <td className="border border-slate-300 p-1.5">{calculations.stdHeightM.toFixed(2)}</td>
                        <td className="border border-slate-300 p-1.5">{calculations.netLoadKg.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="font-bold text-[11px] uppercase bg-slate-800 text-white px-2.5 py-1">
                    Lingada / Amarras e Dispositivos (RF04 / RF06)
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-left">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 p-1.5">Código</th>
                        <th className="border border-slate-300 p-1.5">Descrição</th>
                        <th className="border border-slate-300 p-1.5 text-center">Qtd</th>
                        <th className="border border-slate-300 p-1.5 text-right">Unit. (kg)</th>
                        <th className="border border-slate-300 p-1.5 text-right">Total (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations.slingDetails.map((s) => (
                        <tr key={s.rowId}>
                          <td className="border border-slate-300 p-1.5 font-mono text-[11px]">{s.accessory.code}</td>
                          <td className="border border-slate-300 p-1.5">{s.accessory.description}</td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{s.qty}</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {s.accessory.unitWeightKg.toFixed(2)}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-semibold">
                            {s.totalItemWeightKg.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={4} className="border border-slate-300 p-1.5 text-right">
                          PESO TOTAL DA LINGADA / AMARRAÇÃO:
                        </td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">
                          {calculations.totalSlingsWeightKg.toFixed(2)} kg
                        </td>
                      </tr>
                      {plan.useBalancim && (
                        <tr className="bg-slate-50 font-bold">
                          <td colSpan={4} className="border border-slate-300 p-1.5 text-right">
                            DISPOSITIVO ADICIONAL ({plan.balancimDesc}):
                          </td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {calculations.balancimTotalKg.toFixed(2)} kg
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="font-bold text-[11px] uppercase bg-slate-800 text-white px-2.5 py-1">
                      Composição da Carga Bruta (RF06)
                    </div>
                    <table className="w-full border-collapse border border-slate-300">
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 p-1.5">Carga Líquida</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {calculations.netLoadKg.toFixed(2)} kg
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-1.5">Lingada / Amarração</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {calculations.totalSlingsWeightKg.toFixed(2)} kg
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-1.5">Dispositivos / Balancim</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {calculations.balancimTotalKg.toFixed(2)} kg
                          </td>
                        </tr>
                        <tr className="bg-amber-50 font-bold">
                          <td className="border border-slate-300 p-1.5">CARGA BRUTA TOTAL</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono text-slate-900">
                            {calculations.grossLoadKg.toFixed(0)} kg ({calculations.grossLoadTons.toFixed(2)} t)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="font-bold text-[11px] uppercase bg-slate-800 text-white px-2.5 py-1">
                      Resumo dos Cálculos (RF07 / RF08)
                    </div>
                    <table className="w-full border-collapse border border-slate-300">
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 p-1.5">
                            Cap. Guindaste ({interpolationResult.status})
                          </td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">
                            {calculations.craneCapTons.toFixed(2)} t
                          </td>
                        </tr>
                        <tr className={calculations.craneUtilizationPct > 85 ? 'bg-red-100 font-bold text-red-800' : ''}>
                          <td className="border border-slate-300 p-1.5">Taxa Utiliz. Guindaste</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">
                            {calculations.craneUtilizationPct.toFixed(1)}%
                          </td>
                        </tr>
                        <tr className={calculations.maxCintaPlanaPct > 85 ? 'bg-red-100 font-bold text-red-800' : ''}>
                          <td className="border border-slate-300 p-1.5">Taxa Utiliz. Cinta Plana</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {calculations.maxCintaPlanaPct.toFixed(1)}%
                          </td>
                        </tr>
                        <tr className={calculations.maxManilhaPct > 85 ? 'bg-red-100 font-bold text-red-800' : ''}>
                          <td className="border border-slate-300 p-1.5">Taxa Utiliz. Manilha</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {calculations.maxManilhaPct.toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-1.5">Esforço nas Sapatas</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-semibold">
                            {calculations.outriggerEffortEsKgf} kgf
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-1.5">Resistência Mín. Terreno (RMET)</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-bold text-amber-800">
                            {calculations.rmetKgfCm2.toFixed(2)} kgf/cm²
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Responsável na Estação: <strong>{activeWs.userName}</strong> ({activeWs.role})
                  </span>
                  <span className="font-mono">
                    Máquina: {activeWs.hostname} | IP: {activeWs.ip}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            ABA 2: UC02 — CADASTRAR E EDITAR GUINDASTE E TABELA DE CARGA
            =================================================================== */}
        {activeTab === 'uc02' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  Frota Cadastrada e Tabelas de Carga (UC02)
                </h2>
                <div className="space-y-3">
                  {cranes.map((cr) => (
                    <div
                      key={cr.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:border-amber-400 transition text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">
                          [{cr.code}] {cr.model}
                        </span>
                        <button
                          onClick={() => handleLoadCraneForEdit(cr)}
                          className="bg-amber-500/20 text-amber-900 hover:bg-amber-500/30 font-semibold px-2.5 py-1 rounded flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar Tabela (Passo 3.2a)
                        </button>
                      </div>
                      <p className="text-slate-600 mt-1">
                        {cr.truck} • Placa: <span className="font-mono">{cr.plate}</span> • Cap. Nominal:{' '}
                        <strong>{cr.nominalCapacityTons} t</strong> • Peso Próprio (Pg):{' '}
                        <span className="font-mono">{cr.selfWeightKgf} kgf</span>
                      </p>
                      <div className="mt-2 bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Tabela do Fabricante ({cr.loadTable.length} pontos cadastrados):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cr.loadTable.map((pt, i) => (
                            <span
                              key={i}
                              className="font-mono text-[11px] bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded"
                            >
                              R={pt.radiusM}m → {pt.capacityKgf}kgf
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-1.5 text-[10px] text-slate-400 font-mono">
                        Última gravação por: {cr.createdByHost}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <form
                onSubmit={handleSaveCrane}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {editingCraneId
                        ? 'Editar Guindaste e Tabela de Carga Existente (Fluxo Alternativo 1a)'
                        : 'Cadastrar Novo Guindaste e Tabela do Fabricante (UC02 — Fluxo Principal)'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Valida valores numéricos, unidades obrigatórias e bloqueia raios repetidos (Passo 3.6).
                    </p>
                  </div>
                  {editingCraneId && (
                    <button
                      type="button"
                      onClick={() => setEditingCraneId(null)}
                      className="text-xs bg-slate-200 px-2.5 py-1 rounded font-semibold"
                    >
                      Novo Cadastro
                    </button>
                  )}
                </div>

                {craneFormErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-300 text-red-900 p-3 rounded-lg">
                    <div className="font-bold mb-1">
                      Cadastro Recusado — Tabela ou Dados Inconsistentes (Fluxo de Exceção 4a/4b):
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {craneFormErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {craneFormSuccess && (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-lg font-semibold">
                    {craneFormSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Código Frota *</label>
                    <input
                      type="text"
                      placeholder="Ex: GR-03"
                      value={craneForm.code}
                      onChange={(e) => setCraneForm({ ...craneForm, code: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Modelo do Guindaste *</label>
                    <input
                      type="text"
                      placeholder="Ex: Palfinger MD 55"
                      value={craneForm.model}
                      onChange={(e) => setCraneForm({ ...craneForm, model: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Caminhão Base</label>
                    <input
                      type="text"
                      value={craneForm.truck}
                      onChange={(e) => setCraneForm({ ...craneForm, truck: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Placas</label>
                    <input
                      type="text"
                      value={craneForm.plate}
                      onChange={(e) => setCraneForm({ ...craneForm, plate: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Capacidade Nominal *</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={craneForm.nominalCapacityTons}
                        onChange={(e) => setCraneForm({ ...craneForm, nominalCapacityTons: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                      />
                      <select
                        value={craneForm.nominalUnit}
                        onChange={(e) => setCraneForm({ ...craneForm, nominalUnit: e.target.value })}
                        className="bg-slate-100 border border-slate-300 rounded px-2 font-bold"
                      >
                        <option value="t">t</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Peso Próprio Pg (Caminhão+Guindaste) *</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={craneForm.selfWeightVal}
                        onChange={(e) => setCraneForm({ ...craneForm, selfWeightVal: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                      />
                      <select
                        value={craneForm.selfWeightUnit}
                        onChange={(e) => setCraneForm({ ...craneForm, selfWeightUnit: e.target.value })}
                        className="bg-slate-100 border border-slate-300 rounded px-2 font-bold"
                      >
                        <option value="kgf">kgf</option>
                        <option value="t">t</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800">
                      Tabela de Carga do Fabricante (Raio x Capacidade com Unidade Obrigatória):
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCraneForm({
                          ...craneForm,
                          loadTable: [
                            ...craneForm.loadTable,
                            { radiusM: '', radiusUnit: 'm', boomM: 5.1, capacityVal: '', capacityUnit: 'kgf' }
                          ]
                        })
                      }
                      className="bg-slate-800 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Raio
                    </button>
                  </div>

                  <div className="space-y-2">
                    {craneForm.loadTable.map((row, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded border">
                        <div className="col-span-4">
                          <label className="text-[10px] text-slate-500 block">Raio de Operação *</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={row.radiusM}
                              onChange={(e) => {
                                const updated = [...craneForm.loadTable];
                                updated[index].radiusM = e.target.value;
                                setCraneForm({ ...craneForm, loadTable: updated });
                              }}
                              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                            />
                            <select
                              value={row.radiusUnit}
                              onChange={(e) => {
                                const updated = [...craneForm.loadTable];
                                updated[index].radiusUnit = e.target.value;
                                setCraneForm({ ...craneForm, loadTable: updated });
                              }}
                              className="border border-slate-300 rounded px-1.5 bg-white font-bold"
                            >
                              <option value="m">m</option>
                              <option value="cm">cm</option>
                            </select>
                          </div>
                        </div>

                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-500 block">Lança (m)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={row.boomM}
                            onChange={(e) => {
                              const updated = [...craneForm.loadTable];
                              updated[index].boomM = e.target.value;
                              setCraneForm({ ...craneForm, loadTable: updated });
                            }}
                            className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="text-[10px] text-slate-500 block">Capacidade Tabela *</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="1"
                              value={row.capacityVal}
                              onChange={(e) => {
                                const updated = [...craneForm.loadTable];
                                updated[index].capacityVal = e.target.value;
                                setCraneForm({ ...craneForm, loadTable: updated });
                              }}
                              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                            />
                            <select
                              value={row.capacityUnit}
                              onChange={(e) => {
                                const updated = [...craneForm.loadTable];
                                updated[index].capacityUnit = e.target.value;
                                setCraneForm({ ...craneForm, loadTable: updated });
                              }}
                              className="border border-slate-300 rounded px-1.5 bg-white font-bold"
                            >
                              <option value="kgf">kgf</option>
                              <option value="t">t</option>
                            </select>
                          </div>
                        </div>

                        <div className="col-span-1 text-right pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              setCraneForm({
                                ...craneForm,
                                loadTable: craneForm.loadTable.filter((_, idx) => idx !== index)
                              })
                            }
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg shadow"
                  >
                    Validar e Salvar Guindaste + Tabela (UC02 Passo 3.9)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================
            ABA 3: UC03 E UC04 — ACESSÓRIOS, HISTÓRICO, DESGASTE E DESCARTE
            =================================================================== */}
        {activeTab === 'uc03_04' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <form
                onSubmit={handleSaveAccessory}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 text-xs"
              >
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-600" />
                  UC03 — Cadastrar Acessório de Içamento
                </h2>
                <p className="text-[11px] text-slate-500">
                  Verifica duplicidade de código (Passo 4.6) e inicia o histórico na data atual (Passo 4.8).
                </p>

                {accFormError && (
                  <div className="bg-red-50 border border-red-300 text-red-900 p-2.5 rounded-lg font-medium">
                    {accFormError}
                  </div>
                )}
                {accFormSuccess && (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-2.5 rounded-lg font-medium">
                    {accFormSuccess}
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tipo de Acessório *</label>
                  <select
                    value={accForm.type}
                    onChange={(e) => setAccForm({ ...accForm, type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold"
                  >
                    <option value="Cinta Plana">Cinta Plana</option>
                    <option value="Cinta Tubular">Cinta Tubular</option>
                    <option value="Manilha">Manilha</option>
                    <option value="Laço de Cabo de Aço">Laço de Cabo de Aço</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Identificação Única do Item (Patrimônio/Série) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CP-3M-6T-01 (Tente repetir para testar Exceção 3a)"
                    value={accForm.code}
                    onChange={(e) => setAccForm({ ...accForm, code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Descrição Técnica *</label>
                  <input
                    type="text"
                    placeholder="Ex: Cinta plana 6m - Capacidade 10t"
                    value={accForm.description}
                    onChange={(e) => setAccForm({ ...accForm, description: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Capacidade *</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={accForm.capacityVal}
                        onChange={(e) => setAccForm({ ...accForm, capacityVal: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                      />
                      <select
                        value={accForm.capacityUnit}
                        onChange={(e) => setAccForm({ ...accForm, capacityUnit: e.target.value })}
                        className="bg-slate-100 border border-slate-300 rounded-lg px-1.5 font-bold"
                      >
                        <option value="t">t</option>
                        <option value="kgf">kgf</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Peso Unitário *</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={accForm.weightVal}
                        onChange={(e) => setAccForm({ ...accForm, weightVal: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                      />
                      <select
                        value={accForm.weightUnit}
                        onChange={(e) => setAccForm({ ...accForm, weightUnit: e.target.value })}
                        className="bg-slate-100 border border-slate-300 rounded-lg px-1.5 font-bold"
                      >
                        <option value="kg">kg</option>
                        <option value="t">t</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Critério de Alerta (Limite de Ciclos de Içamento)
                  </label>
                  <input
                    type="number"
                    value={accForm.maxUsesLimit}
                    onChange={(e) => setAccForm({ ...accForm, maxUsesLimit: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg transition"
                >
                  Salvar Acessório e Iniciar Histórico (UC03)
                </button>
              </form>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  UC04 — Acompanhar Histórico, Alertas de Desgaste e Registrar Descarte (RF04 / RF05)
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {accessories.map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccForHistory(acc)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        selectedAccForHistory?.id === acc.id ? 'ring-2 ring-amber-500 ' : ''
                      }${
                        acc.wearStatus === 'DESCARTADO'
                          ? 'bg-slate-100 border-slate-300 opacity-75'
                          : acc.wearStatus === 'ALERTA_DESGASTE'
                          ? 'bg-amber-50 border-amber-400'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-slate-900">{acc.code}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            acc.wearStatus === 'DESCARTADO'
                              ? 'bg-red-200 text-red-900'
                              : acc.wearStatus === 'ALERTA_DESGASTE'
                              ? 'bg-amber-300 text-amber-950'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {acc.wearStatus === 'DESCARTADO'
                            ? 'DESCARTADO (Inativo)'
                            : acc.wearStatus === 'ALERTA_DESGASTE'
                            ? '⚠️ Alerta Desgaste'
                            : '✓ Em Condições (OK)'}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 mt-1">{acc.description}</p>
                      <p className="text-slate-500 mt-0.5 font-mono text-[11px]">
                        Cap: {acc.capacityTons}t | Peso: {acc.unitWeightKg}kg | Ciclos: {acc.usesCount}/{acc.maxUsesLimit}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 italic">{acc.wearNotes}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedAccForHistory && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Ficha de Rastreabilidade e Histórico: <span className="font-mono">{selectedAccForHistory.code}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Cadastrado em {selectedAccForHistory.registeredAt} por {selectedAccForHistory.registeredByHost}
                      </p>
                    </div>

                    {selectedAccForHistory.wearStatus !== 'DESCARTADO' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleWearAlert(selectedAccForHistory.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold"
                        >
                          {selectedAccForHistory.wearStatus === 'OK'
                            ? 'Sinalizar Alerta de Desgaste'
                            : 'Marcar Inspeção como OK'}
                        </button>
                        <button
                          onClick={() => handleDiscardAccessory(selectedAccForHistory.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Registrar Descarte (UC04 Passo 4a)
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg">
                        Item Descartado em {selectedAccForHistory.discardedAt} — Bloqueado para novos planos
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-700 mb-2">
                    Planos de Rigging em que este acessório foi utilizado ({selectedAccForHistory.history.length}):
                  </h4>
                  {selectedAccForHistory.history.length === 0 ? (
                    <p className="text-slate-500 italic">Nenhum plano emitido com este acessório até o momento.</p>
                  ) : (
                    <table className="w-full border-collapse border border-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="border border-slate-200 p-1.5 text-left">Data</th>
                          <th className="border border-slate-200 p-1.5 text-left">Nº Plano</th>
                          <th className="border border-slate-200 p-1.5 text-left">Cliente / Obra</th>
                          <th className="border border-slate-200 p-1.5 text-left">Máquina / Operador</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAccForHistory.history.map((h, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-200 p-1.5 font-mono">{h.date}</td>
                            <td className="border border-slate-200 p-1.5 font-mono font-bold">Nº {h.planNumber}</td>
                            <td className="border border-slate-200 p-1.5">{h.client}</td>
                            <td className="border border-slate-200 p-1.5 font-mono">
                              {h.host} ({h.user})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            ABA 4: UC07 — ORGANIZAR DADOS PARA A ART (PORTAL CREA-PR MANUAL)
            =================================================================== */}
        {activeTab === 'uc07' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  UC07 — Organização de Dados para Preenchimento Manual da ART no Portal CREA-PR (RF11 / RN03)
                </h2>
                <p className="text-slate-500 mt-0.5">
                  O sistema não possui integração externa com o CREA-PR (R02 / P5). Os dados do plano são validados, numerados e organizados abaixo na ordem exata do formulário oficial para transcrição sem risco de erro.
                </p>
              </div>
              <div className="text-right font-mono bg-slate-900 text-white px-3 py-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Controle Sequencial Interno (Subfluxo 14)</span>
                <strong className="text-amber-400 text-sm">
                  {plan.assignedInternalArtNumber || 'ART-INT-20260042'}
                </strong>
              </div>
            </div>

            {calculations.validationErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 text-amber-950 p-3 rounded-lg">
                <div className="font-bold">
                  Atenção — Dados Insuficientes no Plano para a ART (UC07 Fluxo Alternativo 3a):
                </div>
                <ul className="list-disc list-inside mt-1">
                  {calculations.validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  section: '1. Responsável Técnico',
                  fields: [
                    { label: 'Profissional', value: 'GIULIANO CESAR BREDA DE SOUZA' },
                    { label: 'Registro CREA-PR / RNP', value: 'PR-78755/D | RNP: 1701211920' }
                  ]
                },
                {
                  section: '2. Dados do Contrato',
                  fields: [
                    { label: 'Contratante (Razão Social)', value: plan.clientName },
                    { label: 'CNPJ do Contratante', value: plan.clientCnpj },
                    { label: 'Endereço do Contrato', value: plan.contractAddress },
                    { label: 'Valor do Serviço (R$)', value: `R$ ${plan.contractValueBRL}` }
                  ]
                },
                {
                  section: '3. Dados da Obra / Serviço',
                  fields: [
                    { label: 'Endereço da Obra/Site', value: plan.serviceSite },
                    { label: 'Data de Início / Celebração', value: plan.date.split('-').reverse().join('/') },
                    { label: 'Finalidade', value: 'Industrial' }
                  ]
                },
                {
                  section: '4. Atividade Técnica e 5. Observações',
                  fields: [
                    {
                      label: 'Atividade Técnica',
                      value: '[Desenvolvimento, Detalhamento, Estudo, Planejamento, Projeto] de plano de rigging'
                    },
                    {
                      label: 'Quantidade / Unidade Padronizada (TON)',
                      value: `${(calculations.netLoadKg / 1000).toFixed(2)} TON`
                    },
                    {
                      label: '5. Observações (Texto pronto para colar no CREA-PR)',
                      value: `Plano de Rigging Nº ${plan.assignedPlanNumber || lastPlanSeq + 1} referente a ${plan.operationName} (${plan.loadDescription} - ${(calculations.netLoadKg / 1000).toFixed(2)}t) em ${plan.serviceSite}. Equipamento: ${selectedCrane?.model} / Placa ${selectedCrane?.plate}.`
                    }
                  ]
                }
              ].map((group, gIdx) => (
                <div key={gIdx} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2.5">
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">{group.section}</h3>
                  {group.fields.map((f, fIdx) => (
                    <div key={fIdx} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold">{f.label}</span>
                        <span className="font-mono font-bold text-slate-900">{f.value || '---'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(f.label, f.value)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-500 hover:text-slate-950 font-semibold flex items-center gap-1 shrink-0 transition"
                      >
                        {copiedField === f.label ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            ABA 5: AUDITORIA DE REDE POR NOME DA MÁQUINA E IP
            =================================================================== */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-600" />
                  Rastreabilidade de Acessos e Ações por Nome da Máquina (Hostname) e IP
                </h2>
                <p className="text-slate-500 mt-0.5">
                  Registra todas as atividades realizadas por diferentes usuários e máquinas na rede local da Guindastes Ribas sem necessidade de tela de login.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-2 text-left">Data / Hora</th>
                    <th className="p-2 text-left">Nome da Máquina (Host)</th>
                    <th className="p-2 text-left">Endereço IP</th>
                    <th className="p-2 text-left">Usuário / Perfil</th>
                    <th className="p-2 text-left">Módulo / Caso de Uso</th>
                    <th className="p-2 text-left">Ação Executada</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 font-mono whitespace-nowrap">{log.timestamp}</td>
                      <td className="p-2 font-mono font-bold text-slate-900">{log.hostname}</td>
                      <td className="p-2 font-mono text-emerald-700 font-semibold">{log.ip}</td>
                      <td className="p-2">
                        <strong>{log.userName}</strong>{' '}
                        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">{log.role}</span>
                      </td>
                      <td className="p-2 font-semibold text-amber-800">{log.module}</td>
                      <td className="p-2 text-slate-700">{log.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          RELATÓRIO FINAL CONSOLIDADO EM PDF PARA IMPRESSÃO A4 (UC06)
          ===================================================================== */}
      <div className="hidden print:block bg-white text-black p-6 space-y-6 text-xs">
        <div className="border-2 border-black p-4">
          <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-lg font-black">GUINDASTES RIBAS LTDA.</h1>
              <p className="text-[11px]">PLANO DE RIGGING — DOCUMENTO TÉCNICO OPERACIONAL (NR-11 / NR-12)</p>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-bold">PLANO DE RIGGING Nº {plan.assignedPlanNumber || lastPlanSeq + 1}</div>
              <div>DATA: {plan.date.split('-').reverse().join('/')}</div>
              <div>ART Nº: {plan.creaArtNumber}</div>
            </div>
          </div>

          <p className="mb-2">
            <strong>CLIENTE:</strong> {plan.clientName} ({plan.clientCnpj}) | <strong>LOCAL:</strong> {plan.serviceSite}
          </p>

          <p className="mb-2">
            <strong>EQUIPAMENTO:</strong> {selectedCrane?.model} ({selectedCrane?.truck} — Placas {selectedCrane?.plate}) |{' '}
            <strong>LANÇA:</strong> {plan.boomLengthM} m | <strong>RAIO DE OPERAÇÃO:</strong> {plan.operatingRadiusM} m |{' '}
            <strong>RAIO DE ISOLAMENTO:</strong> {plan.isolationRadiusM} m
          </p>

          <p className="mb-2">
            <strong>CARGA LÍQUIDA:</strong> {calculations.netLoadKg.toFixed(2)} kg |{' '}
            <strong>LINGADAS:</strong> {calculations.totalSlingsWeightKg.toFixed(2)} kg |{' '}
            <strong>BALANCIM:</strong> {calculations.balancimTotalKg.toFixed(2)} kg |{' '}
            <strong>CARGA BRUTA TOTAL:</strong> {calculations.grossLoadKg.toFixed(2)} kg ({calculations.grossLoadTons.toFixed(2)} t)
          </p>

          <p className="mb-2">
            <strong>CAPACIDADE DO GUINDASTE ({interpolationResult.status}):</strong> {calculations.craneCapTons.toFixed(2)} t |{' '}
            <strong>TAXA DE UTILIZAÇÃO DO GUINDASTE:</strong> {calculations.craneUtilizationPct.toFixed(1)}% |{' '}
            <strong>ESFORÇO NAS SAPATAS:</strong> {calculations.outriggerEffortEsKgf} kgf |{' '}
            <strong>RMET:</strong> {calculations.rmetKgfCm2.toFixed(2)} kgf/cm²
          </p>

          <div className="mt-4 pt-2 border-t border-black text-[10px] font-mono flex justify-between">
            <span>
              Emitido por: {activeWs.userName} ({activeWs.role}) — {activeWs.crea}
            </span>
            <span>
              Estação Rastreada: Host {activeWs.hostname} | IP {activeWs.ip}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}