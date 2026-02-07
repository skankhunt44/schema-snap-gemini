import React from 'react';
import { BarChart3, Database, FileText, Share2 } from 'lucide-react';
import { DataSource, SchemaSnapshot, Template } from '../types';

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
};

const Analytics: React.FC<Props> = ({ dataSources, templates, snapshot, totalMapped }) => {
  const totalFields = templates.reduce((acc, t) => acc + t.fields.length, 0);
  const relationships = snapshot?.relationships.length ?? 0;

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
