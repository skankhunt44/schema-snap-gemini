import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Share2, Wand2, FileText } from 'lucide-react';
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

const Dashboard: React.FC<{
  snapshot: SchemaSnapshot | null;
  templates: Template[];
  dataSources: DataSource[];
  mappedCount: number;
  totalMapped: number;
  onLoadSample: () => void;
}> = ({ snapshot, templates, dataSources, mappedCount, totalMapped, onLoadSample }) => {
  const tableCount = snapshot?.tables.length ?? 0;
  const columnCount = snapshot?.tables.reduce((acc, t) => acc + t.columns.length, 0) ?? 0;
  const relationships = snapshot?.relationships.length ?? 0;
  const totalFields = templates.reduce((acc, t) => acc + t.fields.length, 0);

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
