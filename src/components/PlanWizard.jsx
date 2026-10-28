import React, { useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import Step1Cliente from './wizard/Step1Cliente';
import Step2Equipamento from './wizard/Step2Equipamento';
import Step3Emissao from './wizard/Step3Emissao';

export default function PlanWizard({ plan, setPlan, calculations, cranes, accessories, selectedCrane, interpolationResult, handlers, savedPlans }) {
  const [planStep, setPlanStep] = useState(1);
  const [emissionFeedback, setEmissionFeedback] = useState(null);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 print:hidden">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 z-0"></div>
          {[{ step: 1, label: '1. Dados do Cliente e Obra' }, { step: 2, label: '2. Carga e Equipamentos' }, { step: 3, label: '3. Resumo e Emissão' }].map((s) => (
            <div key={s.step} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
              <button onClick={() => setPlanStep(s.step)} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${planStep >= s.step ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-200 text-slate-500'}`}>{s.step}</button>
              <span className={`text-xs font-semibold ${planStep >= s.step ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {emissionFeedback && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${emissionFeedback.type === 'error' ? 'bg-red-50 border-red-300 text-red-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}`}>
          <div className="flex items-start gap-2.5">
            {emissionFeedback.type === 'error' ? <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            <div className="text-xs">
              <h4 className="font-bold text-sm">{emissionFeedback.title}</h4>
              <ul className="list-disc list-inside mt-1 space-y-0.5">{emissionFeedback.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          </div>
          <button onClick={() => setEmissionFeedback(null)} className="text-xs font-bold underline opacity-75 hover:opacity-100">Fechar</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:p-6 print:hidden">
        {planStep === 1 && <Step1Cliente plan={plan} setPlan={setPlan} />}
        
        {planStep === 2 && (
          <Step2Equipamento 
            plan={plan} 
            setPlan={setPlan} 
            cranes={cranes} 
            accessories={accessories} 
            calculations={calculations} 
            interpolationResult={interpolationResult} 
            handleAddAccessoryToPlan={handlers.handleAddAccessoryToPlan} 
            handleRemoveSlingRow={handlers.handleRemoveSlingRow} 
            handleUpdateSlingRow={handlers.handleUpdateSlingRow} 
          />
        )}
        
        {planStep === 3 && (
          <Step3Emissao 
            plan={plan} 
            setPlan={setPlan} 
            calculations={calculations} 
            selectedCrane={selectedCrane} 
            handleEmitPdf={handlers.handleEmitPdf} 
            savedPlans={savedPlans} 
          />
        )}

        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center">
          <button onClick={handlers.handleStartNewPlan} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Iniciar Novo
          </button>
          <div className="flex gap-2">
            {planStep > 1 && <button onClick={() => setPlanStep(planStep - 1)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-bold px-5 py-2 rounded-lg transition">Voltar</button>}
            {planStep < 3 && (
              <button onClick={() => {
                  if (planStep === 1 && (!plan.clientName || !plan.serviceSite)) {
                     setEmissionFeedback({ type: 'error', title: 'Atenção', messages: ['Preencha o nome do cliente e o local do serviço para avançar.'] });
                     return;
                  }
                  setEmissionFeedback(null);
                  setPlanStep(planStep + 1);
                }} className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold px-6 py-2 rounded-lg shadow transition">
                Próxima Etapa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}