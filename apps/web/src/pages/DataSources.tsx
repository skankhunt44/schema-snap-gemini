import React from 'react';
import { SchemaSnapshot } from '../types';

type Props = {
  ddl: string;
  dialect: string;
  dbType: string;
  connectionString: string;
  loading: boolean;
  error: string | null;
  onDdlChange: (value: string) => void;
  onDialectChange: (value: string) => void;
  onDbTypeChange: (value: string) => void;
  onConnectionChange: (value: string) => void;
  onCsvUpload: (files: File[]) => void;
  onDDLAnalyze: () => void;
  onDbAnalyze: () => void;
  onSQLiteUpload: (file: File) => void;
};

const DataSources: React.FC<Props> = ({
  ddl,
  dialect,
  dbType,
  connectionString,
  loading,
  error,
  onDdlChange,
  onDialectChange,
  onDbTypeChange,
  onConnectionChange,
  onCsvUpload,
  onDDLAnalyze,
  onDbAnalyze,
  onSQLiteUpload
}) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
        <p className="text-slate-500">Connect your data to build a relationship graph.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">CSV Upload</h3>
          <p className="text-sm text-slate-500 mb-4">Upload multiple CSVs to infer schema relationships.</p>
          <input
            type="file"
            accept=".csv"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              onCsvUpload(files);
            }}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">SQL DDL</h3>
          <p className="text-sm text-slate-500 mb-4">Paste CREATE TABLE statements.</p>
          <select
            value={dialect}
            onChange={(e) => onDialectChange(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 mb-2"
          >
            <option value="postgresql">Postgres</option>
            <option value="mysql">MySQL</option>
            <option value="sqlite">SQLite</option>
          </select>
          <textarea
            className="w-full h-32 border border-slate-200 rounded-lg p-2 text-sm"
            placeholder="Paste CREATE TABLE statements..."
            value={ddl}
            onChange={(e) => onDdlChange(e.target.value)}
          />
          <button
            onClick={onDDLAnalyze}
            disabled={!ddl || loading}
            className="mt-2 w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            Analyze DDL
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">Database Connection</h3>
          <p className="text-sm text-slate-500 mb-4">Connect to Postgres/Supabase or MySQL.</p>
          <select
            value={dbType}
            onChange={(e) => onDbTypeChange(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 mb-2"
          >
            <option value="postgres">Postgres</option>
            <option value="supabase">Supabase (Postgres)</option>
            <option value="mysql">MySQL</option>
          </select>
          <input
            type="text"
            placeholder="Connection string"
            value={connectionString}
            onChange={(e) => onConnectionChange(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 mb-2"
          />
          <button
            onClick={onDbAnalyze}
            disabled={!connectionString || loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            Analyze DB
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-2">SQLite File</h3>
          <p className="text-sm text-slate-500 mb-4">Upload a .db or .sqlite file.</p>
          <input
            type="file"
            accept=".db,.sqlite"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSQLiteUpload(file);
            }}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Analyzing…</p>}
      {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
    </div>
  );
};

export default DataSources;
