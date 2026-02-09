import React from 'react';
import { Wand2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { DataSource, SourceField, Template, TemplateField } from '../types';

type Props = {
  templates: Template[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
  templateFields: TemplateField[];
  dataSources: DataSource[];
  sourceFields: SourceField[];
  mappingSelections: Record<string, string | null>;
  mappingOperations: Record<string, string>;
  suggestionMap: Record<string, { sourceId: string | null; confidence: number; rationale: string }>;
  aiLoading: boolean;
  aiError: string | null;
  aiSummary: string | null;
  onMappingChange: (fieldId: string, sourceId: string | null) => void;
  onOperationChange: (fieldId: string, operation: string) => void;
  onApplySuggestions: (sources: SourceField[]) => void;
};

const SmartMapper: React.FC<Props> = ({
  templates,
  activeTemplateId,
  onSelectTemplate,
  templateFields,
  dataSources,
  sourceFields,
  mappingSelections,
  mappingOperations,
  suggestionMap,
  aiLoading,
  aiError,
  aiSummary,
  onMappingChange,
  onOperationChange,
  onApplySuggestions
}) => {
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!dataSources.length) {
      setSelectedSourceIds([]);
      return;
    }

    setSelectedSourceIds(prev => {
      if (prev.length === 0) return dataSources.map(ds => ds.id);
      const allIds = dataSources.map(ds => ds.id);
      const kept = prev.filter(id => allIds.includes(id));
      const missing = allIds.filter(id => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [dataSources]);

  const filteredSources = sourceFields.filter(field => {
    if (!dataSources.length) return true;
    if (!field.sourceId) return false;
    return selectedSourceIds.includes(field.sourceId);
  });

  const confidenceColor = (value?: number) => {
    if (value === undefined) return 'text-slate-400';
    if (value >= 0.8) return 'text-emerald-600';
    if (value >= 0.6) return 'text-amber-600';
    return 'text-rose-600';
  };

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
            onClick={() => onApplySuggestions(filteredSources)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-60"
            disabled={!templateFields.length || !filteredSources.length || aiLoading}
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

      {aiSummary && !aiLoading && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg px-4 py-2 mb-4 text-sm">
          <span className="font-semibold">Gemini summary:</span> {aiSummary}
        </div>
      )}

      {dataSources.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Filter sources</div>
          <div className="flex flex-wrap gap-2">
            {dataSources.map(source => (
              <label key={source.id} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
                <input
                  type="checkbox"
                  checked={selectedSourceIds.includes(source.id)}
                  onChange={(e) => {
                    setSelectedSourceIds(prev =>
                      e.target.checked ? [...prev, source.id] : prev.filter(id => id !== source.id)
                    );
                  }}
                />
                {source.name}
              </label>
            ))}
          </div>
          {!filteredSources.length && (
            <p className="text-xs text-rose-500 mt-2">Select at least one source to enable Auto-Map.</p>
          )}
        </div>
      )}

      {templateFields.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-slate-500">
          Create a template first to enable mapping.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 gap-4 px-6 py-3 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <div className="col-span-2">Template Field</div>
            <div className="col-span-2">Mapped Source</div>
            <div>Operation</div>
            <div>Confidence</div>
            <div>Rationale</div>
          </div>

          <div className="divide-y divide-slate-200">
            {templateFields.map((field) => {
              const suggestion = suggestionMap[field.id];
              return (
                <div key={field.id} className="grid grid-cols-1 lg:grid-cols-7 gap-4 px-6 py-4">
                  <div className="lg:col-span-2">
                    <p className="font-medium text-slate-900">{field.name}</p>
                    {field.description && <p className="text-xs text-slate-500">{field.description}</p>}
                  </div>
                  <div className="lg:col-span-2">
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                      value={mappingSelections[field.id] ?? ''}
                      onChange={(e) => onMappingChange(field.id, e.target.value || null)}
                    >
                      <option value="">— Not mapped —</option>
                      {filteredSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.sourceName ? `${source.sourceName}: ` : ''}{source.table}.{source.column} ({source.dataType})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Suggested: {suggestion?.sourceId ?? '—'}</p>
                  </div>
                  <div className="lg:col-span-1">
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm"
                      value={mappingOperations[field.id] || 'DIRECT'}
                      onChange={(e) => onOperationChange(field.id, e.target.value)}
                    >
                      {['DIRECT', 'COUNT', 'COUNT_DISTINCT', 'SUM', 'AVERAGE', 'FIRST', 'LAST'].map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`lg:col-span-1 flex items-center gap-2 text-sm ${confidenceColor(suggestion?.confidence)}`}>
                    <CheckCircle2 className="text-emerald-500" size={16} />
                    {suggestion?.confidence ?? 0}
                  </div>
                  <div className="lg:col-span-1 text-xs text-slate-500">
                    {suggestion?.rationale ? (
                      <span>{suggestion.rationale}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
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
