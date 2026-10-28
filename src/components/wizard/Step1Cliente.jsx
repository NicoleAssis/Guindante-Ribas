import { FileText } from 'lucide-react';

export default function Step1Cliente({ plan, setPlan }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" /> Dados do Cliente e Contrato
        </h2>
        <p className="text-xs text-slate-500 mt-1">Preencha as informações de faturamento e local do serviço.</p>
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
          <label className="font-semibold text-slate-700 block mb-1">Local da Obra / Site *</label>
          <input type="text" value={plan.serviceSite} onChange={(e) => setPlan({ ...plan, serviceSite: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Endereço completo da obra" />
        </div>
      </div>
    </div>
  );
}