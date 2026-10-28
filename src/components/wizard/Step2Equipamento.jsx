
import { Package, Plus, Trash2 } from 'lucide-react';

export default function Step2Equipamento({ plan, setPlan, cranes, accessories, calculations, interpolationResult, handleAddAccessoryToPlan, handleRemoveSlingRow, handleUpdateSlingRow }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-600" /> Dados da Carga e Equipamentos
        </h2>
      </div>
      
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-1">1. Especificações da Carga</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-1">
            <label className="font-semibold text-slate-700 block mb-1">Descrição *</label>
            <input type="text" value={plan.loadDescription} onChange={(e) => setPlan({ ...plan, loadDescription: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5" />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Peso Líquido *</label>
            <div className="flex gap-1">
              <input type="number" value={plan.netWeightVal} onChange={(e) => setPlan({ ...plan, netWeightVal: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" />
              <select value={plan.netWeightUnit} onChange={(e) => setPlan({ ...plan, netWeightUnit: e.target.value })} className="bg-slate-200 border border-slate-300 rounded-lg px-2 font-bold">
                <option value="kg">kg</option><option value="t">t</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <div><label className="text-[10px] text-slate-500 block">Comp.</label><input type="number" value={plan.lengthVal} onChange={(e) => setPlan({ ...plan, lengthVal: e.target.value })} className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono" /></div>
            <div><label className="text-[10px] text-slate-500 block">Larg.</label><input type="number" value={plan.widthVal} onChange={(e) => setPlan({ ...plan, widthVal: e.target.value })} className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono" /></div>
            <div><label className="text-[10px] text-slate-500 block">Alt.</label><input type="number" value={plan.heightVal} onChange={(e) => setPlan({ ...plan, heightVal: e.target.value })} className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono" /></div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-1">2. Guindaste</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Equipamento Cadastrado</label>
              <select value={plan.selectedCraneId} onChange={(e) => { const cr = cranes.find(c => c.id === e.target.value); setPlan({ ...plan, selectedCraneId: e.target.value, columnDistA: cr ? cr.defaultColumnDistA : plan.columnDistA, outriggerSpanB: cr ? cr.defaultOutriggerSpanB : plan.outriggerSpanB }); }} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold">
              {cranes.map(c => <option key={c.id} value={c.id}>[{c.code}] {c.model} - Cap: {c.nominalCapacityTons}t</option>)}
              </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Raio (m) *</label>
            <input type="number" step="0.1" value={plan.operatingRadiusM} onChange={(e) => setPlan({ ...plan, operatingRadiusM: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold" />
          </div>
        </div>
        <div className={`p-2 rounded border text-xs flex justify-between items-center ${!interpolationResult.valid ? 'bg-red-50 text-red-900 border-red-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'}`}>
            <span><strong>Status:</strong> {interpolationResult.status}</span>
            <span>{interpolationResult.message}</span>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-1">3. Acessórios</h3>
        <div className="flex gap-2 text-xs mb-3">
          <select id="select-acc-wizard" className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white" defaultValue="">
            <option value="" disabled>Selecione um acessório...</option>
            {accessories.filter(a => a.wearStatus !== 'DESCARTADO').map(a => (
              <option key={a.id} value={a.id}>[{a.code}] {a.description} | Peso: {a.unitWeightKg}kg {a.wearStatus === 'ALERTA_DESGASTE' ? '⚠️' : ''}</option>
            ))}
          </select>
          <button type="button" onClick={() => { const sel = document.getElementById('select-acc-wizard'); if (sel && sel.value) handleAddAccessoryToPlan(sel.value); }} className="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Incluir
          </button>
        </div>
        {calculations.slingDetails.map(item => (
          <div key={item.rowId} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded text-xs gap-2">
            <div className="flex-1 truncate font-semibold">[{item.accessory.code}] {item.accessory.description}</div>
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" value={item.qty} onChange={(e) => handleUpdateSlingRow(item.rowId, 'qty', Number(e.target.value))} className="w-12 border border-slate-300 rounded px-1 py-0.5 text-center font-mono" title="Qtd" />
              <span className="text-slate-400">x</span>
              <input type="number" value={item.angleDeg} onChange={(e) => handleUpdateSlingRow(item.rowId, 'angleDeg', Number(e.target.value))} className="w-12 border border-slate-300 rounded px-1 py-0.5 text-center font-mono" title="Ângulo" />
              <span className={`font-mono font-bold w-14 text-right ${item.isOverLimit ? 'text-red-600' : 'text-emerald-600'}`}>{item.utilizationPct.toFixed(1)}%</span>
              <button onClick={() => handleRemoveSlingRow(item.rowId)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}