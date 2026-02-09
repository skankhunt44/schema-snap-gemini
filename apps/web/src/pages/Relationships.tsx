import React from 'react';
import TemplateDiagram from '../components/TemplateDiagram';
import { explainSchema } from '../lib/api';
import { MappingEntry, SchemaSnapshot, Template } from '../types';

type SourceField = {
  id: string;
  table: string;
  column: string;
  dataType: string;
};

type Props = {
  snapshot: SchemaSnapshot | null;
  template: Template | null;
  mappings: Record<string, MappingEntry>;
  sourceFields: SourceField[];
  onExportJson: () => void;
  onExportSql: () => void;
};

const Relationships: React.FC<Props> = ({ snapshot, template, mappings, sourceFields, onExportJson, onExportSql }) => {
  const [explainLoading, setExplainLoading] = React.useState(false);
  const [explainError, setExplainError] = React.useState<string | null>(null);
  const [explainData, setExplainData] = React.useState<
    { summary: string; joinPaths: Array<{ title: string; path: string[]; rationale: string }> } | null
  >(null);

  const handleExplain = async () => {
    if (!snapshot) return;
    setExplainLoading(true);
    setExplainError(null);
    try {
      const result = await explainSchema();
      setExplainData(result);
    } catch (err: any) {
      setExplainError(err.message || 'Failed to explain schema');
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Mappings</h1>
        <p className="text-slate-500">Visualize data → template mappings (autoreport style).</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">AI Schema Explainer</h3>
            <p className="text-sm text-slate-500">Explain this schema and suggest join paths.</p>
          </div>
          <button
            onClick={handleExplain}
            disabled={!snapshot || explainLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {explainLoading ? 'Thinking…' : 'Explain with Gemini'}
          </button>
        </div>
        {explainError && <p className="text-sm text-rose-500 mb-3">{explainError}</p>}
        {explainData && (
          <div className="space-y-4">
            <div className="text-sm text-slate-700">{explainData.summary}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {explainData.joinPaths.map((path, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-semibold text-slate-800 mb-1">{path.title}</div>
                  <div className="text-xs text-slate-500 mb-2">{path.path.join(' → ')}</div>
                  <div className="text-xs text-slate-500">{path.rationale}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!explainData && !explainLoading && !explainError && (
          <p className="text-xs text-slate-400">Generate an explanation to see Gemini’s suggested join paths.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3">
            <button onClick={onExportJson} className="bg-slate-900 text-white rounded-lg py-2 px-4 hover:bg-slate-800">
              Export JSON Snapshot
            </button>
            <button onClick={onExportSql} className="bg-indigo-600 text-white rounded-lg py-2 px-4 hover:bg-indigo-700">
              Export SQL Join Plan
            </button>
          </div>
        </div>
        {snapshot ? (
          <TemplateDiagram template={template} mappings={mappings} sourceFields={sourceFields} />
        ) : (
          <p className="text-sm text-slate-500">Upload data sources to view mappings.</p>
        )}
      </div>
    </div>
  );
};

export default Relationships;
