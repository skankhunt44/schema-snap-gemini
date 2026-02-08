import React from 'react';
import { Wand2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Template, TemplateField } from '../types';

type SourceField = { id: string; table: string; column: string; dataType: string };

type Props = {
  templates: Template[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
  templateFields: TemplateField[];
  sourceFields: SourceField[];
  mappingSelections: Record<string, string | null>;
  suggestionMap: Record<string, { sourceId: string | null; confidence: number; rationale: string }>;
  aiLoading: boolean;
  aiError: string | null;
  onMappingChange: (fieldId: string, sourceId: string | null) => void;
  onApplySuggestions: () => void;
};

const SmartMapper: React.FC<Props> = ({
  templates,
  activeTemplateId,
  onSelectTemplate,
  templateFields,
  sourceFields,
  mappingSelections,
  suggestionMap,
  aiLoading,
  aiError,
  onMappingChange,
  onApplySuggestions
}) => {
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wand2 className="text-indigo-600" /> Smart Mapper
          </h1>
          <p className="text-slate-500">Map stakeholder fields to your schema with AI suggestions.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={activeTemplateId ?? ''}
            onChange={(e) => onSelectTemplate(e.target.value || null)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
          >
            <option value="">Select template</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={onApplySuggestions}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-60"
            disabled={!templateFields.length || aiLoading}
          >
            <RefreshCw size={18} className={aiLoading ? 'animate-spin' : ''} />
            {aiLoading ? 'AI Thinking…' : 'Auto-Map with Gemini'}
          </button>
        </div>
      </div>

      {aiError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 mb-4 text-sm">
          {aiError}
        </div>
      )}

      {templateFields.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-slate-500">
          Create a template first to enable mapping.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <div className="col-span-2">Template Field</div>
            <div className="col-span-2">Mapped Source</div>
            <div>Confidence</div>
          </div>

          <div className="divide-y divide-slate-200">
            {templateFields.map((field) => {
              const suggestion = suggestionMap[field.id];
              return (
                <div key={field.id} className="grid grid-cols-5 gap-4 px-6 py-4">
                  <div className="col-span-2">
                    <p className="font-medium text-slate-900">{field.name}</p>
                    {field.description && <p className="text-xs text-slate-500">{field.description}</p>}
                  </div>
                  <div className="col-span-2">
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                      value={mappingSelections[field.id] ?? ''}
                      onChange={(e) => onMappingChange(field.id, e.target.value || null)}
                    >
                      <option value="">— Not mapped —</option>
                      {sourceFields.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.table}.{source.column} ({source.dataType})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Suggested: {suggestion?.sourceId ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="text-emerald-500" size={16} />
                    {suggestion?.confidence ?? 0}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartMapper;
