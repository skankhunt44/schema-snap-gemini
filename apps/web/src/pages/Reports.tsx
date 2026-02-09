import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { FileText, Download, Globe, CheckCircle2 } from 'lucide-react';
import ReportPDF from '../components/ReportPDF';
import { ReportEntry, Template } from '../types';

type Props = {
  templates: Template[];
  reports: ReportEntry[];
  onGenerateReport: (templateId: string) => Promise<void> | void;
  onPublishReport: (reportId: string) => void;
};

const Reports: React.FC<Props> = ({ templates, reports, onGenerateReport, onPublishReport }) => {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(templates[0]?.id || '');
  const [activeReportId, setActiveReportId] = React.useState<string>(reports[0]?.id || '');
  const [generating, setGenerating] = React.useState(false);
  const activeReport = reports.find(report => report.id === activeReportId) || reports[0] || null;

  React.useEffect(() => {
    if (!selectedTemplateId && templates.length) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  React.useEffect(() => {
    if (!activeReportId && reports.length) {
      setActiveReportId(reports[0].id);
    }
  }, [reports, activeReportId]);

  const downloadPdf = async (report: ReportEntry) => {
    const blob = await pdf(<ReportPDF report={report} />).toBlob();
    saveAs(blob, `${report.templateName.replace(/\s+/g, '_')}_${report.dateGenerated}.pdf`);
  };

  const openHtmlReport = (report: ReportEntry) => {
    const popup = window.open('', '_blank');
    if (!popup) return;
    const rowsHtml = report.preview?.rows
      ?.map(row => `<tr>${report.preview?.columns?.slice(0, 6).map(col => `<td>${row[col] ?? ''}</td>`).join('')}</tr>`)
      .join('') || '';

    popup.document.write(`
      <html>
        <head>
          <title>${report.templateName} Report</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { margin-bottom: 4px; }
            h2 { margin-top: 24px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
            .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${report.templateName}</h1>
          <p>Stakeholder: ${report.stakeholder} • Date: ${report.dateGenerated}</p>
          ${report.period ? `<p>Reporting period: ${report.period}</p>` : ''}
          ${report.dataFreshness ? `<p>Data freshness: ${report.dataFreshness}</p>` : ''}
          <h2>Executive Summary</h2>
          <p>${report.narrative || ''}</p>
          ${report.highlights?.length ? `<h2>Highlights</h2><ul>${report.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
          ${report.kpis?.length ? `<h2>Key Metrics</h2><div class="kpis">${report.kpis.map(k => `<div class="card"><div>${k.label}</div><strong>${k.value}</strong><div>${k.detail || ''}</div><div>${k.definition || ''}</div><div>${k.variance || ''}</div></div>`).join('')}</div>` : ''}
          ${report.variance ? `<h2>Variance vs Prior Period</h2><p>${report.variance.label}: ${report.variance.current.toFixed(2)} vs ${report.variance.previous.toFixed(2)} (${report.variance.deltaPct.toFixed(1)}%)</p>` : ''}
          ${report.dataQuality ? `<h2>Data Quality</h2><p>Missing values rate: ${(report.dataQuality.missingRatio * 100).toFixed(1)}% • Rows: ${report.dataQuality.totalRows}</p>` : ''}
          ${report.exceptions?.length ? `<h2>Exceptions & Anomalies</h2><ul>${report.exceptions.map(item => `<li>${item}</li>`).join('')}</ul>` : ''}
          ${report.joinPaths?.length ? `<h2>Lineage & Join Paths</h2><ul>${report.joinPaths.map(j => `<li><strong>${j.title}:</strong> ${j.path.join(' → ')}</li>`).join('')}</ul>` : ''}
          ${rowsHtml ? `<h2>Appendix (Sample Rows)</h2><table><thead><tr>${report.preview?.columns?.slice(0, 6).map(col => `<th>${col}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>` : ''}
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Report Studio</h1>
        <p className="text-slate-500">Generate stakeholder-ready reports with narrative, KPIs, and evidence.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-3">
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">Select template</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (!selectedTemplateId) return;
                setGenerating(true);
                try {
                  await onGenerateReport(selectedTemplateId);
                } finally {
                  setGenerating(false);
                }
              }}
              disabled={!selectedTemplateId || generating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating && (
                <span className="h-4 w-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
              )}
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Report History</h2>
          {reports.length === 0 ? (
            <div className="text-sm text-slate-400">No reports generated yet.</div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <button
                  key={report.id}
                  onClick={() => setActiveReportId(report.id)}
                  className={`w-full text-left p-3 rounded-lg border ${activeReportId === report.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
                >
                  <div className="font-medium text-slate-900">{report.templateName}</div>
                  <div className="text-xs text-slate-500">{report.dateGenerated}</div>
                  <div className="text-xs text-slate-400">{report.status}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          {!activeReport ? (
            <div className="text-sm text-slate-400">Select a report to preview.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{activeReport.templateName}</h2>
                  <p className="text-xs text-slate-500">{activeReport.stakeholder} • {activeReport.dateGenerated}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openHtmlReport(activeReport)}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <Globe size={14} /> View HTML
                  </button>
                  <button
                    onClick={() => downloadPdf(activeReport)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <Download size={14} /> Download PDF
                  </button>
                  {activeReport.status !== 'Published' ? (
                    <button
                      onClick={() => onPublishReport(activeReport.id)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-xs flex items-center gap-1"
                    >
                      <CheckCircle2 size={14} /> Mark Published
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-semibold">Published</span>
                  )}
                </div>
              </div>

              {(activeReport.period || activeReport.dataFreshness) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Report Scope</h3>
                  {activeReport.period && (
                    <p className="text-sm text-slate-600">Reporting period: {activeReport.period}</p>
                  )}
                  {activeReport.dataFreshness && (
                    <p className="text-sm text-slate-600">Data freshness: {activeReport.dataFreshness}</p>
                  )}
                </div>
              )}

              {activeReport.narrative && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Executive Summary</h3>
                  <p className="text-sm text-slate-600">{activeReport.narrative}</p>
                </div>
              )}

              {activeReport.highlights && activeReport.highlights.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Highlights</h3>
                  <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                    {activeReport.highlights.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeReport.kpis && activeReport.kpis.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Key Metrics</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeReport.kpis.map((kpi, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-3">
                        <div className="text-xs text-slate-400 uppercase">{kpi.label}</div>
                        <div className="text-lg font-semibold text-slate-900">{kpi.value}</div>
                        {kpi.detail && <div className="text-xs text-slate-500">{kpi.detail}</div>}
                        {kpi.definition && <div className="text-xs text-slate-500">Definition: {kpi.definition}</div>}
                        {kpi.variance && <div className="text-xs text-indigo-600">Variance: {kpi.variance}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeReport.variance && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Variance vs Prior Period</h3>
                  <p className="text-sm text-slate-600">
                    {activeReport.variance.label}: {activeReport.variance.current.toFixed(2)} vs {activeReport.variance.previous.toFixed(2)}
                    {' '}({activeReport.variance.deltaPct.toFixed(1)}%)
                  </p>
                </div>
              )}

              {activeReport.dataQuality && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Quality</h3>
                  <p className="text-sm text-slate-600">Missing values rate: {(activeReport.dataQuality.missingRatio * 100).toFixed(1)}% • Rows: {activeReport.dataQuality.totalRows}</p>
                </div>
              )}

              {activeReport.exceptions && activeReport.exceptions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Exceptions & Anomalies</h3>
                  <ul className="text-sm text-slate-600 list-disc list-inside">
                    {activeReport.exceptions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeReport.joinPaths && activeReport.joinPaths.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Lineage & Join Paths</h3>
                  <ul className="text-sm text-slate-600 list-disc list-inside">
                    {activeReport.joinPaths.map((path, idx) => (
                      <li key={idx}><span className="font-semibold">{path.title}:</span> {path.path.join(' → ')}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeReport.preview && activeReport.preview.columns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Appendix (Sample Rows)</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          {activeReport.preview.columns.slice(0, 6).map(col => (
                            <th key={col} className="px-2 py-2 text-left font-medium">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeReport.preview.rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            {activeReport.preview!.columns.slice(0, 6).map(col => (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
