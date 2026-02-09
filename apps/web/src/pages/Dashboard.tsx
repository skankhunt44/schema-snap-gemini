import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, Share2, Clock, CheckCircle2, AlertTriangle, Download, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { DataSource, ReportEntry, Template } from '../types';

const StatCard: React.FC<{ title: string; value: string | number; sub: string; icon: React.ReactNode; color: string }> = ({
  title,
  value,
  sub,
  icon,
  color
}) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>{icon}</div>
    </div>
    <p className="text-xs text-slate-400">{sub}</p>
  </div>
);

type TemplateCoverage = {
  id: string;
  name: string;
  mapped: number;
  total: number;
  percent: number;
};

type PipelineStepStatus = 'idle' | 'running' | 'done' | 'error';

type PipelineState = {
  status: 'idle' | 'running' | 'done' | 'error';
  error: string | null;
  prompt: string;
  steps: {
    schema: PipelineStepStatus;
    template: PipelineStepStatus;
    mapping: PipelineStepStatus;
    fixes: PipelineStepStatus;
    output: PipelineStepStatus;
  };
  data: {
    schemaSummary?: string;
    joinPaths?: Array<{ title: string; path: string[]; rationale: string }>;
    template?: Template;
    mappingSummary?: string;
    fixSummary?: string;
    fixSuggestions?: Array<{ issue: string; fix: string; rationale?: string }>;
    outputPreview?: { columns: string[]; rows: Record<string, unknown>[] };
  };
};

