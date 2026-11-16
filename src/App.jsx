import { useState, useMemo } from 'react';
import {
  Shield,
  Truck,
  Package,
  FileText,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Printer,
  History,
  Monitor,
  Network,
  Calculator,
  Check,
  Ban,
  Save,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Download,
} from 'lucide-react';
import seed from './data/seed.json';
import { DEFAULT_PLAN } from './data/defaultPlan';
import { usePersistedState } from './db/usePersistedState';
import { db } from './db/db';
import PlanWizard from './components/PlanWizard';

export default function App() {
  const [workstations, setWorkstations] = usePersistedState('workstations', seed.workstations);
  const [activeWsId, setActiveWsId] = usePersistedState('activeWsId', seed.workstations[0].id);
  const [clients, setClients] = usePersistedState('clients', seed.clients || []);
  const [savedPlans, setSavedPlans] = usePersistedState('savedPlans', db.get('savedPlans', []));
  const [searchQuery, setSearchQuery] = useState('');

  const activeWs = useMemo(
    () => workstations.find((w) => w.id === activeWsId) || workstations[0],
    [workstations, activeWsId]
  );

  const [auditLogs, setAuditLogs] = usePersistedState('auditLogs', seed.auditLogs);

  const registerAuditLog = (moduleName, actionText) => {
    const now = new Date();
    const formattedDate =
      now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    setAuditLogs((prev) => [
      {
        id: 'log-' + Date.now(),
        timestamp: formattedDate,
        hostname: activeWs.hostname,
        ip: activeWs.ip,
        userName: activeWs.userName,
        role: activeWs.role,
        module: moduleName,
        action: actionText,
      },
      ...prev,
    ]);
  };

  const [activeTab, setActiveTab] = useState('uc05');
  const [lastPlanSeq, setLastPlanSeq] = usePersistedState('lastPlanSeq', seed.sequences.lastPlanSeq);
  const [cranes, setCranes] = usePersistedState('cranes', seed.cranes);
  const [accessories, setAccessories] = usePersistedState('accessories', seed.accessories);
  const [plan, setPlan] = usePersistedState('plan', DEFAULT_PLAN);
  const [wearWarningModal, setWearWarningModal] = useState(null);
  const [emissionFeedback, setEmissionFeedback] = useState(null);

  const [clientForm, setClientForm] = useState({ name: '', cnpj: '', address: '', site: '' });
  const [craneForm, setCraneForm] = useState({
    code: '',
    model: '',
    truck: '',
    plate: '',
    nominalCapacityTons: '',
    selfWeightKgf: '',
    defaultColumnDistA: 2.95,
    defaultOutriggerSpanB: 5.7,
  });
  const [accForm, setAccForm] = useState({
    code: '',
    type: 'Cinta Plana',
    description: '',
    capacityTons: '',
    unitWeightKg: '',
    maxUsesLimit: 30,
  });

  // CÁLCULOS CORRIGIDOS (ENGENHARIA RIBAS)
  const toStandardKg = (val, unit) => (unit === 't' ? Number(val) * 1000 : Number(val)) || 0;
  const toStandardMeters = (val, unit) => (unit === 'cm' ? Number(val) / 100 : Number(val)) || 0;

  const selectedCrane = useMemo(
    () => (cranes || []).find((c) => c.id === plan.selectedCraneId) || cranes[0],
    [cranes, plan.selectedCraneId]
  );

  const interpolationResult = useMemo(() => {
    if (!selectedCrane || !selectedCrane.loadTable || selectedCrane.loadTable.length === 0)
      return { valid: false, status: 'SEM_TABELA', capacityKgf: 0, capacityTons: 0, message: 'Sem tabela.' };

    const sorted = [...selectedCrane.loadTable].sort((a, b) => a.radiusM - b.radiusM);
    const r = Number(plan.operatingRadiusM);

    if (isNaN(r) || r < sorted[0].radiusM || r > sorted[sorted.length - 1].radiusM)
      return { valid: false, status: 'FORA_DA_FAIXA', capacityKgf: 0, capacityTons: 0, message: 'Raio fora da faixa.' };

    const exactMatch = sorted.find((pt) => Math.abs(pt.radiusM - r) < 0.0001);
    if (exactMatch)
      return {
        valid: true,
        status: 'TABELADA',
        capacityKgf: exactMatch.capacityKgf,
        capacityTons: exactMatch.capacityKgf / 1000,
        message: 'Capacidade exata.',
      };

    let lower = sorted[0],
      upper = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (r > sorted[i].radiusM && r < sorted[i + 1].radiusM) {
        lower = sorted[i];
        upper = sorted[i + 1];
        break;
      }
    }

    const interpolatedKgf = Math.round(
      lower.capacityKgf +
        ((r - lower.radiusM) / (upper.radiusM - lower.radiusM)) *
          (upper.capacityKgf - lower.capacityKgf)
    );

    return {
      valid: true,
      status: 'INTERPOLADA',
      capacityKgf: interpolatedKgf,
      capacityTons: interpolatedKgf / 1000,
      message: `Interpolado: ${interpolatedKgf} kgf.`,
    };
  }, [selectedCrane, plan.operatingRadiusM]);

  const calculations = useMemo(() => {
    const netLoadKg = toStandardKg(plan.netWeightVal, plan.netWeightUnit);
    const extraLoadKg = toStandardKg(plan.extraWeightVal, plan.extraWeightUnit);
    const stdLengthM = toStandardMeters(plan.lengthVal, plan.lengthUnit);
    const stdWidthM = toStandardMeters(plan.widthVal, plan.widthUnit);
    const stdHeightM = toStandardMeters(plan.heightVal, plan.heightUnit);

    const patolamentoAreaCm2 =
      Number(plan.sleeperLengthCm) * Number(plan.sleeperWidthCm) * Number(plan.sleeperCount) || 0;

    const slingDetails = (plan.selectedSlings || [])
      .map((row) => {
        const acc = (accessories || []).find((a) => a.id === row.accessoryId);
        if (!acc) return null;
        const qty = Number(row.qty) || 1;
        const totalItemWeightKg = Number((qty * acc.unitWeightKg).toFixed(2));
        const loadPerBranchTons = Number(row.supportedWeightTons) / qty;
        const rad = (Number(row.angleDeg) * Math.PI) / 180;
        const tensionTons =
          acc.type === 'Manilha' ? loadPerBranchTons : loadPerBranchTons / (Math.sin(rad) || 1);
        const utilizationPct = acc.capacityTons > 0 ? (tensionTons / acc.capacityTons) * 100 : 0;
        return {
          ...row,
          accessory: acc,
          totalItemWeightKg,
          tensionTons,
          utilizationPct,
          isOverLimit: utilizationPct > 85.0,
        };
      })
      .filter(Boolean);

    const totalSlingsWeightKg = Number(
      slingDetails.reduce((acc, item) => acc + item.totalItemWeightKg, 0).toFixed(2)
    );
    const balancimQty = Number(plan.balancimQty) || 1;
    const balancimTotalKg = plan.useBalancim
      ? Number(
          (
            balancimQty *
            toStandardKg(plan.balancimUnitWeightVal, plan.balancimWeightUnit)
          ).toFixed(2)
        )
      : 0;

    const grossLoadKg = Number(
      (netLoadKg + totalSlingsWeightKg + balancimTotalKg + extraLoadKg).toFixed(2)
    );
    const grossLoadTons = grossLoadKg / 1000;
    const craneCapTons = interpolationResult.valid ? interpolationResult.capacityTons : 0;
    const craneUtilizationPct = craneCapTons > 0 ? (grossLoadTons / craneCapTons) * 100 : 0;

    const outriggerEffortEsKgf = Math.round(
      (selectedCrane?.selfWeightKgf || 0) / 2 +
        (grossLoadKg * Number(plan.operatingRadiusM)) /
          (Number(plan.columnDistA) + Number(plan.outriggerSpanB))
    );
    const rmetKgfCm2 = patolamentoAreaCm2 > 0 ? outriggerEffortEsKgf / patolamentoAreaCm2 : 0;

    const overloadedItems = [];
    if (craneUtilizationPct > 85.0)
      overloadedItems.push(`Guindaste (${craneUtilizationPct.toFixed(1)}% > 85%)`);
    slingDetails.forEach((s) => {
      if (s.isOverLimit)
        overloadedItems.push(`${s.accessory.code} (${s.utilizationPct.toFixed(1)}% > 85%)`);
    });

    const validationErrors = [];
    if (!plan.clientName || !plan.clientName.trim()) validationErrors.push('Cliente é obrigatório.');
    if (!plan.serviceSite || !plan.serviceSite.trim()) validationErrors.push('Local da Obra é obrigatório.');
    if (!plan.loadDescription || !plan.loadDescription.trim())
      validationErrors.push('Descrição da carga é obrigatória.');
    if (netLoadKg <= 0) validationErrors.push('Peso inválido.');

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
      outriggerEffortEsKgf,
      patolamentoAreaCm2,
      rmetKgfCm2,
      overloadedItems,
      validationErrors,
    };
  }, [plan, accessories, selectedCrane, interpolationResult]);

  // HANDLERS E INTEGRAÇÃO DB JSON
  const handleSaveDraft = (showFeedback = true) => {
    let finalPlanNumber = plan.assignedPlanNumber;
    if (!finalPlanNumber) {
      const nextNum = Number(lastPlanSeq) + 1;
      setLastPlanSeq(nextNum);
      finalPlanNumber = String(nextNum);
    }
    const planToSave = {
      ...plan,
      assignedPlanNumber: finalPlanNumber,
      status: plan.status || 'RASCUNHO',
      savedAt: new Date().toISOString(),
    };
    setPlan(planToSave);
    const updatedPlans = db.savePlan(planToSave);
    setSavedPlans(updatedPlans);
    registerAuditLog('Salvar', `Plano Nº ${finalPlanNumber} salvo no banco JSON.`);
    if (showFeedback) {
      setEmissionFeedback({
        type: 'success',
        title: 'Plano Salvo com Sucesso!',
        messages: [`Plano Nº ${finalPlanNumber} armazenado em JSON local.`],
      });
      setTimeout(() => setEmissionFeedback(null), 3000);
    }
  };

  const handleEmitPdf = () => {
    if (calculations.validationErrors.length > 0) {
      setEmissionFeedback({ type: 'error', title: 'Atenção', messages: calculations.validationErrors });
      return;
    }
    if (plan.status !== 'APROVADO') {
      if (!window.confirm('Este plano ainda não está APROVADO. Deseja imprimir mesmo assim?')) return;
    }
    handleSaveDraft(false);
    setTimeout(() => {
      window.print();
    }, 1000);
  };

  const handleStartNewPlan = () => {
    if (plan.assignedPlanNumber && plan.clientName) handleSaveDraft(false);
    setPlan({ ...DEFAULT_PLAN, assignedPlanNumber: null, status: 'RASCUNHO', attachments: [] });
    setEmissionFeedback(null);
    setActiveTab('uc05');
  };

  const handleLoadPlan = (savedPlan) => {
    setPlan(savedPlan);
    setActiveTab('uc05');
  };

  const handleAddAccessoryToPlan = (accessoryId, forceAdd = false) => {
    const acc = (accessories || []).find((a) => a.id === accessoryId);
    if (!acc || acc.wearStatus === 'DESCARTADO') return;
    if (acc.wearStatus === 'ALERTA_DESGASTE' && !forceAdd) {
      setWearWarningModal(acc);
      return;
    }
    setPlan((prev) => ({
      ...prev,
      selectedSlings: [
        ...(prev.selectedSlings || []),
        {
          rowId: 'row-' + Date.now(),
          accessoryId: acc.id,
          qty: 2,
          angleDeg: acc.type === 'Manilha' ? 90 : 45,
          supportedWeightTons: Number((calculations.netLoadKg / 1000).toFixed(2)),
          loadSharingFactor: 1,
        },
      ],
    }));
    setWearWarningModal(null);
  };

  const handleRemoveSlingRow = (rowId) =>
    setPlan((prev) => ({
      ...prev,
      selectedSlings: (prev.selectedSlings || []).filter((r) => r.rowId !== rowId),
    }));

  const handleUpdateSlingRow = (rowId, field, value) =>
    setPlan((prev) => ({
      ...prev,
      selectedSlings: (prev.selectedSlings || []).map((r) =>
        r.rowId === rowId ? { ...r, [field]: value } : r
      ),
    }));

  const filteredPlans = (savedPlans || []).filter((p) => {
    const matchClient = (p.clientName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchNumber = String(p.assignedPlanNumber || '').includes(searchQuery);
    return matchClient || matchNumber;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* HEADER DO SISTEMA */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wider uppercase">GUINDASTES RIBAS LTDA.</h1>
              <p className="text-xs text-slate-400">Sistema Centralizado de Plano de Rigging</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={activeWsId}
              onChange={(e) => setActiveWsId(e.target.value)}
              className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 border border-slate-700 outline-none"
            >
              {workstations.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  [{ws.hostname}] {ws.userName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* NAVEGAÇÃO POR ABAS */}
      <nav className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('uc05')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'uc05'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" /> Gerador de Plano de Carga
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'archive'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-4 h-4" /> Arquivo de Planos Salvos ({savedPlans.length})
          </button>
        </div>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {emissionFeedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              emissionFeedback.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {emissionFeedback.type === 'error' ? (
                <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              )}
              <span>{emissionFeedback.messages ? emissionFeedback.messages.join(' ') : emissionFeedback.title}</span>
            </div>
            <button
              onClick={() => setEmissionFeedback(null)}
              className="font-bold text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        )}

        {activeTab === 'uc05' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Plano de Rigging {plan.assignedPlanNumber ? `Nº ${plan.assignedPlanNumber}` : '(Novo Rascunho)'}
                </h2>
                <p className="text-xs text-slate-500">Preencha as etapas do wizard para gerar o documento técnico oficial.</p>
              </div>
              <button
                onClick={handleStartNewPlan}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Novo Plano
              </button>
            </div>

            <PlanWizard
              plan={plan}
              setPlan={setPlan}
              calculations={calculations}
              cranes={cranes}
              accessories={accessories}
              clients={clients}
              selectedCrane={selectedCrane}
              interpolationResult={interpolationResult}
              handlers={{
                handleAddAccessoryToPlan,
                handleRemoveSlingRow,
                handleUpdateSlingRow,
                handleSaveDraft: () => handleSaveDraft(true),
                handleEmitPdf,
              }}
              savedPlans={savedPlans}
            />
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Arquivo de Planos de Carga</h2>
                <p className="text-xs text-slate-500">Histórico de todos os planos gerados e salvos no sistema.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente ou número..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            {filteredPlans.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                Nenhum plano encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Nº</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Descrição da Carga</th>
                      <th className="p-3">Data</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPlans.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold font-mono">#{p.assignedPlanNumber || '---'}</td>
                        <td className="p-3 font-medium text-slate-800">{p.clientName || 'Não informado'}</td>
                        <td className="p-3 text-slate-600">{p.loadDescription || '---'}</td>
                        <td className="p-3 text-slate-500">
                          {p.savedAt ? new Date(p.savedAt).toLocaleDateString('pt-BR') : '---'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              p.status === 'APROVADO'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {p.status || 'RASCUNHO'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleLoadPlan(p)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded transition-colors"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}