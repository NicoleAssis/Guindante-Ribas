import { useState, useMemo } from 'react';
import {
  Shield, Truck, Package, FileText, AlertTriangle,
  Plus, Trash2, Edit3, Copy, Printer, History, Monitor,
  Network, Calculator, Check, Ban, Save, FolderOpen, CheckCircle2, XCircle, Search, Building2
} from 'lucide-react';

import seed from './data/seed.json';
import { DEFAULT_PLAN } from './data/defaultPlan';
import { usePersistedState } from './db/usePersistedState';
import PlanWizard from './components/PlanWizard';

export default function App() {
  // ESTADOS
  const [workstations, setWorkstations] = usePersistedState('workstations', seed.workstations);
  const [activeWsId, setActiveWsId] = usePersistedState('activeWsId', seed.workstations[0].id);
  const [detectedBrowserHost] = useState(() => window.location.hostname || 'localhost');
  
  const [clients, setClients] = usePersistedState('clients', seed.clients || []);
  const [savedPlans, setSavedPlans] = usePersistedState('savedPlans', []);
  const [searchQuery, setSearchQuery] = useState('');

  const activeWs = useMemo(() => workstations.find((w) => w.id === activeWsId) || workstations[0], [workstations, activeWsId]);
  const [auditLogs, setAuditLogs] = usePersistedState('auditLogs', seed.auditLogs);

  const registerAuditLog = (moduleName, actionText) => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    setAuditLogs((prev) => [{ id: 'log-' + Date.now(), timestamp: formattedDate, hostname: activeWs.hostname, ip: activeWs.ip, userName: activeWs.userName, role: activeWs.role, module: moduleName, action: actionText }, ...prev]);
  };

  const [activeTab, setActiveTab] = useState('uc05');
  const [lastPlanSeq, setLastPlanSeq] = usePersistedState('lastPlanSeq', seed.sequences.lastPlanSeq);
  const [lastArtSeq, setLastArtSeq] = usePersistedState('lastArtSeq', seed.sequences.lastArtSeq);
  
  const [cranes, setCranes] = usePersistedState('cranes', seed.cranes);
  const [accessories, setAccessories] = usePersistedState('accessories', seed.accessories);
  
  const [plan, setPlan] = usePersistedState('plan', DEFAULT_PLAN);
  const [wearWarningModal, setWearWarningModal] = useState(null);
  const [emissionFeedback, setEmissionFeedback] = useState(null);

  const [clientForm, setClientForm] = useState({ name: '', cnpj: '', address: '', site: '' });
  const [craneForm, setCraneForm] = useState({ code: '', model: '', truck: '', plate: '', nominalCapacityTons: '', selfWeightKgf: '', defaultColumnDistA: 2.95, defaultOutriggerSpanB: 5.7 });
  const [accForm, setAccForm] = useState({ code: '', type: 'Cinta Plana', description: '', capacityTons: '', unitWeightKg: '', maxUsesLimit: 30 });

  // CÁLCULOS
  const toStandardKg = (val, unit) => (unit === 't' ? Number(val) * 1000 : Number(val)) || 0;
  const toStandardMeters = (val, unit) => (unit === 'cm' ? Number(val) / 100 : Number(val)) || 0;
  const selectedCrane = useMemo(() => (cranes || []).find((c) => c.id === plan.selectedCraneId) || cranes[0], [cranes, plan.selectedCraneId]);

  const interpolationResult = useMemo(() => {
    if (!selectedCrane || !selectedCrane.loadTable || selectedCrane.loadTable.length === 0) return { valid: false, status: 'SEM_TABELA', capacityKgf: 0, capacityTons: 0, message: 'Sem tabela.' };
    const sorted = [...selectedCrane.loadTable].sort((a, b) => a.radiusM - b.radiusM);
    const r = Number(plan.operatingRadiusM);
    if (isNaN(r) || r < sorted[0].radiusM || r > sorted[sorted.length - 1].radiusM) return { valid: false, status: 'FORA_DA_FAIXA', capacityKgf: 0, capacityTons: 0, message: `Raio fora da faixa.` };
    const exactMatch = sorted.find((pt) => Math.abs(pt.radiusM - r) < 0.0001);
    if (exactMatch) return { valid: true, status: 'TABELADA', capacityKgf: exactMatch.capacityKgf, capacityTons: exactMatch.capacityKgf / 1000, message: `Capacidade exata.` };
    
    let lower = sorted[0], upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) { if (r > sorted[i].radiusM && r < sorted[i + 1].radiusM) { lower = sorted[i]; upper = sorted[i + 1]; break; } }
    const interpolatedKgf = Math.round(lower.capacityKgf + ((r - lower.radiusM) / (upper.radiusM - lower.radiusM)) * (upper.capacityKgf - lower.capacityKgf));
    return { valid: true, status: 'INTERPOLADA', capacityKgf: interpolatedKgf, capacityTons: interpolatedKgf / 1000, message: `Interpolado: ${interpolatedKgf} kgf.` };
  }, [selectedCrane, plan.operatingRadiusM]);

  const calculations = useMemo(() => {
    const netLoadKg = toStandardKg(plan.netWeightVal, plan.netWeightUnit);
    const extraLoadKg = toStandardKg(plan.extraWeightVal, plan.extraWeightUnit);
    const stdLengthM = toStandardMeters(plan.lengthVal, plan.lengthUnit);
    const stdWidthM = toStandardMeters(plan.widthVal, plan.widthUnit);
    const stdHeightM = toStandardMeters(plan.heightVal, plan.heightUnit);

    const slingDetails = (plan.selectedSlings || []).map((row) => {
      const acc = (accessories || []).find((a) => a.id === row.accessoryId);
      if (!acc) return null;
      const totalItemWeightKg = Number((row.qty * acc.unitWeightKg).toFixed(2));
      const tensionTons = acc.type === 'Manilha' ? Number(row.supportedWeightTons) : (1 / (Math.cos((Number(row.angleDeg) * Math.PI) / 180) || 1)) * Number(row.supportedWeightTons);
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
    const maxManilhaPct = slingDetails.filter((s) => s.accessory.type === 'Manilha').reduce((max, s) => Math.max(max, s.utilizationPct), 0);
    
    const outriggerEffortEsKgf = Math.round((selectedCrane?.selfWeightKgf || 0) / 2 + (grossLoadKg * Number(plan.operatingRadiusM)) / (Number(plan.columnDistA) + Number(plan.outriggerSpanB)));
    const rmetKgfCm2 = (Number(plan.sleeperLengthCm) * Number(plan.sleeperWidthCm) * Number(plan.sleeperCount)) > 0 ? outriggerEffortEsKgf / (Number(plan.sleeperLengthCm) * Number(plan.sleeperWidthCm) * Number(plan.sleeperCount)) : 0;

    const overloadedItems = [];
    if (craneUtilizationPct > 85.0) overloadedItems.push(`Guindaste (${craneUtilizationPct.toFixed(1)}% > 85%)`);
    slingDetails.forEach((s) => { if (s.isOverLimit) overloadedItems.push(`${s.accessory.code} (${s.utilizationPct.toFixed(1)}% > 85%)`); });

    const validationErrors = [];
    if (!plan.clientName || !plan.clientName.trim()) validationErrors.push('Cliente é obrigatório.');
    if (!plan.serviceSite || !plan.serviceSite.trim()) validationErrors.push('Local da Obra é obrigatório.');
    if (!plan.loadDescription || !plan.loadDescription.trim()) validationErrors.push('Descrição da carga é obrigatória.');
    if (netLoadKg <= 0) validationErrors.push('Peso inválido.');

    return { netLoadKg, stdLengthM, stdWidthM, stdHeightM, slingDetails, totalSlingsWeightKg, balancimTotalKg, grossLoadKg, grossLoadTons, craneCapTons, craneUtilizationPct, maxCintaPlanaPct, maxManilhaPct, outriggerEffortEsKgf, rmetKgfCm2, overloadedItems, validationErrors };
  }, [plan, accessories, selectedCrane, interpolationResult]);

  // HANDLERS
  const handleSaveDraft = (showFeedback = true) => {
    let finalPlanNumber = plan.assignedPlanNumber;
    if (!finalPlanNumber) {
      const nextNum = Number(lastPlanSeq) + 1;
      setLastPlanSeq(nextNum);
      finalPlanNumber = String(nextNum);
    }
    const planToSave = { ...plan, assignedPlanNumber: finalPlanNumber, status: plan.status || 'RASCUNHO' };
    setPlan(planToSave);
    setSavedPlans((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return safePrev.some(p => p.assignedPlanNumber === finalPlanNumber) ? safePrev.map(p => p.assignedPlanNumber === finalPlanNumber ? planToSave : p) : [planToSave, ...safePrev];
    });
    registerAuditLog('Salvar', `Plano Nº ${finalPlanNumber} salvo.`);
    if (showFeedback) {
      setEmissionFeedback({ type: 'success', title: 'Rascunho Salvo!', messages: ['O plano foi salvo no seu histórico.'] });
      setTimeout(() => setEmissionFeedback(null), 3000);
    }
  };

  const handleEmitPdf = () => {
    if (calculations.validationErrors.length > 0) { setEmissionFeedback({ type: 'error', title: 'Atenção', messages: calculations.validationErrors }); return; }
    if (plan.status !== 'APROVADO') {
       if(!window.confirm("Este plano ainda não está APROVADO. Deseja imprimir mesmo assim?")) return;
    }
    handleSaveDraft(false);
    setTimeout(() => { window.print(); }, 1000);
  };

  const handleStartNewPlan = () => {
    if (plan.assignedPlanNumber && plan.clientName) handleSaveDraft(false);
    setPlan({ ...DEFAULT_PLAN, assignedPlanNumber: null, status: 'RASCUNHO', attachments: [] });
    setEmissionFeedback(null);
    setActiveTab('uc05');
  };

  const handleLoadPlan = (savedPlan) => { setPlan(savedPlan); setActiveTab('uc05'); };

  const handleAddAccessoryToPlan = (accessoryId, forceAdd = false) => {
    const acc = (accessories || []).find((a) => a.id === accessoryId);
    if (!acc || acc.wearStatus === 'DESCARTADO') return;
    if (acc.wearStatus === 'ALERTA_DESGASTE' && !forceAdd) { setWearWarningModal(acc); return; }
    setPlan((prev) => ({ ...prev, selectedSlings: [...(prev.selectedSlings || []), { rowId: 'row-' + Date.now(), accessoryId: acc.id, qty: 2, angleDeg: acc.type === 'Manilha' ? 90 : 45, supportedWeightTons: Number((calculations.netLoadKg / 1000).toFixed(2)), loadSharingFactor: 1 }] }));
    setWearWarningModal(null);
  };
  const handleRemoveSlingRow = (rowId) => setPlan((prev) => ({ ...prev, selectedSlings: (prev.selectedSlings || []).filter((r) => r.rowId !== rowId) }));
  const handleUpdateSlingRow = (rowId, field, value) => setPlan((prev) => ({ ...prev, selectedSlings: (prev.selectedSlings || []).map((r) => r.rowId === rowId ? { ...r, [field]: value } : r) }));
  
  const handleSaveClient = (e) => {
    e.preventDefault();
    setClients(prev => [{ id: 'cli-' + Date.now(), ...clientForm }, ...(prev || [])]);
    setClientForm({ name: '', cnpj: '', address: '', site: '' });
    setEmissionFeedback({ type: 'success', title: 'Sucesso', messages: ['Cliente cadastrado!'] });
    setTimeout(() => setEmissionFeedback(null), 3000);
  };

  const handleSaveCrane = (e) => {
    e.preventDefault();
    const baseTable = [
      { radiusM: Number(craneForm.defaultColumnDistA) + 1, boomM: 5.1, capacityKgf: (Number(craneForm.nominalCapacityTons) * 1000) * 0.5 },
      { radiusM: Number(craneForm.defaultColumnDistA) + 5, boomM: 8.0, capacityKgf: (Number(craneForm.nominalCapacityTons) * 1000) * 0.2 }
    ];
    const newCrane = { id: 'crane-' + Date.now(), ...craneForm, nominalCapacityTons: Number(craneForm.nominalCapacityTons), selfWeightKgf: Number(craneForm.selfWeightKgf), defaultColumnDistA: Number(craneForm.defaultColumnDistA), defaultOutriggerSpanB: Number(craneForm.defaultOutriggerSpanB), chassis: '---', year: new Date().getFullYear(), loadTable: baseTable };
    setCranes(prev => [newCrane, ...(prev || [])]);
    setCraneForm({ code: '', model: '', truck: '', plate: '', nominalCapacityTons: '', selfWeightKgf: '', defaultColumnDistA: 2.95, defaultOutriggerSpanB: 5.7 });
    setEmissionFeedback({ type: 'success', title: 'Sucesso', messages: [`Guindaste ${newCrane.code} cadastrado!`] });
    setTimeout(() => setEmissionFeedback(null), 3000);
  };

  const handleSaveAccessory = (e) => {
    e.preventDefault();
    const newAcc = { id: 'acc-' + Date.now(), code: accForm.code, type: accForm.type, description: accForm.description, capacityTons: Number(accForm.capacityTons), unitWeightKg: Number(accForm.unitWeightKg), maxUsesLimit: Number(accForm.maxUsesLimit), usesCount: 0, wearStatus: 'OK', history: [], registeredAt: new Date().toLocaleDateString('pt-BR') };
    setAccessories(prev => [newAcc, ...(prev || [])]);
    setAccForm({ code: '', type: 'Cinta Plana', description: '', capacityTons: '', unitWeightKg: '', maxUsesLimit: 30 });
    setEmissionFeedback({ type: 'success', title: 'Sucesso', messages: [`Acessório ${newAcc.code} cadastrado!`] });
    setTimeout(() => setEmissionFeedback(null), 3000);
  };

  const filteredPlans = (savedPlans || []).filter(p => {
    const matchClient = (p.clientName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchNumber = String(p.assignedPlanNumber || '').includes(searchQuery);
    return matchClient || matchNumber;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* HEADER */}
      <header className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg font-black text-lg tracking-tighter flex items-center gap-1"><Shield className="w-5 h-5" />GR</div>
            <div>
              <h1 className="font-bold text-base tracking-tight">GUINDASTES RIBAS LTDA.</h1>
              <p className="text-xs text-slate-400">Sistema Centralizado de Plano de Rigging</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
             <select value={activeWsId} onChange={(e) => setActiveWsId(e.target.value)} className="bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-600">
              {workstations.map((ws) => <option key={ws.id} value={ws.id}>[{ws.hostname}] {ws.userName}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-slate-950/80 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 py-2">
            <nav className="flex flex-wrap gap-1.5">
              <button onClick={() => setActiveTab('uc05')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc05' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Calculator className="w-3.5 h-3.5" />Elaborar Plano</button>
              <button onClick={() => setActiveTab('history')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'history' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><FolderOpen className="w-3.5 h-3.5" />Meus Planos ({(savedPlans || []).length})</button>
              <button onClick={() => setActiveTab('clients')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'clients' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Building2 className="w-3.5 h-3.5" />Clientes</button>
              <button onClick={() => setActiveTab('uc02')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc02' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Truck className="w-3.5 h-3.5" />Guindastes</button>
              <button onClick={() => setActiveTab('uc03_04')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${activeTab === 'uc03_04' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'}`}><Package className="w-3.5 h-3.5" />Acessórios</button>
            </nav>
            <div className="flex items-center gap-2">
              {activeTab === 'uc05' && <button onClick={() => handleSaveDraft(true)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition"><Save className="w-3.5 h-3.5" /> Salvar Rascunho</button>}
              <button onClick={handleEmitPdf} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition"><Printer className="w-3.5 h-3.5" />Emitir PDF Completo</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 print:hidden">
        {emissionFeedback && (
          <div className={`mb-4 p-4 rounded-xl border flex items-start justify-between gap-3 ${emissionFeedback.type === 'error' ? 'bg-red-50 border-red-300 text-red-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}`}>
            <div className="flex items-start gap-2.5">
              {emissionFeedback.type === 'error' ? <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
              <div className="text-xs"><h4 className="font-bold text-sm">{emissionFeedback.title}</h4><ul className="list-disc list-inside mt-1">{emissionFeedback.messages.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
            </div>
            <button onClick={() => setEmissionFeedback(null)} className="text-xs font-bold underline opacity-75">Fechar</button>
          </div>
        )}

        {activeTab === 'uc05' && (
          <PlanWizard plan={plan} setPlan={setPlan} calculations={calculations} cranes={cranes} accessories={accessories} clients={clients} selectedCrane={selectedCrane} interpolationResult={interpolationResult} savedPlans={savedPlans} handlers={{ handleAddAccessoryToPlan, handleRemoveSlingRow, handleUpdateSlingRow, handleStartNewPlan, handleEmitPdf, handleSaveDraft }} />
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-200 pb-3 gap-3">
              <div>
                <h2 className="font-bold text-2xl text-slate-900">Meus Planos Salvos</h2>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input type="text" placeholder="Pesquisar cliente ou Nº do plano..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <button onClick={handleStartNewPlan} className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-lg shadow flex items-center gap-2 shrink-0"><Plus className="w-4 h-4" /> Novo</button>
              </div>
            </div>

            {filteredPlans.length === 0 ? (
               <div className="bg-white rounded-xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center"><FolderOpen className="w-12 h-12 text-slate-300 mb-3" /><h3 className="text-lg font-bold text-slate-700">Nenhum plano encontrado</h3></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlans.map(p => (
                  <div key={p.assignedPlanNumber} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                      <div><span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Nº {p.assignedPlanNumber}</span><h3 className="font-bold text-lg text-slate-900 mt-2 line-clamp-1" title={p.clientName}>{p.clientName || 'Cliente não informado'}</h3></div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${p.status === 'APROVADO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : p.status === 'EM_VALIDACAO' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>{p.status || 'RASCUNHO'}</span>
                    </div>
                    <div className="p-4 bg-slate-50 text-xs space-y-2">
                      <div className="flex justify-between"><span className="text-slate-500">Data:</span><span className="font-semibold text-slate-800">{p.date ? new Date(p.date).toLocaleDateString('pt-BR') : '---'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Carga:</span><span className="font-semibold text-slate-800 truncate pl-2">{p.loadDescription || '---'}</span></div>
                    </div>
                    <div className="p-3 border-t border-slate-100 flex gap-2"><button onClick={() => handleLoadPlan(p)} className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold py-2 rounded-lg transition">Abrir Plano</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
            <div className="lg:col-span-4">
              <form onSubmit={handleSaveClient} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 text-xs">
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-amber-600" />Cadastrar Novo Cliente</h2>
                <div><label className="font-semibold block mb-1">Razão Social *</label><input type="text" required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" /></div>
                <div><label className="font-semibold block mb-1">CNPJ *</label><input type="text" required value={clientForm.cnpj} onChange={(e) => setClientForm({ ...clientForm, cnpj: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                <div><label className="font-semibold block mb-1">Endereço Sede</label><input type="text" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" /></div>
                <div><label className="font-semibold block mb-1">Local da Obra (Padrão)</label><input type="text" value={clientForm.site} onChange={(e) => setClientForm({ ...clientForm, site: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" /></div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg mt-2">Salvar Cliente</button>
              </form>
            </div>
            <div className="lg:col-span-8">
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">Lista de Clientes ({(clients || []).length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(clients || []).map(c => (
                    <div key={c.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs">
                      <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
                      <p className="text-slate-500 font-mono mt-0.5">{c.cnpj}</p>
                      <p className="text-slate-400 mt-1 truncate">{c.site || c.address}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'uc02' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
             <div className="lg:col-span-4">
               <form onSubmit={handleSaveCrane} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 text-xs">
                  <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5"><Truck className="w-4 h-4 text-amber-600" />Novo Guindaste</h2>
                  <div><label className="font-semibold block mb-1">Código Frota *</label><input type="text" required placeholder="Ex: GR-03" value={craneForm.code} onChange={(e) => setCraneForm({ ...craneForm, code: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                  <div><label className="font-semibold block mb-1">Modelo *</label><input type="text" required placeholder="Ex: Palfinger MD 55" value={craneForm.model} onChange={(e) => setCraneForm({ ...craneForm, model: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-semibold block mb-1">Caminhão</label><input type="text" placeholder="Ex: Volvo" value={craneForm.truck} onChange={(e) => setCraneForm({ ...craneForm, truck: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" /></div>
                    <div><label className="font-semibold block mb-1">Placa</label><input type="text" placeholder="ABC-1234" value={craneForm.plate} onChange={(e) => setCraneForm({ ...craneForm, plate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-semibold block mb-1">Cap. Nominal (t) *</label><input type="number" required value={craneForm.nominalCapacityTons} onChange={(e) => setCraneForm({ ...craneForm, nominalCapacityTons: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                    <div><label className="font-semibold block mb-1">Peso Próprio (kgf) *</label><input type="number" required value={craneForm.selfWeightKgf} onChange={(e) => setCraneForm({ ...craneForm, selfWeightKgf: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-semibold block mb-1">Dist. Coluna A (m)</label><input type="number" step="0.1" value={craneForm.defaultColumnDistA} onChange={(e) => setCraneForm({ ...craneForm, defaultColumnDistA: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                    <div><label className="font-semibold block mb-1">Abertura B (m)</label><input type="number" step="0.1" value={craneForm.defaultOutriggerSpanB} onChange={(e) => setCraneForm({ ...craneForm, defaultOutriggerSpanB: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg mt-2">Cadastrar Guindaste</button>
               </form>
             </div>
             
             <div className="lg:col-span-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-amber-600"/>Frota Cadastrada (UC02)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(cranes || []).map((cr) => (
                      <div key={cr.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <div className="flex items-center justify-between"><span className="font-bold text-slate-900 text-sm">[{cr.code}] {cr.model}</span></div>
                        <p className="text-slate-600 mt-2">Placa: <span className="font-mono">{cr.plate}</span> • Cap: <strong>{cr.nominalCapacityTons} t</strong></p>
                        <p className="text-slate-600">Peso Próprio: <span className="font-mono">{cr.selfWeightKgf} kgf</span></p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(cr.loadTable || []).map((pt, i) => <span key={i} className="font-mono text-[11px] bg-white border border-slate-300 px-1.5 py-0.5 rounded shadow-sm">R={pt.radiusM}m → {pt.capacityKgf}kgf</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'uc03_04' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
            <div className="lg:col-span-4">
               <form onSubmit={handleSaveAccessory} className="bg-white rounded-xl shadow-sm border p-4 space-y-3 text-xs">
                <h2 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5"><Package className="w-4 h-4 text-amber-600" />Novo Acessório</h2>
                <div>
                  <label className="font-semibold block mb-1">Tipo *</label>
                  <select value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5">
                    <option value="Cinta Plana">Cinta Plana</option>
                    <option value="Cinta Tubular">Cinta Tubular</option>
                    <option value="Manilha">Manilha</option>
                    <option value="Laço de Cabo de Aço">Laço de Cabo de Aço</option>
                  </select>
                </div>
                <div><label className="font-semibold block mb-1">Código Único *</label><input type="text" required placeholder="Ex: CP-3M-6T-01" value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                <div><label className="font-semibold block mb-1">Descrição *</label><input type="text" required placeholder="Ex: Cinta plana 3m" value={accForm.description} onChange={(e) => setAccForm({ ...accForm, description: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="font-semibold block mb-1">Capacidade (t) *</label><input type="number" step="0.1" required value={accForm.capacityTons} onChange={(e) => setAccForm({ ...accForm, capacityTons: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                  <div><label className="font-semibold block mb-1">Peso (kg) *</label><input type="number" step="0.1" required value={accForm.unitWeightKg} onChange={(e) => setAccForm({ ...accForm, unitWeightKg: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                </div>
                <div><label className="font-semibold block mb-1">Limite de Ciclos *</label><input type="number" required value={accForm.maxUsesLimit} onChange={(e) => setAccForm({ ...accForm, maxUsesLimit: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" /></div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-2 rounded-lg mt-2">Cadastrar Acessório</button>
               </form>
            </div>
            
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-amber-600" />Acessórios Cadastrados</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(accessories || []).map((acc) => (
                    <div key={acc.id} className={`p-3 rounded-xl border text-xs ${acc.wearStatus === 'DESCARTADO' ? 'bg-slate-100 border-slate-300 opacity-75' : acc.wearStatus === 'ALERTA_DESGASTE' ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2"><span className="font-mono font-bold">{acc.code}</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${acc.wearStatus === 'DESCARTADO' ? 'bg-red-200' : acc.wearStatus === 'ALERTA_DESGASTE' ? 'bg-amber-300' : 'bg-emerald-100'}`}>{acc.wearStatus}</span></div>
                      <p className="font-semibold mt-1">{acc.description}</p>
                      <p className="text-slate-500 mt-0.5 font-mono text-[11px]">Cap: {acc.capacityTons}t | Ciclos: {acc.usesCount}/{acc.maxUsesLimit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

           {/* =====================================================================
          ÁREA DE IMPRESSÃO COMPLETA DO PDF (Condicional)
          ===================================================================== */}
      <div id="print-section" className="hidden print:block bg-white text-black p-0 m-0 font-sans text-[11px] w-full">
        
        {/* PÁGINA 1: PLANILHA DE CAPACIDADES E RESUMO */}
        {(plan.selectedDocs?.planilha ?? true) && (
          <div className="p-6 w-full max-w-[210mm] mx-auto break-inside-avoid">
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
              <div>
                <h1 className="text-lg font-black">GUINDASTES RIBAS LTDA.</h1>
                <p className="text-[11px]">PLANO DE RIGGING — DOCUMENTO TÉCNICO OPERACIONAL</p>
              </div>
              <div className="text-right">
                <p className="font-bold">PLANO Nº {plan.assignedPlanNumber || lastPlanSeq + 1}</p>
                <p>Data: {plan.date ? plan.date.split('-').reverse().join('/') : '---'}</p>
                <p>ART: {plan.creaArtNumber || '1720264496217'}</p>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-center text-[10px] table-fixed">
              <tbody>
                <tr>
                  <td colSpan={2} className="border border-black p-1 text-left w-32 font-bold bg-slate-100">CLIENTE:</td>
                  <td colSpan={6} className="border border-black p-1 text-left font-bold">{plan.clientName}</td>
                  <td className="border border-black p-1 text-left w-16 font-bold bg-slate-100">LOCAL:</td>
                  <td colSpan={2} className="border border-black p-1 text-left font-bold">{plan.serviceSite}</td>
                </tr>
                
                <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left border border-black">DADOS DA CARGA:</td></tr>
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
                
                <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left border border-black">LINGADA / AMARRAS</td></tr>
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
                  <td colSpan={9} className="border border-black p-1 text-right font-bold bg-slate-50">PESO TOTAL DA LINGADA / AMARRAÇÃO:</td>
                  <td colSpan={2} className="border border-black p-1 font-mono font-bold bg-slate-50">{calculations.totalSlingsWeightKg.toFixed(2)}</td>
                </tr>
                
                <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left border border-black">DISPOSITIVOS / BALANCIM</td></tr>
                <tr>
                  <td colSpan={9} className="border border-black p-1 text-right font-bold bg-slate-50">PESO TOTAL DISPOSITIVOS:</td>
                  <td colSpan={2} className="border border-black p-1 font-mono font-bold bg-slate-50">{calculations.balancimTotalKg.toFixed(2)}</td>
                </tr>

                <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left border border-black">INFORMAÇÕES DO GUINDASTE</td></tr>
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

                <tr><td colSpan={11} className="bg-slate-200 font-bold p-1 text-left border border-black">RESUMO DOS CÁLCULOS</td></tr>
                <tr>
                  <td colSpan={6} className="border border-black p-1 text-left">Total da carga bruta</td>
                  <td colSpan={3} className="border border-black p-1 text-right font-mono">{calculations.grossLoadTons.toFixed(3)}</td>
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
              </tbody>
            </table>
          </div>
        )}

        {/* PÁGINA 2: MEMORIAL DE CÁLCULO */}
        {(plan.selectedDocs?.memorial ?? true) && (
          <div className="page-break p-6 w-full max-w-[210mm] mx-auto">
            <h1 className="text-lg font-black border-b-2 border-black pb-2 mb-4">MEMORIAL DE CÁLCULO - PLANO Nº {plan.assignedPlanNumber || lastPlanSeq + 1}</h1>
            <div className="space-y-4 text-xs">
              <div>
                <h2 className="font-bold text-sm mb-1">1. Análise de Tensões nos Acessórios</h2>
                {calculations.slingDetails.map((s, idx) => (
                  <div key={idx} className="mb-3 p-3 bg-slate-50 border border-slate-200">
                    <p className="font-bold">{s.accessory.code} - {s.accessory.description}</p>
                    {s.accessory.type === 'Manilha' ? (
                      <p>Te = Carga Suportada / Nº de ramais = {s.supportedWeightTons} t</p>
                    ) : (
                      <p>Te = (1 / cos {s.angleDeg}°) * (Carga / Ramais) = (1 / {Math.cos((Number(s.angleDeg) * Math.PI) / 180).toFixed(2)}) * ({s.supportedWeightTons} / {s.loadSharingFactor || 1}) = <strong>{s.tensionTons.toFixed(2)} t</strong></p>
                    )}
                    <p>Taxa de Utilização (TU) = {s.tensionTons.toFixed(2)} t / {s.accessory.capacityTons} t = <strong>{s.utilizationPct.toFixed(2)}%</strong></p>
                    {s.utilizationPct > 85 && <p className="text-red-600 font-bold">ATENÇÃO: TU acima de 85%!</p>}
                  </div>
                ))}
              </div>
              <div>
                <h2 className="font-bold text-sm mb-1">2. Esforço nas Sapatas</h2>
                <p>Peso do Guindaste (Pg) = {selectedCrane?.selfWeightKgf} kgf</p>
                <p>Peso da Carga + Acessórios (Pc) = {calculations.grossLoadKg} kgf</p>
                <p>Raio de Operação (Ro) = {plan.operatingRadiusM} m</p>
                <p>Distância eixo à sapata (a) = {plan.columnDistA} m | Abertura entre sapatas (b) = {plan.outriggerSpanB} m</p>
                <p>Momento (M) = Pc × Ro = {calculations.grossLoadKg} × {plan.operatingRadiusM} = <strong>{Math.round(calculations.grossLoadKg * Number(plan.operatingRadiusM))} kgf.m</strong></p>
                <p>Força (F) = M / (a + b) = {Math.round(calculations.grossLoadKg * Number(plan.operatingRadiusM))} / ({plan.columnDistA} + {plan.outriggerSpanB}) = <strong>{Math.round((calculations.grossLoadKg * Number(plan.operatingRadiusM)) / (Number(plan.columnDistA) + Number(plan.outriggerSpanB)))} kgf</strong></p>
                <p>Esforço Sapatas (ES) = (Pg / 2) + F = ({selectedCrane?.selfWeightKgf} / 2) + {Math.round((calculations.grossLoadKg * Number(plan.operatingRadiusM)) / (Number(plan.columnDistA) + Number(plan.outriggerSpanB)))} = <strong>{calculations.outriggerEffortEsKgf} kgf</strong></p>
              </div>
              <div>
                <h2 className="font-bold text-sm mb-1">3. Resistência Mínima do Terreno (RMET)</h2>
                <p>Área de Patolamento (AP) = Comp. Dormente × Larg. Dormente × Qtd = {plan.sleeperLengthCm} × {plan.sleeperWidthCm} × {plan.sleeperCount} = {calculations.patolamentoAreaCm2} cm²</p>
                <p>RMET = ES / AP = {calculations.outriggerEffortEsKgf} / {calculations.patolamentoAreaCm2} = <strong>{calculations.rmetKgfCm2.toFixed(2)} kgf/cm²</strong></p>
              </div>
            </div>
          </div>
        )}

              {/* PÁGINA 3: REGISTRO FOTOGRÁFICO E DESENHO TÉCNICO */}
        {(plan.selectedDocs?.desenho ?? true) && (
          <div className="page-break p-6 w-full max-w-[210mm] mx-auto flex flex-col items-center">
            <h1 className="text-lg font-black border-b-2 border-black pb-2 mb-6 w-full text-left">
              REGISTRO FOTOGRÁFICO / DESENHO TÉCNICO - PLANO Nº {plan.assignedPlanNumber || lastPlanSeq + 1}
            </h1>
            
            {/* Se houver fotos anexadas, mostra as fotos */}
            {plan.attachments && plan.attachments.length > 0 ? (
              <div className="w-full grid grid-cols-2 gap-4">
                {plan.attachments.map((file, idx) => (
                  <div key={idx} className="border border-slate-300 p-2 bg-white flex flex-col items-center break-inside-avoid shadow-sm">
                    <img src={file.url} alt={file.name} className="max-h-[350px] w-full object-contain" />
                    <p className="text-[10px] mt-2 text-center text-slate-600 font-bold truncate w-full" title={file.name}>
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              /* Se NÃO houver fotos, mostra o desenho esquemático de fallback */
              <div className="w-full border-2 border-black p-4 rounded-lg flex flex-col items-center bg-slate-50">
                 <svg width="400" height="300" viewBox="0 0 400 300" className="w-full max-w-[500px]">
                    {/* Desenho Esquemático Simples */}
                    <rect x="150" y="100" width="100" height="80" fill="#ccc" stroke="#333" strokeWidth="2" />
                    <text x="200" y="145" textAnchor="middle" fontSize="12" fontWeight="bold">CARGA</text>
                    
                    {/* Linhas da Lingada */}
                    <line x1="200" y1="20" x2="150" y2="100" stroke="red" strokeWidth="2" />
                    <line x1="200" y1="20" x2="250" y2="100" stroke="red" strokeWidth="2" />
                    
                    {/* Gancho */}
                    <circle cx="200" cy="20" r="5" fill="#333" />
                    
                    {/* Labels */}
                    <text x="160" y="60" textAnchor="middle" fontSize="10">Cinta</text>
                    <text x="240" y="60" textAnchor="middle" fontSize="10">Cinta</text>
                    <text x="200" y="10" textAnchor="middle" fontSize="10">Gancho</text>
                    
                    {/* Dimensões */}
                    <line x1="150" y1="190" x2="250" y2="190" stroke="#333" strokeWidth="1" />
                    <text x="200" y="205" textAnchor="middle" fontSize="10">Largura: {calculations.stdWidthM}m</text>
                 </svg>
                 <p className="text-xs mt-4 font-bold text-center text-slate-500">
                   Nenhuma foto anexada. Exibindo esquema ilustrativo da amarração.
                 </p>
              </div>
            )}
          </div>
        )}

        {/* PÁGINA 4: ART DO CREA-PR */}
        {(plan.selectedDocs?.art ?? true) && (
          <div className="page-break p-6 w-full max-w-[210mm] mx-auto">
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
                 <p className="p-2"><strong>Contrato:</strong> (Sem número) | <strong>Celebrado em:</strong> {plan.date ? plan.date.split('-').reverse().join('/') : '---'} | <strong>Valor:</strong> R$ {plan.contractValueBRL}</p>
               </div>
               <div>
                 <h2 className="font-bold bg-slate-100 p-1 border border-slate-300">3. Dados da Obra/Serviço</h2>
                 <p className="p-2"><strong>Endereço:</strong> {plan.serviceSite}</p>
                 <p className="p-2"><strong>Data de Início:</strong> {plan.date ? plan.date.split('-').reverse().join('/') : '---'}</p>
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
        )}

        {/* PÁGINA 5: LAUDO DE INSPEÇÃO */}
        {(plan.selectedDocs?.laudo ?? true) && (
          <div className="page-break p-6 w-full max-w-[210mm] mx-auto">
            <h1 className="text-lg font-black border-b-2 border-black pb-2 mb-4">LAUDO DE INSPEÇÃO DE EQUIPAMENTO</h1>
            <div className="space-y-4 text-[10px]">
              <div className="bg-slate-100 p-2 border border-slate-300">
                <p><strong>Equipamento:</strong> {selectedCrane?.model} | <strong>Caminhão:</strong> {selectedCrane?.truck} | <strong>Placas:</strong> {selectedCrane?.plate} | <strong>Chassi:</strong> {selectedCrane?.chassis}</p>
              </div>
              
              <table className="w-full border-collapse border border-black">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="border border-black p-1 text-left w-1/3">Item Inspecionado</th>
                    <th className="border border-black p-1 text-left">Descrição</th>
                    <th className="border border-black p-1 text-center w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-1 font-bold" rowSpan={2}>Sistema de Freios</td>
                    <td className="border border-black p-1">Freios de serviço: eficiência e desgaste de lonas</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">Freio de estacionamento: funcionamento e efetividade</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-bold" rowSpan={3}>Segurança e Rodagem</td>
                    <td className="border border-black p-1">Sistema de alerta sonoro e luzes (buzina, setas, faróis, ré, freio)</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">Espelhos retrovisores interno e externo</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">Limpadores, estepe, macaco, extintor e chave de roda</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-bold" rowSpan={2}>Sistema de Transmissão</td>
                    <td className="border border-black p-1">Motor: níveis de óleo, ruídos anormais e funcionamento</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">Transmissão: funcionamento diferencial e trocas de marchas</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-bold" rowSpan={2}>Sistema de Direção</td>
                    <td className="border border-black p-1">Hidráulica: vazamentos e funcionamento adequado</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">Eixo de direção, pneus e alinhamento</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-bold" rowSpan={2}>Sistema de Içamento</td>
                    <td className="border border-black p-1">Lança, JIB, Sapatas e alavancas de comando</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1">Nível de óleo hidráulico e sinalizadores de segurança</td>
                    <td className="border border-black p-1 text-center font-bold text-emerald-600">OK</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-8 border-t border-black pt-4 text-center">
                <p className="mb-8">Com base na vistoria, informo que o guindaste está <strong>LIBERADO</strong> para trabalho.</p>
                <p className="font-bold">_______________________________________________________</p>
                <p className="font-bold">GIULIANO CESAR BREDA DE SOUZA</p>
                <p>Engenheiro Mecânico - CREA 78755/D - PR</p>
              </div>
            </div>
          </div>
        )}

        {/* PÁGINA 6: PROCEDIMENTO OPERACIONAL (POP) */}
        {(plan.selectedDocs?.pop ?? true) && (
          <div className="page-break p-6 w-full max-w-[210mm] mx-auto">
            <h1 className="text-lg font-black border-b-2 border-black pb-2 mb-4">PROCEDIMENTO OPERACIONAL (POP)</h1>
            <div className="space-y-4 text-[10px]">
              <div>
                <h2 className="font-bold text-sm bg-slate-100 p-1 border border-slate-300">1. ISOLAMENTO DA ÁREA</h2>
                <p className="p-2"><strong>Objetivo:</strong> Garantir segurança de pessoas e equipamentos durante a operação.</p>
                <ul className="list-disc list-inside p-2 space-y-1">
                  <li>Delimitar e sinalizar a área de risco.</li>
                  <li>Impedir circulação de pessoas não autorizadas.</li>
                  <li>Verificar ausência de interferências: rede elétrica, estruturas, veículos.</li>
                  <li>Liberar área somente após checagem.</li>
                </ul>
              </div>
              <div>
                <h2 className="font-bold text-sm bg-slate-100 p-1 border border-slate-300">2. PATOLAMENTO DO GUINDASTE</h2>
                <p className="p-2"><strong>Objetivo:</strong> Garantir estabilidade e segurança do equipamento de içamento.</p>
                <ul className="list-disc list-inside p-2 space-y-1">
                  <li>Posicionar o guindaste conforme plano.</li>
                  <li>Avaliar capacidade do solo (RMET = {calculations.rmetKgfCm2.toFixed(2)} kgf/cm²) e posicionar os dormentes.</li>
                  <li>Estender e nivelar estabilizadores a 100%.</li>
                </ul>
              </div>
              <div>
                <h2 className="font-bold text-sm bg-slate-100 p-1 border border-slate-300">3. POSICIONAMENTO DO VEÍCULO DE CARGA</h2>
                <p className="p-2"><strong>Objetivo:</strong> Facilitar içamento e transporte seguro da carga.</p>
                <ul className="list-disc list-inside p-2 space-y-1">
                  <li>Aproximar carreta ou veículo guiado pelo sinaleiro.</li>
                  <li>Acionar freio, calçar rodas e desligar motor.</li>
                  <li>Garantir espaço para manobra do gancho e acesso à carga.</li>
                </ul>
              </div>
              <div>
                <h2 className="font-bold text-sm bg-slate-100 p-1 border border-slate-300">4. IÇAMENTO DA CARGA</h2>
                <p className="p-2"><strong>Objetivo:</strong> Elevar e movimentar carga com segurança e estabilidade.</p>
                <ul className="list-disc list-inside p-2 space-y-1">
                  <li>Verificar cintas, manilhas e pontos de ancoragem.</li>
                  <li>Montar amarração conforme plano de rigging.</li>
                  <li>Realizar elevação de teste (10–20 cm).</li>
                  <li>Elevar carga lentamente, mantendo comunicação com sinaleiro.</li>
                  <li>Não movimentar carga sobre pessoas.</li>
                  <li>Respeitar limites do equipamento e condições ambientais (vento máx {plan.maxWindSpeedMs} m/s, visibilidade).</li>
                </ul>
              </div>
              <div>
                <h2 className="font-bold text-sm bg-slate-100 p-1 border border-slate-300">5. DESCARGA DA CARGA</h2>
                <p className="p-2"><strong>Objetivo:</strong> Depositar carga com segurança e estabilidade.</p>
                <ul className="list-disc list-inside p-2 space-y-1">
                  <li>Aproximar lentamente da posição de apoio.</li>
                  <li>Baixar carga de forma controlada.</li>
                  <li>Garantir apoio estável antes de soltar amarrações.</li>
                  <li>Afastar equipe da zona de risco.</li>
                  <li>Liberar área após conferência final.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );

}