import React from 'react';
import { Template } from '../types';

type TemplateCoverage = {
  id: string;
  name: string;
  mapped: number;
  total: number;
  percent: number;
};

type Props = {
  templates: Template[];
  templateCoverage: TemplateCoverage[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
  onDownloadSnapshot: () => void;
  onDownloadTemplates: () => void;
  onDownloadMappings: () => void;
  onDownloadJoinPlan: () => void;
};

const DataProducts: React.FC<Props> = ({
  templates,
  templateCoverage,
  activeTemplateId,
  onSelectTemplate,
  onDownloadSnapshot,
  onDownloadTemplates,
  onDownloadMappings,
  onDownloadJoinPlan
}) => {
  const mappedTemplates = templateCoverage.filter(template => template.mapped > 0);
  const selectedTemplateId =
    (activeTemplateId && mappedTemplates.some(template => template.id === activeTemplateId)
      ? activeTemplateId
      : mappedTemplates[0]?.id) || null;
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;
  const [copied, setCopied] = React.useState(false);

  const apiUrl = selectedTemplateId
    ? `${window.location.origin}/api/output?format=json&templateId=${encodeURIComponent(selectedTemplateId)}`
    : `${window.location.origin}/api/output?format=json`;
  const excelUrl = selectedTemplateId
    ? `/api/output?format=xlsx&templateId=${encodeURIComponent(selectedTemplateId)}`
    : '/api/output?format=xlsx';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data Products</h1>
        <p className="text-slate-500">Download clean data outputs or access them via API.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Combined Data Output</h3>
          <p className="text-sm text-slate-500">Export the combined dataset for mapped templates.</p>
        </div>
        <div className="p-6 space-y-4">
          {mappedTemplates.length === 0 ? (
            <div className="text-sm text-slate-400">Map at least one field in a template to enable exports.</div>
          ) : (
            <>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-500">Template</label>
                <select
                  value={selectedTemplateId ?? ''}
                  onChange={(e) => onSelectTemplate(e.target.value || null)}
                  className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {mappedTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    window.location.href = excelUrl;
                  }}
                  className="bg-indigo-600 text-white rounded-lg py-2 px-4 hover:bg-indigo-700"
                >
                  Download Excel
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(apiUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="bg-slate-900 text-white rounded-lg py-2 px-4 hover:bg-slate-800"
                >
                  {copied ? 'Copied!' : 'Copy API URL'}
                </button>
              </div>
              <div className="text-xs text-slate-400 break-all">{apiUrl}</div>
              {selectedTemplate && (
                <div className="text-xs text-slate-400">
                  Using: {selectedTemplate.name} • {selectedTemplate.fields.length} fields
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Download Assets</h3>
          <p className="text-sm text-slate-500">Snapshot, templates, mappings, and join plan exports.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={onDownloadSnapshot} className="bg-slate-900 text-white rounded-lg py-2 px-4 hover:bg-slate-800">
            Snapshot JSON
          </button>
          <button onClick={onDownloadTemplates} className="bg-indigo-600 text-white rounded-lg py-2 px-4 hover:bg-indigo-700">
            Templates JSON
          </button>
          <button onClick={onDownloadMappings} className="bg-emerald-600 text-white rounded-lg py-2 px-4 hover:bg-emerald-700">
            Mappings JSON
          </button>
          <button onClick={onDownloadJoinPlan} className="bg-amber-600 text-white rounded-lg py-2 px-4 hover:bg-amber-700">
            Join Plan SQL
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataProducts;
