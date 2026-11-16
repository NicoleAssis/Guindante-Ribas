import { FileText, Building2 } from 'lucide-react';

export default function Step1Cliente({ plan, setPlan, clients }) {
  const handleSelectClient = (e) => {
    const clientId = e.target.value;
    const selected = (clients || []).find((c) => c.id === clientId);

    if (selected) {
      setPlan({
        ...plan,
        clientName: selected.name,
        clientCnpj: selected.cnpj,
        contractAddress: selected.address,
        serviceSite: selected.site,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-slate-600">
        <FileText className="w-5 h-5 text-slate-500" />
        <p>Selecione um cliente cadastrado ou preencha manualmente.</p>
      </div>

      {/* SELETOR DE CLIENTE RÁPIDO */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Building2 className="w-4 h-4 text-slate-500" />
          Cliente Cadastrado
        </label>
        <select
          onChange={handleSelectClient}
          defaultValue=""
          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="" disabled>
            Selecione para preencher automático...
          </option>
          {(clients || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} - {c.cnpj}
            </option>
          ))}
        </select>
      </div>

      {/* FORMULÁRIO MANUAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Razão Social / Cliente
          </label>
          <input
            type="text"
            value={plan.clientName || ''}
            onChange={(e) => setPlan({ ...plan, clientName: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="Razão Social"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            CNPJ
          </label>
          <input
            type="text"
            value={plan.clientCnpj || ''}
            onChange={(e) => setPlan({ ...plan, clientCnpj: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Data
          </label>
          <input
            type="date"
            value={plan.date || ''}
            onChange={(e) => setPlan({ ...plan, date: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Endereço do Contrato
          </label>
          <input
            type="text"
            value={plan.contractAddress || ''}
            onChange={(e) =>
              setPlan({ ...plan, contractAddress: e.target.value })
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="Endereço da sede do cliente"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Local da Prestação de Serviço
          </label>
          <input
            type="text"
            value={plan.serviceSite || ''}
            onChange={(e) => setPlan({ ...plan, serviceSite: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="Endereço completo da obra"
          />
        </div>
      </div>
    </div>
  );
}