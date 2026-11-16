import React, { useRef } from 'react';
import {
  Printer,
  AlertTriangle,
  Paperclip,
  CheckCircle2,
  Clock,
  History,
  Trash2,
  FileText,
  Image as ImageIcon,
  Shield,
  X,
} from 'lucide-react';

export default function Step3Emissao({
  plan,
  setPlan,
  calculations,
  selectedCrane,
  handleEmitPdf,
  savedPlans,
}) {
  const fileInputRef = useRef(null);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const compressedUrl = await compressImage(file);
        setPlan((prev) => ({
          ...prev,
          attachments: [
            ...(prev.attachments || []),
            { name: file.name, type: 'image/jpeg', url: compressedUrl },
          ],
        }));
      } else {
        alert('Por favor, envie apenas imagens (fotos).');
      }
    }
    e.target.value = null;
  };

  const removeAttachment = (index) => {
    setPlan((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const clientHistory = Array.isArray(savedPlans)
    ? savedPlans.filter(
        (p) =>
          p.clientName === plan.clientName &&
          p.assignedPlanNumber !== plan.assignedPlanNumber
      )
    : [];

  const toggleDoc = (docKey) => {
    setPlan((prev) => ({
      ...prev,
      selectedDocs: {
        planilha: true,
        memorial: true,
        desenho: true,
        art: true,
        laudo: true,
        pop: true,
        ...(prev.selectedDocs || {}),
        [docKey]: !(prev.selectedDocs?.[docKey] ?? true),
      },
    }));
  };

  const docsOptions = [
    { key: 'planilha', label: '1. Planilha de Capacidades', icon: FileText },
    { key: 'memorial', label: '2. Memorial de Cálculo', icon: FileText },
    { key: 'desenho', label: '3. Desenho Técnico', icon: ImageIcon },
    { key: 'art', label: '4. ART (CREA-PR)', icon: FileText },
    { key: 'laudo', label: '5. Laudo de Inspeção', icon: Shield },
    { key: 'pop', label: '6. Procedimento Operacional (POP)', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex items-center gap-2 text-slate-600">
        <Printer className="w-5 h-5 text-blue-600" />
        <p className="text-sm font-medium">
          Selecione os documentos, anexe fotos e emita o PDF Oficial.
        </p>
      </div>

      {/* ALERTA DE ITENS SOBRECARREGADOS */}
      {calculations &&
        calculations.overloadedItems &&
        calculations.overloadedItems.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div className="text-xs">
              <span className="font-bold">Atenção:</span> Existem itens
              sobrecarregados ou com capacidade excedida neste plano de carga.
            </div>
          </div>
        )}

      {/* PAINEL DE STATUS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Status do Plano
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">Cliente</span>
            <span className="font-semibold text-slate-800 truncate block">
              {plan.clientName || 'Não informado'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">Guindaste</span>
            <span className="font-semibold text-slate-800 truncate block">
              {selectedCrane ? `${selectedCrane.model}` : 'Não selecionado'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block mb-1">Peso Líquido</span>
            <span className="font-semibold text-slate-800 font-mono block">
              {plan.netWeightVal || '0'} {plan.netWeightUnit || 't'}
            </span>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DE DOCUMENTOS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Documentos que serão impressos
          </h3>
          <p className="text-xs text-slate-500">
            Desmarque os documentos que NÃO deseja incluir no PDF final.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          {docsOptions.map((doc) => {
            const isChecked = plan.selectedDocs?.[doc.key] ?? true;
            const IconComponent = doc.icon;
            return (
              <label
                key={doc.key}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all text-xs ${
                  isChecked
                    ? 'bg-blue-50/50 border-blue-200 text-slate-800 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent
                    className={`w-4 h-4 ${
                      isChecked ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{doc.label}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleDoc(doc.key)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* ÁREA DE ANEXOS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-600" /> Fotos e Anexos
              (Opcional)
            </h3>
            <p className="text-xs text-slate-500">
              Adicione fotos do local para o histórico.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Paperclip className="w-3.5 h-3.5" /> Adicionar Foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {!plan.attachments || plan.attachments.length === 0 ? (
          <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
            Nenhum anexo adicionado.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {plan.attachments.map((file, idx) => (
              <div
                key={idx}
                className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-50 aspect-video flex items-center justify-center"
              >
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="text-white text-[10px] truncate max-w-[70%] px-1">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                    title="Remover anexo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTÓRICO DO CLIENTE */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" /> Histórico de Planos do
          Cliente
        </h3>

        {clientHistory.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">
            Nenhum outro plano registrado para este cliente.
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {clientHistory.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">
                    Nº {h.assignedPlanNumber || '---'}
                  </span>
                  <span className="text-slate-500 truncate max-w-[200px]">
                    {h.loadDescription || h.operationName || 'Plano de Carga'}
                  </span>
                  <span className="text-slate-400">
                    ({new Date(h.date || Date.now()).toLocaleDateString('pt-BR')})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                  {h.status || 'RASCUNHO'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTÃO DE EMISSÃO DO PDF */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleEmitPdf}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
        >
          <Printer className="w-4 h-4" /> Emitir PDF Oficial do Plano de Carga
        </button>
      </div>
    </div>
  );
}