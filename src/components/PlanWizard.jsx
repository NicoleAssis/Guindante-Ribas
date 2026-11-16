import React, { useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Save, AlertCircle } from 'lucide-react';
import Step1Cliente from './wizard/Step1Cliente';
import Step2Equipamento from './wizard/Step2Equipamento';
import Step3Emissao from './wizard/Step3Emissao';

export default function PlanWizard({
  plan,
  setPlan,
  calculations,
  cranes,
  accessories,
  clients,
  selectedCrane,
  interpolationResult,
  handlers,
  savedPlans,
}) {
  const [planStep, setPlanStep] = useState(1);
  const [emissionFeedback, setEmissionFeedback] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const steps = [
    { step: 1, label: '1. Dados do Cliente e Obra' },
    { step: 2, label: '2. Carga e Equipamentos' },
    { step: 3, label: '3. Resumo e Emissão' },
  ];

  // Validação dos campos obrigatórios por etapa
  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!plan.clientName || !plan.clientName.trim()) {
        return 'Preencha ou selecione a Razão Social / Cliente antes de avançar.';
      }
      if (!plan.clientCnpj || !plan.clientCnpj.trim()) {
        return 'O campo CNPJ é obrigatório.';
      }
    } else if (currentStep === 2) {
      if (!plan.loadDescription || !plan.loadDescription.trim()) {
        return 'Informe a descrição da carga.';
      }
      if (!plan.netWeightVal || Number(plan.netWeightVal) <= 0) {
        return 'Informe um peso líquido válido para a carga.';
      }
      if (!plan.selectedCraneId) {
        return 'Selecione um modelo de guindaste.';
      }
      if (!plan.operatingRadiusM || Number(plan.operatingRadiusM) <= 0) {
        return 'Informe o raio de operação (m).';
      }
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(planStep);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setPlanStep((prev) => Math.min(prev + 1, 3));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-200 space-y-6">
      {/* STEPS HEADER INDICATOR */}
      <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-4">
        {steps.map((s) => {
          const isActive = planStep === s.step;
          const isCompleted = planStep > s.step;
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => {
                // Se for voltar ou se a etapa atual estiver válida, permite a navegação direta
                if (s.step < planStep || !validateStep(planStep)) {
                  setValidationError(null);
                  setPlanStep(s.step);
                } else {
                  const error = validateStep(planStep);
                  setValidationError(error);
                }
              }}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-blue-50 border border-blue-200 text-blue-700 font-semibold'
                  : isCompleted
                  ? 'bg-slate-50 text-slate-700 font-medium'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.step}
              </div>
              <span className="text-xs truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* VALIDATION ERROR ALERT */}
      {validationError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="font-bold text-amber-600 hover:text-amber-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* EMISSION FEEDBACK ALERT (IF ANY) */}
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
            <span>{emissionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setEmissionFeedback(null)}
            className="font-bold text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* STEP CONTENT BODY */}
      <div className="py-2">
        {planStep === 1 && (
          <Step1Cliente plan={plan} setPlan={setPlan} clients={clients} />
        )}
        {planStep === 2 && (
          <Step2Equipamento
            plan={plan}
            setPlan={setPlan}
            cranes={cranes}
            accessories={accessories}
            calculations={calculations}
            interpolationResult={interpolationResult}
            handleAddAccessoryToPlan={handlers?.handleAddAccessoryToPlan}
            handleRemoveSlingRow={handlers?.handleRemoveSlingRow}
            handleUpdateSlingRow={handlers?.handleUpdateSlingRow}
          />
        )}
        {planStep === 3 && (
          <Step3Emissao
            plan={plan}
            setPlan={setPlan}
            calculations={calculations}
            selectedCrane={selectedCrane}
            handleEmitPdf={handlers?.handleEmitPdf}
            savedPlans={savedPlans}
          />
        )}
      </div>

      {/* FOOTER NAVIGATION CONTROLS */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          disabled={planStep === 1}
          onClick={() => {
            setValidationError(null);
            setPlanStep((prev) => Math.max(prev - 1, 1));
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            planStep === 1
              ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          Voltar
        </button>

        <div className="flex items-center gap-2">
          {handlers?.handleSaveDraft && (
            <button
              type="button"
              onClick={handlers.handleSaveDraft}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Salvar Rascunho
            </button>
          )}

          {planStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              Avançar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}