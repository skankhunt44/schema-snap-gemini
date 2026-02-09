import React from 'react';
import { BarChart3, Database, FileText, Share2 } from 'lucide-react';
import { DataSource, GeminiArtifacts, SchemaSnapshot, Template } from '../types';

type TemplateCoverage = {
  id: string;
  name: string;
  mapped: number;
  total: number;
  percent: number;
};

const StatCard: React.FC<{ title: string; value: string | number; sub: string; icon: React.ReactNode; color: string }> = ({
  title,
  value,
  sub,
  icon,
  color
}) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-sm">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900 mt-1">{value}</h3>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </div>
      <div className={`p-3 ${color} rounded-lg bg-opacity-10`}>{icon}</div>
    </div>
  </div>
);

type Props = {
  dataSources: DataSource[];
  templates: Template[];
  snapshot: SchemaSnapshot | null;
  totalMapped: number;
  templateCoverage: TemplateCoverage[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
  onDownloadSnapshot: () => void;
  onDownloadTemplates: () => void;
  onDownloadMappings: () => void;
  onDownloadJoinPlan: () => void;
  aiArtifacts: GeminiArtifacts;
};

const Analytics: React.FC<Props> = ({
  dataSources,
  templates,
  snapshot,
  totalMapped,
  templateCoverage,
  activeTemplateId,
  onSelectTemplate,
  onDownloadSnapshot,
  onDownloadTemplates,
  onDownloadMappings,
  onDownloadJoinPlan,
  aiArtifacts
}) => {
  const totalFields = templates.reduce((acc, t) => acc + t.fields.length, 0);
  const relationships = snapshot?.relationships.length ?? 0;
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
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500">Overview of schema coverage and mapping progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Data Sources"
          value={dataSources.length}
          sub="Connected sources"
          icon={<Database className="text-indigo-600" />}
          color="bg-indigo-600"
        />
        <StatCard
          title="Templates"
          value={templates.length}
          sub="Stakeholder formats"
          icon={<FileText className="text-emerald-600" />}
          color="bg-emerald-600"
        />
        <StatCard
          title="Relationships"
          value={relationships}
          sub="Inferred edges"
          icon={<Share2 className="text-sky-600" />}
          color="bg-sky-600"
        />
        <StatCard
          title="Fields Mapped"
          value={`${totalMapped}/${totalFields || 0}`}
          sub="Across all templates"
          icon={<BarChart3 className="text-violet-600" />}
          color="bg-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Template Coverage</h3>
            <p className="text-sm text-slate-500">Mapped fields per template.</p>
          </div>
          <div className="p-6 space-y-4">
            {templateCoverage.length === 0 ? (
              <div className="text-sm text-slate-400">No templates yet.</div>
            ) : (
              templateCoverage.map(item => (
                <div key={item.id} className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span>{item.mapped}/{item.total} mapped • {item.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-indigo-600"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Combined Data Output</h3>
            <p className="text-sm text-slate-500">Download the combined dataset or fetch it via API.</p>
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
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Gemini Artifacts</h3>
          <p className="text-sm text-slate-500">Saved outputs from the AI pipeline.</p>
        </div>
        <div className="p-6 space-y-4">
          {!aiArtifacts || (!aiArtifacts.schemaSummary && !aiArtifacts.fixSummary && !aiArtifacts.mappingSummary) ? (
            <div className="text-sm text-slate-400">Run the AI pipeline to save artifacts here.</div>
          ) : (
            <>
              {aiArtifacts.schemaSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Schema Summary</div>
                  <p className="text-sm text-slate-700">{aiArtifacts.schemaSummary}</p>
                </div>
              )}
              {aiArtifacts.joinPaths && aiArtifacts.joinPaths.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Join Paths</div>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {aiArtifacts.joinPaths.map((path, idx) => (
                      <li key={idx}><span className="font-semibold">{path.title}:</span> {path.path.join(' → ')}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiArtifacts.mappingSummary && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-indigo-500 mb-1">Mapping Summary</div>
                  <p className="text-sm text-indigo-700">{aiArtifacts.mappingSummary}</p>
                </div>
              )}
              {aiArtifacts.fixSummary && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-500 mb-1">Fix Suggestions</div>
                  <p className="text-sm text-emerald-700 mb-2">{aiArtifacts.fixSummary}</p>
                  <ul className="text-xs text-emerald-700 space-y-1">
                    {(aiArtifacts.fixSuggestions || []).slice(0, 3).map((item, idx) => (
                      <li key={idx}><span className="font-semibold">{item.issue}</span> → {item.fix}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Downloads</h3>
          <p className="text-sm text-slate-500">Export current state for sharing or audit.</p>
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Source Summary</h3>
          <p className="text-sm text-slate-500">Latest connected data sources</p>
        </div>

        {dataSources.length === 0 ? (
          <div className="p-10 text-center text-slate-400">No sources connected yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Tables</th>
                  <th className="px-6 py-4">Columns</th>
                  <th className="px-6 py-4">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataSources.map(source => (
                  <tr key={source.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{source.name}</td>
                    <td className="px-6 py-4 text-slate-600">{source.type}</td>
                    <td className="px-6 py-4 text-slate-600">{source.tableCount}</td>
                    <td className="px-6 py-4 text-slate-600">{source.columnCount}</td>
                    <td className="px-6 py-4 text-slate-600">{source.lastSync}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
