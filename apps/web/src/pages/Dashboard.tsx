import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Share2, Wand2, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { DataSource, SchemaSnapshot, Template } from '../types';

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

const Dashboard: React.FC<{
  snapshot: SchemaSnapshot | null;
  templates: Template[];
  dataSources: DataSource[];
  mappedCount: number;
  totalMapped: number;
  templateCoverage: TemplateCoverage[];
  onLoadSample: () => void;
}> = ({ snapshot, templates, dataSources, mappedCount, totalMapped, templateCoverage, onLoadSample }) => {
  const tableCount = snapshot?.tables.length ?? 0;
  const columnCount = snapshot?.tables.reduce((acc, t) => acc + t.columns.length, 0) ?? 0;
  const relationships = snapshot?.relationships.length ?? 0;
  const totalFields = templates.reduce((acc, t) => acc + t.fields.length, 0);
  const mappedTemplates = templateCoverage.filter(template => template.mapped > 0);
  const chartData = mappedTemplates.map(template => ({
    name: template.name.length > 16 ? `${template.name.slice(0, 16)}…` : template.name,
    percent: template.percent,
    mapped: template.mapped,
    total: template.total
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to SchemaSnap</h1>
        <p className="text-slate-500">Discover relationships and map messy data to stakeholder templates in minutes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Tables"
          value={tableCount}
          sub="Detected across inputs"
          icon={<Database className="text-indigo-600" />}
          color="bg-indigo-600"
        />
        <StatCard
          title="Relationships"
          value={relationships}
          sub="Inferred edges"
          icon={<Share2 className="text-sky-600" />}
          color="bg-sky-600"
        />
        <StatCard
          title="Templates"
          value={templates.length}
          sub={`${dataSources.length} data sources connected`}
          icon={<FileText className="text-emerald-600" />}
          color="bg-emerald-600"
        />
        <StatCard
          title="Fields Mapped"
          value={`${totalMapped}/${totalFields || 0}`}
          sub="Across all templates"
          icon={<Wand2 className="text-violet-600" />}
          color="bg-violet-600"
        />
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Mapping Coverage</h3>
            <p className="text-sm text-slate-500">Templates with at least one mapped field.</p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Live</span>
        </div>
        {chartData.length === 0 ? (
          <div className="text-sm text-slate-400">Map at least one field to see coverage trends.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                <ReTooltip
                  formatter={(value: number, _name: string, props: any) => {
                    const payload = props?.payload as { mapped?: number; total?: number };
                    if (!payload) return [`${value}%`, 'Coverage'];
                    return [`${value}% (${payload.mapped ?? 0}/${payload.total ?? 0})`, 'Coverage'];
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748b', marginBottom: '0.25rem' }}
                />
                <Bar dataKey="percent" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
