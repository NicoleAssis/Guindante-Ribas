import React, { useRef } from 'react';
import { 
  Printer, AlertTriangle, Paperclip, CheckCircle2, Clock, History, 
  Trash2, FileText, Image as ImageIcon, Shield, XCircle, Check, X, ClipboardCheck 
} from 'lucide-react';

export default function Step3Emissao({ plan, setPlan, calculations, selectedCrane, handleEmitPdf, savedPlans }) {
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
          attachments: [...(prev.attachments || []), { name: file.name, type: 'image/jpeg', url: compressedUrl }] 
        }));
      } else {
        alert('Por favor, envie apenas imagens (fotos).');
      }
    }
    e.target.value = null;
  };

  const removeAttachment = (index) => {
    setPlan((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== index) }));
  };

  const clientHistory = Array.isArray(savedPlans) 
    ? savedPlans.filter((p) => p.clientName === plan.clientName && p.assignedPlanNumber !== plan.assignedPlanNumber) 
    : [];

  const toggleDoc = (docKey) => {
    setPlan((prev) => ({
      ...prev,
      selectedDocs: {
        planilha: true, memorial: true, desenho: true, art: true, laudo: true, pop: true,
        ...(prev.selectedDocs || {}),
        [docKey]: !(prev.selectedDocs?.[docKey] ?? true)
      }
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

  // CHECKLIST DE INSPEÇÃO TÉCNICA (OK / NOK)
  const defaultInspectionItems = [
    { key: 'freios', category: 'Sistema de Freios', label: 'Freios de serviço e freio de estacionamento', status: 'OK', obs: '' },
    { key: 'rodagem', category: 'Segurança e Rodagem', label: 'Alerta sonoro, luzes, retrovisores, limpadores e extintor', status: 'OK', obs: '' },
    { key: 'transmissao', category: 'Sistema de Transmissão', label: 'Motor, nível de óleo, ruídos anormais e câmbio', status: 'OK', obs: '' },
    { key: 'direcao', category: 'Sistema de Direção', label: 'Direção hidráulica, eixos, pneus e alinhamento', status: 'OK', obs: '' },
    { key: 'icamento', category: 'Sistema de Içamento', label: 'Lança, JIB, Sapatas, alavancas e óleo hidráulico', status: 'OK', obs: '' },
  ];

  const inspectionItems = plan.inspectionItems || defaultInspectionItems;

  const handleInspectionStatus = (key, status) => {
    const updated = inspectionItems.map((item) => {
      if (item.key === key) {
        return { ...item, status, obs: status === 'OK' ? '' : item.obs };
      }
      return item;
    });
    setPlan((prev) => ({ ...prev, inspectionItems: updated }));
  };

  const handleInspectionObs = (key, obs) => {
    const updated = inspectionItems.map((item) => {
      if (item.key === key) {
        return { ...item, obs };
      }
      return item;
    });
    setPlan((prev) => ({ ...prev, inspectionItems: updated }));
  };

  const hasNOK = inspectionItems.some((item) => item.status === 'NOK');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
        <div>
          <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-600" /> Revisão e Emissão
          </h2>
          <p className="text-xs text-slate-500">Selecione os documentos, inspecione o guindaste, anexe fotos e emita o PDF Oficial.</p>
        </div>
        <button onClick={handleEmitPdf} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <Printer className="w-4 h-4" /> Emitir PDF Oficial
        </button>
      </div>

      {calculations?.overloadedItems?.length > 0 && (
        <div className="bg-red-600 text-white p-3 rounded-lg text-xs flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <strong className="block mb-1">Atenção: Taxa de utilização acima de 85%!</strong>
            <ul className="list-disc list-inside">
              {calculations.overloadedItems.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* PAINEL DE STATUS DO PLANO */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-800 mb-3">Status do Plano</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPlan({ ...plan, status: 'RASCUNHO' })} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition ${plan.status === 'RASCUNHO' ? 'bg-slate-200 border-slate-400 text-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
            <Clock className="w-4 h-4" /> Rascunho
          </button>
          <button onClick={() => setPlan({ ...plan, status: 'EM_VALIDACAO' })} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition ${plan.status === 'EM_VALIDACAO' ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
            <AlertTriangle className="w-4 h-4" /> Em Validação
          </button>
          <button onClick={() => setPlan({ ...plan, status: 'APROVADO' })} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition ${plan.status === 'APROVADO' ? 'bg-emerald-100 border-emerald-400 text-emerald-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
            <CheckCircle2 className="w-4 h-4" /> Aprovado
          </button>
        </div>
      </div>

      {/* PAINEL INTERATIVO DE INSPEÇÃO TÉCNICA (OK / NOK) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-600" /> Laudo de Inspeção Técnica do Guindaste
            </h3>
            <p className="text-xs text-slate-500">Marque o estado operacional de cada sistema (OK = Conforme | NOK = Não Conforme).</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${hasNOK ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
            {hasNOK ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {hasNOK ? 'EQUIPAMENTO COM BLOQUEIO (NOK)' : 'GUINDASTE LIBERADO'}
          </span>
        </div>

        {hasNOK && (
          <div className="bg-red-50 border border-red-300 text-red-900 p-3 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Existem itens com não conformidade <strong>(NOK)</strong>. Descreva o motivo da pendência abaixo para o laudo técnico.</span>
          </div>
        )}

        <div className="space-y-2.5">
          {inspectionItems.map((item) => (
            <div key={item.key} className={`p-3 rounded-lg border bg-white transition ${item.status === 'NOK' ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">{item.category}</span>
                  <h4 className="text-xs font-semibold text-slate-800">{item.label}</h4>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleInspectionStatus(item.key, 'OK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
                      item.status === 'OK'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" /> OK
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInspectionStatus(item.key, 'NOK')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
                      item.status === 'NOK'
                        ? 'bg-red-600 text-white border-red-700 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" /> NOK
                  </button>
                </div>
              </div>

              {item.status === 'NOK' && (
                <div className="mt-2.5 pt-2 border-t border-red-200">
                  <label className="text-[11px] font-semibold text-red-800 block mb-1">Motivo da Não Conformidade / Observação:</label>
                  <input
                    type="text"
                    value={item.obs || ''}
                    onChange={(e) => handleInspectionObs(item.key, e.target.value)}
                    placeholder="Ex: Vazamento identificado na mangueira hidráulica do braço 2..."
                    className="w-full text-xs border border-red-300 rounded px-2.5 py-1.5 bg-white text-red-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SELEÇÃO DE DOCUMENTOS PARA EMISSÃO */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-800 mb-1">Documentos que serão impressos</h3>
        <p className="text-xs text-slate-500 mb-3">Desmarque os documentos que NÃO deseja incluir no PDF final.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {docsOptions.map((doc) => {
            const isChecked = plan.selectedDocs?.[doc.key] ?? true;
            return (
              <label key={doc.key} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition ${isChecked ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                <input 
                  type="checkbox" 
                  checked={isChecked} 
                  onChange={() => toggleDoc(doc.key)} 
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <doc.icon className={`w-4 h-4 ${isChecked ? 'text-amber-700' : 'text-slate-400'}`} />
                <span className={`text-xs font-semibold ${isChecked ? 'text-amber-900' : 'text-slate-600'}`}>{doc.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ÁREA DE ANEXOS */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Fotos e Anexos (Opcional)</h3>
            <p className="text-xs text-slate-500">Adicione fotos do local para o histórico.</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm">
            <Paperclip className="w-3.5 h-3.5" /> Anexar Imagem
          </button>
          <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
        </div>

        {(!plan.attachments || plan.attachments.length === 0) ? (
          <div className="text-center py-4 border-2 border-dashed border-slate-300 rounded-lg bg-white text-slate-400 text-xs">
            Nenhum anexo adicionado.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {plan.attachments.map((file, idx) => (
              <div key={idx} className="relative group bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                <img src={file.url} alt={file.name} className="w-full h-24 object-cover" />
                <div className="p-2 text-[10px] truncate" title={file.name}>{file.name}</div>
                <button onClick={() => removeAttachment(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTÓRICO DO CLIENTE */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-slate-500" /> Histórico deste Cliente
        </h3>
        {clientHistory.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nenhum outro plano registrado para este cliente.</p>
        ) : (
          <div className="space-y-2">
            {clientHistory.map((h) => (
              <div key={h.assignedPlanNumber} className="bg-white border border-slate-200 p-2.5 rounded flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-900">Nº {h.assignedPlanNumber}</span> - {h.operationName} ({new Date(h.date).toLocaleDateString('pt-BR')})
                </div>
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${h.status === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : h.status === 'EM_VALIDACAO' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                  {h.status || 'RASCUNHO'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
