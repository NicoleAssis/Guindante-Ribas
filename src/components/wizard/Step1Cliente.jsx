import { FileText, Building2 } from 'lucide-react';

export default function Step1Cliente({ plan, setPlan, clients }) {
  
  const handleSelectClient = (e) => {
    const clientId = e.target.value;
    const selected = clients.find(c => c.id === clientId);
    if (selected) {
      setPlan({
        ...plan,
        clientName: selected.name,
        clientCnpj: selected.cnpj,
        contractAddress: selected.address,
        serviceSite: selected.site
      });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-slate-100 pb-3 flex justify-between items-end">
        <div>
          <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" /> Dados do Cliente e Contrato
          </h2>
          <p className="text-xs text-slate-500 mt-1">Selecione um cliente cadastrado ou preencha manualmente.</p>
        </div>
      </div>

      {/* SELETOR DE CLIENTE RÁPIDO */}
      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
        <label className="font-semibold text-amber-900 block mb-1 text-sm flex items-center gap-1">
          <Building2 className="w-4 h-4" /> Buscar Cliente Cadastrado:
        </label>
        <select onChange={handleSelectClient} defaultValue="" className="w-full border border-amber-300 rounded-lg px-3 py-2 bg-white font-semibold text-slate-800">
          <option value="" disabled>Selecione para preencher automático...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name} - {c.cnpj}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="md:col-span-2">
          <label className="font-semibold text-slate-700 block mb-1">Cliente Contratante *</label>
          <input type="text" value={plan.clientName} onChange={(e) => setPlan({ ...plan, clientName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Razão Social" />
        </div>
        <div>
          <label className="font-semibold text-slate-700 block mb-1">CNPJ do Contratante</label>
          <input type="text" value={plan.clientCnpj} onChange={(e) => setPlan({ ...plan, clientCnpj: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono" placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Data do Serviço</label>
          <input type="date" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
        </div>
        <div className="md:col-span-2">
          <label className="font-semibold text-slate-700 block mb-1">Endereço do Contrato</label>
          <input type="text" value={plan.contractAddress} onChange={(e) => setPlan({ ...plan, contractAddress: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Endereço da sede do cliente" />
        </div>
        <div className="md:col-span-2">
          <label className="font-semibold text-slate-700 block mb-1">Local da Obra / Site *</label>
          <input type="text" value={plan.serviceSite} onChange={(e) => setPlan({ ...plan, serviceSite: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Endereço completo da obra" />
        </div>
      </div>
    </div>
  );
}