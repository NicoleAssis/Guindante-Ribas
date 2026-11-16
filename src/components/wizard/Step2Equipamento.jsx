import { Package, Plus, Trash2 } from 'lucide-react';

export default function Step2Equipamento({
  plan,
  setPlan,
  cranes,
  accessories,
  calculations,
  interpolationResult,
  handleAddAccessoryToPlan,
  handleRemoveSlingRow,
  handleUpdateSlingRow,
}) {
  return (
    <div className="space-y-6">
      {/* 1. ESPECIFICAÇÕES DA CARGA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          1. Especificações da Carga
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descrição da Carga
            </label>
            <input
              type="text"
              value={plan.loadDescription || ''}
              onChange={(e) => setPlan({ ...plan, loadDescription: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm"
              placeholder="Ex: Transformador 30t"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Peso Líquido
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={plan.netWeightVal || ''}
                onChange={(e) => setPlan({ ...plan, netWeightVal: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-sm"
                placeholder="0.00"
              />
              <select
                value={plan.netWeightUnit || 't'}
                onChange={(e) => setPlan({ ...plan, netWeightUnit: e.target.value })}
                className="bg-slate-100 border border-slate-300 rounded-lg px-3 font-bold text-sm"
              >
                <option value="kg">kg</option>
                <option value="t">t</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dimensões da Carga */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Comprimento (m)</label>
            <input
              type="number"
              value={plan.lengthVal || ''}
              onChange={(e) => setPlan({ ...plan, lengthVal: e.target.value })}
              className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Largura (m)</label>
            <input
              type="number"
              value={plan.widthVal || ''}
              onChange={(e) => setPlan({ ...plan, widthVal: e.target.value })}
              className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Altura (m)</label>
            <input
              type="number"
              value={plan.heightVal || ''}
              onChange={(e) => setPlan({ ...plan, heightVal: e.target.value })}
              className="w-full border border-slate-300 rounded px-1.5 py-1 font-mono text-sm"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* 2. GUINDASTE E PATOLAMENTO */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          🏗️ 2. Guindaste e Patolamento
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Modelo do Guindaste</label>
            <select
              value={plan.selectedCraneId || ''}
              onChange={(e) => {
                const cr = (cranes || []).find((c) => c.id === e.target.value);
                setPlan({
                  ...plan,
                  selectedCraneId: e.target.value,
                  columnDistA: cr ? cr.defaultColumnDistA : plan.columnDistA,
                  outriggerSpanB: cr ? cr.defaultOutriggerSpanB : plan.outriggerSpanB,
                });
              }}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-sm bg-white"
            >
              <option value="">Selecione o guindaste...</option>
              {(cranes || []).map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.code}] {c.model} - Cap: {c.nominalCapacityTons}t
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Raio de Operação (m)</label>
            <input
              type="number"
              value={plan.operatingRadiusM || ''}
              onChange={(e) => setPlan({ ...plan, operatingRadiusM: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-sm"
              placeholder="0.0"
            />
          </div>
        </div>

        {/* Configurações Geométricas e Patolas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dist. Coluna A</label>
            <input
              type="number"
              value={plan.columnDistA || ''}
              onChange={(e) => setPlan({ ...plan, columnDistA: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Patola B</label>
            <input
              type="number"
              value={plan.outriggerSpanB || ''}
              onChange={(e) => setPlan({ ...plan, outriggerSpanB: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Comp. Calço (cm)</label>
            <input
              type="number"
              value={plan.sleeperLengthCm || ''}
              onChange={(e) => setPlan({ ...plan, sleeperLengthCm: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Larg. Calço (cm)</label>
            <input
              type="number"
              value={plan.sleeperWidthCm || ''}
              onChange={(e) => setPlan({ ...plan, sleeperWidthCm: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Qtd. Calços</label>
            <input
              type="number"
              value={plan.sleeperCount || ''}
              onChange={(e) => setPlan({ ...plan, sleeperCount: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-sm"
            />
          </div>
        </div>

        {/* Status da Interpolação */}
        {interpolationResult && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
            <span className="font-semibold">Status:</span> {interpolationResult.status} {interpolationResult.message}
          </div>
        )}
      </div>

      {/* 3. ACESSÓRIOS E BALANCIM */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          ⛓️ 3. Acessórios e Balancim
        </h3>

        {/* Seletor para adicionar acessórios */}
        <div className="flex gap-2 items-center">
          <select
            id="select-accessory"
            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
          >
            <option value="">Selecione um acessório...</option>
            {(accessories || [])
              .filter((a) => a.wearStatus !== 'DESCARTADO')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.code}] {a.description} | Peso: {a.unitWeightKg}kg{' '}
                  {a.wearStatus === 'ALERTA_DESGASTE' ? '⚠️' : ''}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const selectEl = document.getElementById('select-accessory');
              if (selectEl && selectEl.value) {
                handleAddAccessoryToPlan(selectEl.value);
                selectEl.value = '';
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
            title="Adicionar Acessório"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Lingas / Acessórios Adicionados */}
        <div className="space-y-2">
          {(calculations.slingDetails || []).map((item) => (
            <div
              key={item.rowId}
              className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <span className="font-mono text-slate-500">[{item.accessory.code}]</span>
                <span>{item.accessory.description}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={item.qty || 1}
                    onChange={(e) => handleUpdateSlingRow(item.rowId, 'qty', Number(e.target.value))}
                    className="w-12 border border-slate-300 rounded px-1 py-0.5 text-center font-mono text-xs"
                    title="Qtd. Ramais"
                  />
                  <span>x</span>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={item.angleDeg || 0}
                    onChange={(e) => handleUpdateSlingRow(item.rowId, 'angleDeg', Number(e.target.value))}
                    className="w-12 border border-slate-300 rounded px-1 py-0.5 text-center font-mono text-xs"
                    title="Ângulo (°)"
                  />
                  <span className="text-slate-500">°</span>
                </div>

                <span className="font-mono font-semibold text-slate-600 min-w-[45px] text-right">
                  {item.utilizationPct ? item.utilizationPct.toFixed(1) : '0.0'}%
                </span>

                <button
                  type="button"
                  onClick={() => handleRemoveSlingRow(item.rowId)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Configuração de Balancim (Se aplicável) */}
        {plan.useBalancim && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium">Qtd. Balancim:</span>
              <input
                type="number"
                value={plan.balancimQty || 1}
                onChange={(e) => setPlan({ ...plan, balancimQty: Number(e.target.value) })}
                className="w-16 border border-slate-300 rounded px-2 py-1 font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium">Peso Unit.:</span>
              <input
                type="number"
                value={plan.balancimUnitWeightVal || ''}
                onChange={(e) => setPlan({ ...plan, balancimUnitWeightVal: e.target.value })}
                className="w-20 border border-slate-300 rounded px-2 py-1 font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={plan.balancimWeightUnit || 'kg'}
                onChange={(e) => setPlan({ ...plan, balancimWeightUnit: e.target.value })}
                className="border border-slate-300 rounded px-1.5 py-1 bg-white font-bold text-xs"
              >
                <option value="kg">kg</option>
                <option value="t">t</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}