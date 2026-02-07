import React from 'react';
import { TemplateField } from '../types';

type SourceField = { id: string; table: string; column: string; dataType: string };

type Props = {
  templateText: string;
  templateFields: TemplateField[];
  sourceFields: SourceField[];
  mappingSelections: Record<string, string | null>;
  suggestionMap: Record<string, { sourceId: string | null; confidence: number; rationale: string }>;
  onTemplateChange: (value: string) => void;
  onMappingChange: (fieldId: string, sourceId: string | null) => void;
  onExport: () => void;
  onLoadSample: () => void;
};

const Templates: React.FC<Props> = ({
  templateText,
  templateFields,
  sourceFields,
  mappingSelections,
  suggestionMap,
  onTemplateChange,
  onMappingChange,
  onExport,
  onLoadSample
}) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
        <p className="text-slate-500">Define stakeholder fields and map them to your schema.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button onClick={onLoadSample} className="bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700">
            Load sample template
          </button>
          <button
            onClick={onExport}
            className="bg-slate-900 text-white rounded-lg py-2 hover:bg-slate-800"
            disabled={!templateFields.length}
          >
            Export Mapping JSON
          </button>
        </div>
        <textarea
          className="w-full h-40 border border-slate-200 rounded-lg p-3 text-sm"
          placeholder="One field per line. Optional: name | description"
          value={templateText}
          onChange={(e) => onTemplateChange(e.target.value)}
        />
      </div>

      {templateFields.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templateFields.map((field) => (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" key={field.id}>
              <h3 className="font-semibold text-slate-900">{field.name}</h3>
              {field.description && <p className="text-sm text-slate-500">{field.description}</p>}
              <label className="text-xs text-slate-400 uppercase tracking-wide">Mapped source</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-2"
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
              <p className="text-xs text-slate-400 mt-2">
                Suggested: {suggestionMap[field.id]?.sourceId ?? '—'} • Confidence {suggestionMap[field.id]?.confidence ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Templates;