const Dashboard: React.FC<{
  templates: Template[];
  dataSources: DataSource[];
  templateCoverage: TemplateCoverage[];
  reports: ReportEntry[];
  validationIssues: number;
  pipeline: PipelineState;
  onRunPipeline: (prompt: string) => void;
  onLoadSample: () => void;
  onGenerateReport: (templateId: string) => void;
  onPublishReport: (reportId: string) => void;
}> = ({
  templates,
  dataSources,
  templateCoverage,
  reports,
  validationIssues,
  pipeline,
  onRunPipeline,
  onLoadSample,
  onGenerateReport,
  onPublishReport
}) => {
  const navigate = useNavigate();
  const [pipelinePrompt, setPipelinePrompt] = React.useState(pipeline.prompt);
  const mappedTemplates = templateCoverage.filter(template => template.mapped > 0);

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - (6 - i));
      return date;
    });

    return last7.map(date => {
      const dateStr = date.toLocaleDateString();
      const count = reports.filter(r => r.dateGenerated === dateStr).length;
      return {
        name: days[date.getDay()],
        reports: count,
        fullDate: dateStr
      };
    });
  }, [reports]);

  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    return templates
      .filter(template => template.nextDueDate)
      .map(template => {
        const dueDate = new Date(template.nextDueDate!);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status: 'Overdue' | 'Due Soon' | 'On Track' = 'On Track';
        if (diffDays < 0) status = 'Overdue';
        else if (diffDays <= 7) status = 'Due Soon';
        return {
          template,
          dueDate,
          diffDays,
          status,
          mapped: mappedTemplates.some(item => item.id === template.id)
        };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [templates, mappedTemplates]);

  const apiUrlForTemplate = (templateId: string) =>
    `${window.location.origin}/api/output?format=json&templateId=${encodeURIComponent(templateId)}`;

  const statusColor = (status: PipelineStepStatus) => {
    if (status === 'done') return 'text-emerald-600';
    if (status === 'running') return 'text-indigo-600';
    if (status === 'error') return 'text-rose-600';
    return 'text-slate-400';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to SchemaSnap</h1>
        <p className="text-slate-500">Discover relationships and map messy data to stakeholder templates in minutes.</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-8">
        <p className="text-sm text-indigo-900 font-semibold">Problem we solve</p>
        <p className="text-sm text-indigo-700">
          Teams waste weeks reconciling messy, mismatched data sources into stakeholder-ready reports — SchemaSnap turns that into a 3-minute, AI-guided workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Reports Generated"
          value={reports.length}
          sub="All templates"
          icon={<Clock className="text-indigo-600" />}
          color="bg-indigo-600"
        />
        <StatCard
          title="Published Reports"
          value={reports.filter(report => report.status === 'Published').length}
          sub="API-ready"
          icon={<CheckCircle2 className="text-emerald-600" />}
          color="bg-emerald-600"
        />
        <StatCard
          title="Validation Issues"
          value={validationIssues}
          sub="Required fields unmapped"
          icon={<AlertTriangle className="text-amber-600" />}
          color="bg-amber-600"
        />
        <StatCard
          title="Connected Sources"
          value={dataSources.filter(source => source.status === 'connected').length}
          sub="Live data"
          icon={<Database className="text-sky-600" />}
          color="bg-sky-600"
        />
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">AI Report Builder</h3>
            <p className="text-sm text-slate-500">Describe the report you need. Gemini will explain the schema, build a template, map fields, suggest fixes, and generate a preview.</p>
          </div>
          <button
            onClick={() => onRunPipeline(pipelinePrompt)}
            disabled={pipeline.status === 'running'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {pipeline.status === 'running' ? 'Running…' : 'Run AI Pipeline'}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[110px]"
              value={pipelinePrompt}
              onChange={(e) => setPipelinePrompt(e.target.value)}
              placeholder="Create a donor impact report template for board members"
            />
            {pipeline.error && <p className="text-sm text-rose-500">{pipeline.error}</p>}
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>1. Schema Explainer</span>
                <span className={statusColor(pipeline.steps.schema)}>{pipeline.steps.schema}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>2. Template Generator</span>
                <span className={statusColor(pipeline.steps.template)}>{pipeline.steps.template}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>3. Auto‑Mapping + Ops</span>
                <span className={statusColor(pipeline.steps.mapping)}>{pipeline.steps.mapping}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>4. Fix Suggestions</span>
                <span className={statusColor(pipeline.steps.fixes)}>{pipeline.steps.fixes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>5. Output Preview</span>
                <span className={statusColor(pipeline.steps.output)}>{pipeline.steps.output}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {pipeline.data.schemaSummary && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Schema Summary</div>
                <p className="text-sm text-slate-700">{pipeline.data.schemaSummary}</p>
              </div>
            )}
            {pipeline.data.joinPaths && pipeline.data.joinPaths.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Join Paths</div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {pipeline.data.joinPaths.map((path, idx) => (
                    <li key={idx}><span className="font-semibold">{path.title}:</span> {path.path.join(' → ')}</li>
                  ))}
                </ul>
              </div>
            )}
            {pipeline.data.mappingSummary && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-indigo-500 mb-1">Gemini Mapping Summary</div>
                <p className="text-sm text-indigo-700">{pipeline.data.mappingSummary}</p>
              </div>
            )}
            {pipeline.data.fixSummary && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-emerald-500 mb-1">Fix Suggestions</div>
                <p className="text-sm text-emerald-700 mb-2">{pipeline.data.fixSummary}</p>
                <ul className="text-xs text-emerald-700 space-y-1">
                  {(pipeline.data.fixSuggestions || []).slice(0, 3).map((item, idx) => (
                    <li key={idx}><span className="font-semibold">{item.issue}</span> → {item.fix}</li>
                  ))}
                </ul>
              </div>
            )}
            {pipeline.data.outputPreview && pipeline.data.outputPreview.columns.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-slate-400 bg-slate-50">Output Preview</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {pipeline.data.outputPreview.columns.slice(0, 6).map(col => (
                          <th key={col} className="px-2 py-2 text-left font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pipeline.data.outputPreview.rows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          {pipeline.data.outputPreview!.columns.slice(0, 6).map(col => (
                            <td key={col} className="px-2 py-2 text-slate-600">{String(row[col] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Report Activity (Last 7 Days)</h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Live</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                <ReTooltip
                  formatter={(value: number) => [`${value} reports`, 'Generated']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748b', marginBottom: '0.25rem' }}
                />
                <Bar dataKey="reports" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Upcoming Deadlines</h3>
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[320px]">
            {upcomingDeadlines.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No schedules set.</div>
            ) : (
              upcomingDeadlines.map(item => (
                <div key={item.template.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm truncate pr-2">{item.template.name}</p>
                      <p className="text-xs text-slate-500">{item.template.frequency} • Due {item.dueDate.toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${item.status === 'Overdue'
                      ? 'bg-rose-100 text-rose-700'
                      : item.status === 'Due Soon'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                      }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {item.mapped ? (
                      <button
                        onClick={() => onGenerateReport(item.template.id)}
                        className="flex-1 py-1.5 px-3 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
                      >
                        Generate & Download
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/map')}
                        className="flex-1 py-1.5 px-3 bg-amber-50 border border-amber-200 rounded text-xs font-medium text-amber-700 hover:bg-amber-100"
                      >
                        Setup Mapping
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            to="/schedule"
            className="w-full mt-6 py-2 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            View Schedule <Share2 size={14} />
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Report History</h3>
          <p className="text-sm text-slate-500">Generated outputs and distribution status.</p>
        </div>
        {reports.length === 0 ? (
          <div className="p-10 text-center text-slate-400">No reports generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Template</th>
                  <th className="px-6 py-4">Generated</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map(report => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{report.templateName}</div>
                      <div className="text-xs text-slate-400">{report.stakeholder}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{report.dateGenerated}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${report.status === 'Published'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {report.status !== 'Published' ? (
                          <button
                            onClick={() => onPublishReport(report.id)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 rounded text-xs font-medium"
                          >
                            Publish API
                          </button>
                        ) : (
                          <button
                            onClick={() => navigator.clipboard.writeText(apiUrlForTemplate(report.templateId))}
                            className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium flex items-center gap-1"
                          >
                            <Globe size={12} /> Copy API URL
                          </button>
                        )}
                        <button
                          onClick={() => {
                            window.location.href = `/api/output?format=xlsx&templateId=${encodeURIComponent(report.templateId)}`;
                          }}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-medium flex items-center gap-1"
                        >
                          <Download size={12} /> Download Excel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">Connect data</h3>
          <p className="text-sm text-slate-500 mb-4">Upload CSVs, paste DDL, or connect a local DB.</p>
          <div className="flex flex-col gap-2">
            <Link className="text-indigo-600 font-medium" to="/connect">Go to Data Sources →</Link>
            <button
              onClick={onLoadSample}
              className="text-sm px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
            >
              Load sample nonprofit data
            </button>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">Map templates</h3>
          <p className="text-sm text-slate-500 mb-4">Define stakeholder fields and auto-map to your schema.</p>
          <Link className="text-indigo-600 font-medium" to="/templates">Go to Templates →</Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">Explore relationships</h3>
          <p className="text-sm text-slate-500 mb-4">Review graph edges with explainable evidence.</p>
          <Link className="text-indigo-600 font-medium" to="/relationships">View Graph →</Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
