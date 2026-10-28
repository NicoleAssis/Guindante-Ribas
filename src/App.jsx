import { useState, useEffect, useMemo } from 'react';
import {
  Shield, Truck, Package, FileText, AlertTriangle,
  Plus, Trash2, Edit3, Copy, Printer, History, Monitor,
  Network, Calculator, Check,  Ban
} from 'lucide-react';

import seed from './data/seed.json';
import { DEFAULT_PLAN } from './data/defaultPlan';
import { usePersistedState } from './db/usePersistedState';
import PlanWizard from './components/PlanWizard';

export default function App() {
  // --------------------------------------------------------------------------
  // 1. ESTADO DE REDE E IDENTIFICAÇÃO DE MÁQUINA / IP (PERSISTIDO)
  // --------------------------------------------------------------------------
  const [workstations, setWorkstations] = usePersistedState('workstations', seed.workstations);
  const [activeWsId, setActiveWsId] = usePersistedState('activeWsId', seed.workstations[0].id);
  const [detectedBrowserHost] = useState(() => window.location.hostname || 'localhost');
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

  const [auditLogs, setAuditLogs] = usePersistedState('auditLogs', seed.auditLogs);

  const registerAuditLog = (moduleName, actionText, overrideWs = null) => {
    const ws = overrideWs || activeWs;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
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

  

  // --------------------------------------------------------------------------
  // 2. NAVEGAÇÃO E DADOS PERSISTIDOS
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState('uc05');
  const [lastPlanSeq, setLastPlanSeq] = usePersistedState('lastPlanSeq', seed.sequences.lastPlanSeq);
  const [lastArtSeq, setLastArtSeq] = usePersistedState('lastArtSeq', seed.sequences.lastArtSeq);
  const [cranes, setCranes] = usePersistedState('cranes', seed.cranes);
  const [accessories, setAccessories] = usePersistedState('accessories', seed.accessories);
  const [plan, setPlan] = usePersistedState('plan', DEFAULT_PLAN);

  // --------------------------------------------------------------------------
  // 3. ESTADOS LOCAIS E UTILITÁRIOS
  // --------------------------------------------------------------------------
  const [wearWarningModal, setWearWarningModal] = useState(null);
  const [emissionFeedback, setEmissionFeedback] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

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
  // 4. CÁLCULOS E REGRAS DE NEGÓCIO
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
      return { valid: false, status: 'FORA_DA_FAIXA', capacityKgf: 0, capacityTons: 0, message: `Raio ${r || 0}m fora da faixa (${minR}m a ${maxR}m).` };
    }

    const exactMatch = sorted.find((pt) => Math.abs(pt.radiusM - r) < 0.0001);
    if (exactMatch) {
      return { valid: true, status: 'TABELADA', capacityKgf: exactMatch.capacityKgf, capacityTons: exactMatch.capacityKgf / 1000, message: `Capacidade tabelada exata.` };
    }

    let lower = sorted[0], upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (r > sorted[i].radiusM && r < sorted[i + 1].radiusM) { lower = sorted[i]; upper = sorted[i + 1]; break; }
    }

    const ratio = (r - lower.radiusM) / (upper.radiusM - lower.radiusM);
    const interpolatedKgf = Math.round(lower.capacityKgf + ratio * (upper.capacityKgf - lower.capacityKgf));

    return { valid: true, status: 'INTERPOLADA', capacityKgf: interpolatedKgf, capacityTons: interpolatedKgf / 1000, message: `Interpolado: ${interpolatedKgf} kgf.` };
  }, [selectedCrane, plan.operatingRadiusM]);

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
      return { ...row, accessory: acc, totalItemWeightKg, tensionTons, utilizationPct, isOverLimit: utilizationPct > 85.0 };
    }).filter(Boolean);

    const totalSlingsWeightKg = Number(slingDetails.reduce((acc, item) => acc + item.totalItemWeightKg, 0).toFixed(2));
    const balancimTotalKg = plan.useBalancim ? Number((plan.balancimQty * toStandardKg(plan.balancimUnitWeightVal, plan.balancimWeightUnit)).toFixed(2)) : 0;
    const grossLoadKg = Number((netLoadKg + totalSlingsWeightKg + balancimTotalKg + extraLoadKg).toFixed(2));
    const grossLoadTons = grossLoadKg / 1000;

    const craneCapTons = interpolationResult.valid ? interpolationResult.capacityTons : 0;
    const craneUtilizationPct = craneCapTons > 0 ? (grossLoadTons / craneCapTons) * 100 : 0;

    const maxCintaPlanaPct = slingDetails.filter((s) => s.accessory.type === 'Cinta Plana').reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    const maxCintaTubularPct = slingDetails.filter((s) => s.accessory.type === 'Cinta Tubular').reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    const maxCaboAcoPct = slingDetails.filter((s) => s.accessory.type === 'Laço de Cabo de Aço').reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    const maxManilhaPct = slingDetails.filter((s) => s.accessory.type === 'Manilha').reduce((max, s) => Math.max(max, s.utilizationPct), 0);

    const liftedForcePcKgf = netLoadKg + balancimTotalKg;
    const momentKgfM = liftedForcePcKgf * Number(plan.operatingRadiusM);
    const denomAB = Number(plan.columnDistA) + Number(plan.outriggerSpanB);
    const forceFKgf = denomAB > 0 ? Math.round(momentKgfM / denomAB) : 0;
    const craneSelfWeightKgf = selectedCrane ? selectedCrane.selfWeightKgf : 11550;
    const outriggerEffortEsKgf = Math.round(craneSelfWeightKgf / 2 + forceFKgf);

    const patolamentoAreaCm2 = Number(plan.sleeperLengthCm) * Number(plan.sleeperWidthCm) * Number(plan.sleeperCount);
    const rmetKgfCm2 = patolamentoAreaCm2 > 0 ? outriggerEffortEsKgf / patolamentoAreaCm2 : 0;

    const overloadedItems = [];
    if (craneUtilizationPct > 85.0) overloadedItems.push(`Guindaste ${selectedCrane?.model} (${craneUtilizationPct.toFixed(1)}% > 85%)`);
    slingDetails.forEach((s) => { if (s.isOverLimit) overloadedItems.push(`${s.accessory.code} - ${s.accessory.description} (${s.utilizationPct.toFixed(1)}% > 85%)`); });

    const validationErrors = [];
    if (!plan.clientName.trim()) validationErrors.push('Nome do Cliente é obrigatório (RF01).');
    if (!plan.serviceSite.trim()) validationErrors.push('Local da Obra/Serviço é obrigatório (RF01).');
    if (!plan.loadDescription.trim()) validationErrors.push('Descrição da carga é obrigatória (RF01).');
    if (netLoadKg <= 0) validationErrors.push('Peso líquido da carga deve ser maior que zero e ter unidade (Subfluxo 9).');
    if (stdLengthM <= 0 || stdWidthM <= 0 || stdHeightM <= 0) validationErrors.push('Dimensões devem ser maiores que zero (Subfluxo 9).');
    if (!interpolationResult.valid) validationErrors.push(interpolationResult.message);
    if (slingDetails.length === 0) validationErrors.push('Selecione ao menos um acessório.');
    if (patolamentoAreaCm2 <= 0) validationErrors.push('Área de patolamento deve ser maior que zero.');

    return {
      netLoadKg, stdLengthM, stdWidthM, stdHeightM, slingDetails, totalSlingsWeightKg, balancimTotalKg,
      grossLoadKg, grossLoadTons, craneCapTons, craneUtilizationPct, maxCintaPlanaPct, maxCintaTubularPct,
      maxCaboAcoPct, maxManilhaPct, liftedForcePcKgf, momentKgfM, forceFKgf, outriggerEffortEsKgf,
      patolamentoAreaCm2, rmetKgfCm2, overloadedItems, validationErrors
    };
  }, [plan, accessories, selectedCrane, interpolationResult]);

  // --------------------------------------------------------------------------
  // 5. HANDLERS
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

    setPlan((prev) => ({ ...prev, selectedSlings: [...prev.selectedSlings, newRow] }));
    registerAuditLog('UC05 — Elaborar Plano', `Adicionou acessório ${acc.code} ao plano.`);
    setWearWarningModal(null);
  };

  const handleRemoveSlingRow = (rowId) => {
    setPlan((prev) => ({ ...prev, selectedSlings: prev.selectedSlings.filter((r) => r.rowId !== rowId) }));
  };

  const handleUpdateSlingRow = (rowId, field, value) => {
    setPlan((prev) => ({
      ...prev,
      selectedSlings: prev.selectedSlings.map((r) => r.rowId === rowId ? { ...r, [field]: value } : r)
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
    registerAuditLog('UC05 — Elaborar Plano', 'Iniciou o preenchimento de um novo Plano de Rigging.');
  };

  const handleEmitPdf = () => {
    if (calculations.validationErrors.length > 0) {
      setEmissionFeedback({
        type: 'error',
        title: 'Emissão Recusada — Dados Incompletos ou Inválidos',
        messages: calculations.validationErrors
      });
      registerAuditLog('UC06 — Emitir PDF', 'Tentativa bloqueada por dados pendentes.');
      return;
    }

    if (plan.blockPdfOnOverload && calculations.overloadedItems.length > 0) {
      setEmissionFeedback({
        type: 'error',
        title: 'Emissão Bloqueada — Taxa de Utilização Acima de 85%',
        messages: calculations.overloadedItems
      });
      registerAuditLog('UC06 — Emitir PDF', 'Emissão bloqueada por sobrecarga.');
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
          history: alreadyLogged ? acc.history : [{ date: todayStr, planNumber: finalPlanNumber, client: plan.clientName, host: activeWs.hostname, user: activeWs.userName }, ...acc.history]
        };
      })
    );

    setEmissionFeedback({
      type: 'success',
      title: `Plano de Rigging Nº ${finalPlanNumber} Emitido com Sucesso`,
      messages: [`Numeração: Nº ${finalPlanNumber}.`, `Estação emissora: ${activeWs.hostname}.`]
    });

    registerAuditLog('UC06 — Emitir PDF', `Emitiu o PDF do Plano Nº ${finalPlanNumber}.`);
    setTimeout(() => { window.print(); }, 300);
  };

  // --------------------------------------------------------------------------
  // UC02 — CADASTRO E EDIÇÃO DE GUINDASTES
  // --------------------------------------------------------------------------
  const [editingCraneId, setEditingCraneId] = useState(null);
  const [craneForm, setCraneForm] = useState({
    code: '', model: '', type: 'Guindaste Articulado (Munck)', truck: '', plate: '', chassis: '', year: 2024,
    nominalCapacityTons: '', nominalUnit: 't', selfWeightVal: '', selfWeightUnit: 'kgf',
    defaultColumnDistA: 2.95, defaultOutriggerSpanB: 5.7, laudoArt: '', laudoValidade: '',
    loadTable: [{ radiusM: 4.0, radiusUnit: 'm', boomM: 5.1, capacityVal: 8500, capacityUnit: 'kgf' }, { radiusM: 6.0, radiusUnit: 'm', boomM: 5.1, capacityVal: 6200, capacityUnit: 'kgf' }]
  });
  const [craneFormErrors, setCraneFormErrors] = useState([]);
  const [craneFormSuccess, setCraneFormSuccess] = useState('');

  const handleLoadCraneForEdit = (crane) => {
    setEditingCraneId(crane.id);
    setCraneForm({
      code: crane.code, model: crane.model, type: crane.type, truck: crane.truck, plate: crane.plate, chassis: crane.chassis,
      year: crane.year, nominalCapacityTons: crane.nominalCapacityTons, nominalUnit: 't', selfWeightVal: crane.selfWeightKgf,
      selfWeightUnit: 'kgf', defaultColumnDistA: crane.defaultColumnDistA, defaultOutriggerSpanB: crane.defaultOutriggerSpanB,
      laudoArt: crane.laudoArt, laudoValidade: crane.laudoValidade,
      loadTable: crane.loadTable.map((r) => ({ radiusM: r.radiusM, radiusUnit: 'm', boomM: r.boomM, capacityVal: r.capacityKgf, capacityUnit: 'kgf' }))
    });
    setCraneFormErrors([]);
    setCraneFormSuccess('');
  };

  const handleSaveCrane = (e) => {
    e.preventDefault();
    const errors = [];
    if (!craneForm.code.trim() || !craneForm.model.trim()) errors.push('Código e Modelo são obrigatórios.');
    if (Number(craneForm.nominalCapacityTons) <= 0) errors.push('Capacidade nominal inválida.');
    if (craneForm.loadTable.length < 2) errors.push('A tabela precisa de pelo menos 2 pontos.');

    const seenRadii = new Set();
    craneForm.loadTable.forEach((row, idx) => {
      const r = Number(row.radiusM);
      if (seenRadii.has(r)) errors.push(`Raio ${r}m repetido na linha ${idx + 1}.`);
      seenRadii.add(r);
    });

    if (errors.length > 0) { setCraneFormErrors(errors); setCraneFormSuccess(''); return; }

    const normalizedTable = craneForm.loadTable.map((row) => ({
      radiusM: Number(row.radiusM), boomM: Number(row.boomM) || 5.1, capacityKgf: Number(row.capacityVal)
    })).sort((a, b) => a.radiusM - b.radiusM);

    const newCraneObj = {
      id: editingCraneId || 'crane-' + Date.now(), code: craneForm.code.trim(), model: craneForm.model.trim(), type: craneForm.type,
      truck: craneForm.truck.trim() || 'Caminhão', plate: craneForm.plate.trim() || '---', chassis: craneForm.chassis.trim() || '---',
      year: Number(craneForm.year) || 2024, nominalCapacityTons: Number(craneForm.nominalCapacityTons),
      selfWeightKgf: Number(craneForm.selfWeightVal) || 10000, defaultColumnDistA: Number(craneForm.defaultColumnDistA) || 2.95,
      defaultOutriggerSpanB: Number(craneForm.defaultOutriggerSpanB) || 5.7, laudoArt: craneForm.laudoArt.trim() || '---',
      laudoValidade: craneForm.laudoValidade.trim() || '---', createdByHost: `${activeWs.hostname} (${activeWs.ip})`, loadTable: normalizedTable
    };

    if (editingCraneId) {
      setCranes((prev) => prev.map((c) => (c.id === editingCraneId ? newCraneObj : c)));
      setCraneFormSuccess(`Guindaste atualizado!`);
    } else {
      setCranes((prev) => [...prev, newCraneObj]);
      setCraneFormSuccess(`Guindaste cadastrado!`);
    }
    setCraneFormErrors([]);
    setEditingCraneId(null);
  };

  // --------------------------------------------------------------------------
  // UC03 E UC04 — ACESSÓRIOS
  // --------------------------------------------------------------------------
  const [accForm, setAccForm] = useState({ code: '', type: 'Cinta Plana', description: '', capacityVal: '', capacityUnit: 't', weightVal: '', weightUnit: 'kg', maxUsesLimit: 30, wearNotes: 'Item novo.' });
  const [accFormError, setAccFormError] = useState('');
  const [accFormSuccess, setAccFormSuccess] = useState('');
  const [selectedAccForHistory, setSelectedAccForHistory] = useState(accessories[0]);

  const handleSaveAccessory = (e) => {
    e.preventDefault();
    setAccFormError(''); setAccFormSuccess('');

    if (!accForm.code.trim() || !accForm.description.trim()) { setAccFormError('Código e descrição obrigatórios.'); return; }
    if (accessories.some((a) => a.code.toLowerCase() === accForm.code.toLowerCase())) { setAccFormError('Código já existe.'); return; }

    const newAcc = {
      id: 'acc-' + Date.now(), code: accForm.code.trim().toUpperCase(), type: accForm.type, description: accForm.description.trim(),
      capacityTons: Number(accForm.capacityVal), nominalLabelTons: Number(accForm.capacityVal), unitWeightKg: Number(accForm.weightVal),
      registeredAt: new Date().toLocaleDateString('pt-BR'), registeredByHost: `${activeWs.hostname}`, usesCount: 0,
      maxUsesLimit: Number(accForm.maxUsesLimit) || 30, wearStatus: 'OK', wearNotes: accForm.wearNotes.trim(), history: []
    };

    setAccessories((prev) => [newAcc, ...prev]);
    setSelectedAccForHistory(newAcc);
    setAccFormSuccess(`Acessório cadastrado!`);
    setAccForm({ code: '', type: 'Cinta Plana', description: '', capacityVal: '', capacityUnit: 't', weightVal: '', weightUnit: 'kg', maxUsesLimit: 30, wearNotes: 'Item novo.' });
  };

  const handleDiscardAccessory = (accId) => {
    setAccessories((prev) => prev.map((a) => a.id === accId ? { ...a, wearStatus: 'DESCARTADO', discardedAt: new Date().toLocaleDateString('pt-BR') } : a));
    setPlan((prev) => ({ ...prev, selectedSlings: prev.selectedSlings.filter((s) => s.accessoryId !== accId) }));
  };

  const handleToggleWearAlert = (accId) => {
    setAccessories((prev) => prev.map((a) => {
      if (a.id !== accId || a.wearStatus === 'DESCARTADO') return a;
      return { ...a, wearStatus: a.wearStatus === 'OK' ? 'ALERTA_DESGASTE' : 'OK' };
    }));
  };

  // --------------------------------------------------------------------------
  // UC07 E REDE
  // --------------------------------------------------------------------------
  const handleGenerateInternalArtOrganization = () => {
    if (!plan.assignedInternalArtNumber) {
      const nextArt = lastArtSeq + 1;
      setLastArtSeq(nextArt);
      setPlan((prev) => ({ ...prev, assignedInternalArtNumber: `ART-INT-${nextArt}` }));
    }
  };

  const copyToClipboard = (label, text) => {
    navigator.clipboard.writeText(String(text));
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleAddCustomWorkstation = (e) => {
    e.preventDefault();
    const newWs = { id: 'ws-' + Date.now(), hostname: newWsForm.hostname.toUpperCase(), ip: newWsForm.ip, mac: '---', userName: newWsForm.userName, role: newWsForm.role, crea: newWsForm.crea || '---', department: 'Rede Local' };
    setWorkstations((prev) => [...prev, newWs]);
    setActiveWsId(newWs.id);
    setCustomHostModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <header className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg font-black text-lg tracking-tighter flex items-center gap-1">
              <Shield className="w-5 h-5" />GR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight">GUINDASTES RIBAS LTDA.</h1>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">Web Local v2.0</span>
              </div>
              <p className="text-xs text-slate-400">Sistema Centralizado de Plano de Rigging • NR-11 e NR-12</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
            <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
              <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
              <Monitor className="w-4 h-4 text-amber-400" />
              <div className="text-xs">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Acesso por Máquina (Host: {detectedBrowserHost})</div>
                <div className="font-mono font-bold text-emerald-300">{activeWs.hostname} • {activeWs.ip}</div>
              </div>
            </div>
            <select value={activeWsId} onChange={(e) => setActiveWsId(e.target.value)} className="bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-600">
              {workstations.map((ws) => <option key={ws.id} value={ws.id}>[{ws.hostname}] {ws.userName}</option>)}
            </select>
            <button onClick={() => setCustomHostModal(true)} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1"><Network className="w-3.5 h-3.5 text-amber-400" />+ Máquina/IP</button>
          </div>
        </div>

        <div className="bg-slate-950/80 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 py-2">
            <nav className="flex flex-wrap gap-1.5">
              <button onClick={() => setActiveTab('uc05')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc05' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Calculator className="w-3.5 h-3.5" />UC05 & UC06: Elaborar e Emitir</button>
              <button onClick={() => setActiveTab('uc02')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc02' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Truck className="w-3.5 h-3.5" />UC02: Guindastes ({cranes.length})</button>
              <button onClick={() => setActiveTab('uc03_04')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc03_04' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Package className="w-3.5 h-3.5" />UC03 & UC04: Acessórios ({accessories.length})</button>
              <button onClick={() => { setActiveTab('uc07'); handleGenerateInternalArtOrganization(); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc07' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><FileText className="w-3.5 h-3.5" />UC07: Organizar ART</button>
              <button onClick={() => setActiveTab('audit')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'audit' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><History className="w-3.5 h-3.5" />Auditoria ({auditLogs.length})</button>
            </nav>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Plano Atual: <strong className="text-amber-400 font-mono">{plan.assignedPlanNumber ? `Nº ${plan.assignedPlanNumber}` : 'A gerar'}</strong></span>
              <button onClick={handleEmitPdf} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition"><Printer className="w-3.5 h-3.5" />Emitir PDF (UC06)</button>
            </div>
          </div>
        </div>
      </header>

      {/* MODAIS */}
      {wearWarningModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border-2 border-amber-500">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg"><AlertTriangle className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Alerta de Desgaste</h3>
                <p className="text-xs text-slate-600 mt-1">O acessório <strong className="font-mono">{wearWarningModal.code}</strong> atingiu o critério de alerta:</p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 text-xs text-amber-900">
                  <p className="font-semibold">Ciclos: {wearWarningModal.usesCount} / {wearWarningModal.maxUsesLimit}</p>
                  <p>{wearWarningModal.wearNotes}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
              <button onClick={() => setWearWarningModal(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800">Cancelar</button>
              <button onClick={() => handleAddAccessoryToPlan(wearWarningModal.id, true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950">Manter com Alerta</button>
            </div>
          </div>
        </div>
      )}

      {customHostModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-300">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2"><Network className="w-5 h-5 text-amber-600" />Mapear Estação (Host + IP)</h3>
            <form onSubmit={handleAddCustomWorkstation} className="space-y-3 mt-3 text-xs">
              <div><label className="font-semibold text-slate-700 block mb-1">Hostname</label><input type="text" value={newWsForm.hostname} onChange={(e) => setNewWsForm({ ...newWsForm, hostname: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono" required /></div>
              <div><label className="font-semibold text-slate-700 block mb-1">IP</label><input type="text" value={newWsForm.ip} onChange={(e) => setNewWsForm({ ...newWsForm, ip: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono" required /></div>
              <div><label className="font-semibold text-slate-700 block mb-1">Operador</label><input type="text" value={newWsForm.userName} onChange={(e) => setNewWsForm({ ...newWsForm, userName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-1.5" required /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setCustomHostModal(false)} className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-semibold">Cancelar</button><button type="submit" className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold">Ativar</button></div>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-5 print:hidden">
        {/* NOVO WIZARD DA ABA UC05 */}
        {activeTab === 'uc05' && (
          <PlanWizard
            plan={plan}
            setPlan={setPlan}
            calculations={calculations}
            cranes={cranes}
            accessories={accessories}
            selectedCrane={selectedCrane}
            interpolationResult={interpolationResult}
            handlers={{
              handleAddAccessoryToPlan,
              handleRemoveSlingRow,
              handleUpdateSlingRow,
              handleStartNewPlan,
              handleEmitPdf
            }}
          />
        )}

        {/* ABA 2: UC02 */}
        {activeTab === 'uc02' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-amber-600" />Frota Cadastrada (UC02)</h2>
                <div className="space-y-3">
                  {cranes.map((cr) => (
                    <div key={cr.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">[{cr.code}] {cr.model}</span>
                        <button onClick={() => handleLoadCraneForEdit(cr)} className="bg-amber-500/20 text-amber-900 font-semibold px-2.5 py-1 rounded flex items-center gap-1"><Edit3 className="w-3 h-3" />Editar</button>
                      </div>
                      <p className="text-slate-600 mt-1">Placa: <span className="font-mono">{cr.plate}</span> • Cap: <strong>{cr.nominalCapacityTons} t</strong></p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cr.loadTable.map((pt, i) => <span key={i} className="font-mono text-[11px] bg-white border border-slate-300 px-1.5 py-0.5 rounded">R={pt.radiusM}m → {pt.capacityKgf}kgf</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <form onSubmit={handleSaveCrane} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs">
                <h3 className="font-bold text-sm text-slate-900 border-b pb-3">{editingCraneId ? 'Editar Guindaste' : 'Novo Guindaste'}</h3>
                {craneFormErrors.length > 0 && <div className="bg-red-50 text-red-900 p-3 rounded-lg">{craneFormErrors.map((e, i) => <div key={i}>{e}</div>)}</div>}
                {craneFormSuccess && <div className="bg-emerald-50 text-emerald-900 p-3 rounded-lg font-semibold">{craneFormSuccess}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="font-semibold block mb-1">Código *</label><input type="text" value={craneForm.code} onChange={(e) => setCraneForm({ ...craneForm, code: e.target.value })} className="w-full border rounded px-2 py-1.5 font-mono" /></div>
                  <div className="sm:col-span-2"><label className="font-semibold block mb-1">Modelo *</label><input type="text" value={craneForm.model} onChange={(e) => setCraneForm({ ...craneForm, model: e.target.value })} className="w-full border rounded px-2 py-1.5" /></div>
                  <div><label className="font-semibold block mb-1">Placa</label><input type="text" value={craneForm.plate} onChange={(e) => setCraneForm({ ...craneForm, plate: e.target.value })} className="w-full border rounded px-2 py-1.5 font-mono" /></div>
                  <div><label className="font-semibold block mb-1">Capacidade Nominal *</label><input type="number" value={craneForm.nominalCapacityTons} onChange={(e) => setCraneForm({ ...craneForm, nominalCapacityTons: e.target.value })} className="w-full border rounded px-2 py-1.5 font-mono" /></div>
                  <div><label className="font-semibold block mb-1">Peso Próprio *</label><input type="number" value={craneForm.selfWeightVal} onChange={(e) => setCraneForm({ ...craneForm, selfWeightVal: e.target.value })} className="w-full border rounded px-2 py-1.5 font-mono" /></div>
                </div>
                <div className="pt-3 border-t">
                  <span className="font-bold">Tabela de Carga:</span>
                  {craneForm.loadTable.map((row, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded border mt-2">
                      <div className="col-span-6 flex gap-2 items-center"><span className="text-[10px]">Raio:</span><input type="number" value={row.radiusM} onChange={(e) => { const u = [...craneForm.loadTable]; u[index].radiusM = e.target.value; setCraneForm({ ...craneForm, loadTable: u }); }} className="w-full border rounded px-2 py-1" /></div>
                      <div className="col-span-5 flex gap-2 items-center"><span className="text-[10px]">Cap:</span><input type="number" value={row.capacityVal} onChange={(e) => { const u = [...craneForm.loadTable]; u[index].capacityVal = e.target.value; setCraneForm({ ...craneForm, loadTable: u }); }} className="w-full border rounded px-2 py-1" /></div>
                      <div className="col-span-1 text-right"><button type="button" onClick={() => setCraneForm({ ...craneForm, loadTable: craneForm.loadTable.filter((_, i) => i !== index) })} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button></div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setCraneForm({ ...craneForm, loadTable: [...craneForm.loadTable, { radiusM: '', capacityVal: '' }] })} className="mt-2 bg-slate-800 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Adicionar Raio</button>
                </div>
                <div className="flex justify-end pt-2"><button type="submit" className="bg-amber-500 hover:bg-amber-600 font-bold px-4 py-2 rounded-lg shadow">Salvar Guindaste</button></div>
              </form>
            </div>
          </div>
        )}

        {/* ABA 3: UC03 e UC04 */}
        {activeTab === 'uc03_04' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4">
              <form onSubmit={handleSaveAccessory} className="bg-white rounded-xl shadow-sm border p-4 space-y-3 text-xs">
                <h2 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center gap-1.5"><Plus className="w-4 h-4 text-amber-600" />UC03 — Novo Acessório</h2>
                {accFormError && <div className="bg-red-50 text-red-900 p-2.5 rounded-lg">{accFormError}</div>}
                {accFormSuccess && <div className="bg-emerald-50 text-emerald-900 p-2.5 rounded-lg">{accFormSuccess}</div>}
                <div><label className="font-semibold block mb-1">Tipo *</label><select value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })} className="w-full border rounded-lg px-2.5 py-1.5"><option value="Cinta Plana">Cinta Plana</option><option value="Manilha">Manilha</option><option value="Laço de Cabo de Aço">Laço de Cabo de Aço</option></select></div>
                <div><label className="font-semibold block mb-1">Código Único *</label><input type="text" value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} className="w-full border rounded-lg px-2.5 py-1.5 font-mono" /></div>
                <div><label className="font-semibold block mb-1">Descrição *</label><input type="text" value={accForm.description} onChange={(e) => setAccForm({ ...accForm, description: e.target.value })} className="w-full border rounded-lg px-2.5 py-1.5" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="font-semibold block mb-1">Capacidade (t) *</label><input type="number" value={accForm.capacityVal} onChange={(e) => setAccForm({ ...accForm, capacityVal: e.target.value })} className="w-full border rounded-lg px-2 py-1.5 font-mono" /></div>
                  <div><label className="font-semibold block mb-1">Peso (kg) *</label><input type="number" value={accForm.weightVal} onChange={(e) => setAccForm({ ...accForm, weightVal: e.target.value })} className="w-full border rounded-lg px-2 py-1.5 font-mono" /></div>
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg mt-2">Salvar Acessório</button>
              </form>
            </div>
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-amber-600" />UC04 — Histórico e Descarte</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {accessories.map((acc) => (
                    <div key={acc.id} onClick={() => setSelectedAccForHistory(acc)} className={`p-3 rounded-xl border text-xs cursor-pointer transition ${selectedAccForHistory?.id === acc.id ? 'ring-2 ring-amber-500' : ''} ${acc.wearStatus === 'DESCARTADO' ? 'bg-slate-100 border-slate-300 opacity-75' : acc.wearStatus === 'ALERTA_DESGASTE' ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2"><span className="font-mono font-bold">{acc.code}</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${acc.wearStatus === 'DESCARTADO' ? 'bg-red-200' : acc.wearStatus === 'ALERTA_DESGASTE' ? 'bg-amber-300' : 'bg-emerald-100'}`}>{acc.wearStatus}</span></div>
                      <p className="font-semibold mt-1">{acc.description}</p>
                      <p className="text-slate-500 mt-0.5 font-mono text-[11px]">Cap: {acc.capacityTons}t | Ciclos: {acc.usesCount}/{acc.maxUsesLimit}</p>
                    </div>
                  ))}
                </div>
              </div>
              {selectedAccForHistory && (
                <div className="bg-white rounded-xl shadow-sm border p-4 text-xs">
                  <div className="flex justify-between items-center border-b pb-3 mb-3">
                    <h3 className="font-bold text-sm">Ficha: <span className="font-mono">{selectedAccForHistory.code}</span></h3>
                    {selectedAccForHistory.wearStatus !== 'DESCARTADO' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleToggleWearAlert(selectedAccForHistory.id)} className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 font-semibold">Alternar Alerta</button>
                        <button onClick={() => handleDiscardAccessory(selectedAccForHistory.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold flex items-center gap-1"><Ban className="w-3.5 h-3.5" />Descartar</button>
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold mb-2">Histórico de Uso:</h4>
                  {selectedAccForHistory.history.length === 0 ? <p className="text-slate-500 italic">Nenhum uso registrado.</p> : (
                    <table className="w-full border-collapse border text-left"><thead className="bg-slate-100"><tr><th className="border p-1.5">Data</th><th className="border p-1.5">Plano</th><th className="border p-1.5">Cliente</th></tr></thead><tbody>{selectedAccForHistory.history.map((h, i) => <tr key={i}><td className="border p-1.5 font-mono">{h.date}</td><td className="border p-1.5 font-mono">Nº {h.planNumber}</td><td className="border p-1.5">{h.client}</td></tr>)}</tbody></table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 4: UC07 */}
        {activeTab === 'uc07' && (
          <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4 text-xs">
            <h2 className="font-bold text-base text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600" />UC07 — Organização para ART</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[{ title: '1. Responsável Técnico', fields: [{ label: 'Profissional', value: 'GIULIANO CESAR BREDA DE SOUZA' }, { label: 'CREA', value: 'PR-78755/D' }] }, { title: '2. Contrato', fields: [{ label: 'Cliente', value: plan.clientName }, { label: 'CNPJ', value: plan.clientCnpj }] }].map((g, i) => (
                <div key={i} className="border rounded-xl p-3.5 bg-slate-50 space-y-2.5">
                  <h3 className="font-bold border-b pb-1.5">{g.title}</h3>
                  {g.fields.map((f, j) => (
                    <div key={j} className="bg-white border rounded-lg p-2 flex justify-between items-center gap-2">
                      <div><span className="text-[10px] text-slate-500 block">{f.label}</span><span className="font-mono font-bold">{f.value || '---'}</span></div>
                      <button onClick={() => copyToClipboard(f.label, f.value)} className="px-2.5 py-1 rounded bg-slate-100 font-semibold flex items-center gap-1">{copiedField === f.label ? <><Check className="w-3.5 h-3.5 text-emerald-600" />Copiado</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 5: Auditoria */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4 text-xs">
            <h2 className="font-bold text-base flex items-center gap-2"><History className="w-5 h-5 text-amber-600" />Rastreabilidade de Acessos</h2>
            <table className="w-full border-collapse border text-left"><thead className="bg-slate-900 text-white"><tr><th className="p-2">Data</th><th className="p-2">Host</th><th className="p-2">IP</th><th className="p-2">Operador</th><th className="p-2">Ação</th></tr></thead>
              <tbody>{auditLogs.map((log) => <tr key={log.id} className="border-b hover:bg-slate-50"><td className="p-2 font-mono">{log.timestamp}</td><td className="p-2 font-mono font-bold">{log.hostname}</td><td className="p-2 font-mono text-emerald-700">{log.ip}</td><td className="p-2">{log.userName}</td><td className="p-2">{log.action}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </main>

            {/* =====================================================================
          RELATÓRIO A4 DE IMPRESSÃO (PLANO DE RIGGING + ART)
          ===================================================================== */}
      <div className="hidden print:block bg-white text-black p-0 m-0 font-sans text-[11px]">
        
        {/* --- PÁGINA 1: PLANILHA DE CAPACIDADES --- */}
        <div className="p-6 w-full max-w-[210mm] mx-auto">
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <tbody>
              {/* Cabeçalho */}
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left w-32">CLIENTE:</td>
                <td colSpan={6} className="border border-black p-1 text-left font-bold">{plan.clientName}</td>
                <td className="border border-black p-1 text-left w-16">LOCAL:</td>
                <td colSpan={2} className="border border-black p-1 text-left font-bold">{plan.serviceSite}</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left">DATA:</td>
                <td colSpan={6} className="border border-black p-1 text-left">{plan.date.split('-').reverse().join('/')}</td>
                <td className="border border-black p-1 text-left">PLANO Nº:</td>
                <td colSpan={2} className="border border-black p-1 text-left font-bold text-sm">{plan.assignedPlanNumber || lastPlanSeq + 1}</td>
              </tr>

              {/* Dados da Carga */}
              <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left">DADOS DA CARGA:</td></tr>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={4} className="border border-black p-1 text-left">Descrição da carga</td>
                <td colSpan={2} className="border border-black p-1">Comp. (m)</td>
                <td colSpan={2} className="border border-black p-1">Largura (m)</td>
                <td colSpan={1} className="border border-black p-1">Altura (m)</td>
                <td colSpan={2} className="border border-black p-1">Peso (kg)</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-black p-1 text-left">{plan.loadDescription}</td>
                <td colSpan={2} className="border border-black p-1 font-mono">{calculations.stdLengthM.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 font-mono">{calculations.stdWidthM.toFixed(2)}</td>
                <td colSpan={1} className="border border-black p-1 font-mono">{calculations.stdHeightM.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 font-mono">{calculations.netLoadKg.toFixed(2)}</td>
              </tr>

              {/* Lingada */}
              <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left">LINGADA / AMARRAS</td></tr>
              <tr className="bg-slate-100 font-bold">
                <td className="border border-black p-1 w-8">Item</td>
                <td colSpan={4} className="border border-black p-1 text-left">Descrição</td>
                <td colSpan={2} className="border border-black p-1">Qtd. (pç)</td>
                <td colSpan={2} className="border border-black p-1">Unitário (kg)</td>
                <td colSpan={2} className="border border-black p-1">Total (kg)</td>
              </tr>
              {calculations.slingDetails.map((s, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1">{idx + 1}</td>
                  <td colSpan={4} className="border border-black p-1 text-left">{s.accessory.description}</td>
                  <td colSpan={2} className="border border-black p-1 font-mono">{s.qty}</td>
                  <td colSpan={2} className="border border-black p-1 font-mono">{s.accessory.unitWeightKg.toFixed(2)}</td>
                  <td colSpan={2} className="border border-black p-1 font-mono">{s.totalItemWeightKg.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={9} className="border border-black p-1 text-right font-bold">PESO TOTAL DA LINGADA / AMARRAÇÃO:</td>
                <td colSpan={2} className="border border-black p-1 font-mono font-bold">{calculations.totalSlingsWeightKg.toFixed(2)}</td>
              </tr>

              {/* Dispositivos */}
              <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left">DISPOSITIVOS / BALANCIM</td></tr>
              <tr>
                <td colSpan={9} className="border border-black p-1 text-right font-bold">PESO TOTAL DISPOSITIVOS:</td>
                <td colSpan={2} className="border border-black p-1 font-mono font-bold">{calculations.balancimTotalKg.toFixed(2)}</td>
              </tr>

              {/* Infos Guindaste */}
              <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left">INFORMAÇÕES DO GUINDASTE</td></tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left bg-slate-100 font-bold">Modelo</td>
                <td colSpan={9} className="border border-black p-1 text-left">{selectedCrane?.model}</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left bg-slate-100 font-bold">Caminhão</td>
                <td colSpan={5} className="border border-black p-1 text-left">{selectedCrane?.truck}</td>
                <td colSpan={2} className="border border-black p-1 text-right bg-slate-100 font-bold">Placas</td>
                <td colSpan={2} className="border border-black p-1 text-left font-mono">{selectedCrane?.plate}</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left bg-slate-100 font-bold">Chassi</td>
                <td colSpan={5} className="border border-black p-1 text-left font-mono">{selectedCrane?.chassis}</td>
                <td colSpan={2} className="border border-black p-1 text-right bg-slate-100 font-bold">Ano Fab.</td>
                <td colSpan={2} className="border border-black p-1 text-left font-mono">{selectedCrane?.year}</td>
              </tr>

              {/* Cálculos */}
              <tr>
                <td colSpan={6} className="bg-slate-200 font-bold p-1 text-left border border-black">CONFIGURAÇÃO DO GUINDASTE</td>
                <td colSpan={5} className="bg-slate-200 font-bold p-1 text-left border border-black">COMPOSIÇÃO DA CARGA BRUTA</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left">Capacidade nominal</td>
                <td colSpan={2} className="border border-black p-1 text-right font-mono">{selectedCrane?.nominalCapacityTons}</td>
                <td colSpan={2} className="border border-black p-1 text-left">t</td>
                <td colSpan={2} className="border border-black p-1 text-left">Carga líquida</td>
                <td colSpan={1} className="border border-black p-1 text-right font-mono">{calculations.netLoadKg.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">kg</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left">Comprimento da lança</td>
                <td colSpan={2} className="border border-black p-1 text-right font-mono">{plan.boomLengthM}</td>
                <td colSpan={2} className="border border-black p-1 text-left">m</td>
                <td colSpan={2} className="border border-black p-1 text-left">Lingada / Amarração</td>
                <td colSpan={1} className="border border-black p-1 text-right font-mono">{calculations.totalSlingsWeightKg.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">kg</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left">Raio de operação</td>
                <td colSpan={2} className="border border-black p-1 text-right font-mono">{plan.operatingRadiusM}</td>
                <td colSpan={2} className="border border-black p-1 text-left">m</td>
                <td colSpan={2} className="border border-black p-1 text-left">Dispositivos / Balancim</td>
                <td colSpan={1} className="border border-black p-1 text-right font-mono">{calculations.balancimTotalKg.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">kg</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black p-1 text-left">Capacidade de carga</td>
                <td colSpan={2} className="border border-black p-1 text-right font-mono font-bold">{calculations.craneCapTons.toFixed(3)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">t</td>
                <td colSpan={2} className="border border-black p-1 text-left font-bold">Carga bruta</td>
                <td colSpan={1} className="border border-black p-1 text-right font-mono font-bold">{calculations.grossLoadKg.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left font-bold">kg</td>
              </tr>

              {/* Resumo */}
              <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left">RESUMO DOS CÁLCULOS</td></tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Total da carga bruta</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.grossLoadTons.toFixed(5)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">t</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Capacidade de carga do guindaste</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.craneCapTons.toFixed(3)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">t</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Taxa de utilização do guindaste</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.craneUtilizationPct.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">%</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Taxa de utilização da cinta plana</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.maxCintaPlanaPct.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">%</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Taxa de utilização da manilha</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.maxManilhaPct.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">%</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Esforço nas sapatas</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.outriggerEffortEsKgf}</td>
                <td colSpan={2} className="border border-black p-1 text-left">kgf</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Resistência mínima do terreno</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.rmetKgfCm2.toFixed(2)}</td>
                <td colSpan={2} className="border border-black p-1 text-left">kgf/cm²</td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black p-1 text-left">Velocidade máxima do vento</td>
                <td colSpan={3} className="border border-black p-1 text-right font-mono">{plan.maxWindSpeedMs}</td>
                <td colSpan={2} className="border border-black p-1 text-left">m/s</td>
              </tr>

              {/* Assinatura */}
              <tr>
                <td colSpan={11} className="border border-black p-6 text-center">
                  <div className="flex flex-col items-center justify-center mt-8">
                    <div className="w-64 border-t border-black mb-1"></div>
                    <p className="font-bold">GIULIANO CESAR BREDA DE SOUZA</p>
                    <p>Engenheiro Mecânico - CREA 78755/D - PR</p>
                    <p className="text-[9px] mt-2">ART Nº {plan.creaArtNumber || '1720264496217'}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* --- QUEBRA DE PÁGINA PARA A ART --- */}
        <div className="break-before-page w-full h-full p-6 bg-white max-w-[210mm] mx-auto">
          <div className="border border-slate-300 p-4 text-xs space-y-4">
             <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-4">
               <div>
                  <h1 className="text-xl font-black text-slate-900">Anotação de Responsabilidade Técnica - ART</h1>
                  <p className="text-slate-500">Lei nº 6.496, de 7 de dezembro de 1977</p>
                  <p className="text-slate-500">Conselho Regional de Engenharia e Agronomia do Paraná</p>
               </div>
               <div className="text-right">
                  <p className="font-bold text-lg">CREA-PR</p>
                  <p className="text-[10px]">Página 1/1</p>
               </div>
             </div>
             
             <div>
               <h2 className="font-bold bg-slate-100 p-1 border border-slate-300">1. Responsável Técnico</h2>
               <p className="p-2"><strong>GIULIANO CESAR BREDA DE SOUZA</strong> - ENGENHEIRO MECÂNICO</p>
               <p className="p-2">RNP: 1701211920 | Carteira: PR-78755/D</p>
             </div>

             <div>
               <h2 className="font-bold bg-slate-100 p-1 border border-slate-300">2. Dados do Contrato</h2>
               <p className="p-2"><strong>Contratante:</strong> {plan.clientName}</p>
               <p className="p-2"><strong>CNPJ:</strong> {plan.clientCnpj}</p>
               <p className="p-2"><strong>Contrato:</strong> (Sem número) | <strong>Celebrado em:</strong> {plan.date.split('-').reverse().join('/')} | <strong>Valor:</strong> R$ {plan.contractValueBRL}</p>
             </div>

             <div>
               <h2 className="font-bold bg-slate-100 p-1 border border-slate-300">3. Dados da Obra/Serviço</h2>
               <p className="p-2"><strong>Endereço:</strong> {plan.serviceSite}</p>
               <p className="p-2"><strong>Data de Início:</strong> {plan.date.split('-').reverse().join('/')}</p>
               <p className="p-2"><strong>Finalidade:</strong> Industrial</p>
               <p className="p-2"><strong>Proprietário:</strong> {plan.clientName} - CNPJ: {plan.clientCnpj}</p>
             </div>

             <div>
               <h2 className="font-bold bg-slate-100 p-1 border border-slate-300">4. Atividade Técnica</h2>
               <p className="p-2"><strong>Quantidade:</strong> {(calculations.netLoadKg / 1000).toFixed(2)} TON</p>
               <p className="p-2">[Desenvolvimento, Detalhamento, Estudo, Planejamento, Projeto] de plano de rigging</p>
             </div>

             <div>
               <h2 className="font-bold bg-slate-100 p-1 border border-slate-300">5. Observações</h2>
               <p className="p-2">{plan.notes || `Plano de Rigging Nº ${plan.assignedPlanNumber || lastPlanSeq + 1} referente a ${plan.operationName} em ${plan.serviceSite}.`}</p>
             </div>

             <div className="mt-12 text-center text-[10px] text-slate-600">
                <p>Documento assinado eletronicamente por GIULIANO CESAR BREDA DE SOUZA, registro Crea-PR PR-78755/D.</p>
                <p>Declaro serem verdadeiras as informações registradas nesta Anotação de Responsabilidade Técnica.</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}