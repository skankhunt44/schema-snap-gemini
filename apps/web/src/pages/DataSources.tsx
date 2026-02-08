import React, { useRef, useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  FileSpreadsheet,
  Server,
  Code2,
  FileText,
  UploadCloud
} from 'lucide-react';
import { DataSource } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

type Props = {
  dataSources: DataSource[];
  loading: boolean;
  error: string | null;
  onCsvIngest: (name: string, files: File[]) => Promise<boolean> | boolean;
  onDDLIngest: (name: string, ddl: string, dialect: string) => Promise<boolean> | boolean;
  onDbIngest: (name: string, dbType: string, connectionString: string) => Promise<boolean> | boolean;
  onSQLiteIngest: (name: string, file: File) => Promise<boolean> | boolean;
  onRemoveSource: (id: string) => void;
};

const DataSources: React.FC<Props> = ({
  dataSources,
  loading,
  error,
  onCsvIngest,
  onDDLIngest,
  onDbIngest,
  onSQLiteIngest,
  onRemoveSource
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'csv' | 'db' | 'ddl' | 'sqlite'>('csv');
  const [name, setName] = useState('');
  const [ddl, setDdl] = useState('');
  const [dialect, setDialect] = useState('postgresql');
  const [dbType, setDbType] = useState('postgres');
  const [connectionString, setConnectionString] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sqliteInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setDdl('');
    setDialect('postgresql');
    setDbType('postgres');
    setConnectionString('');
    setFiles([]);
    setSqliteFile(null);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleCsvSubmit = async () => {
    if (!files.length) return;
    const sourceName = name || files[0].name.replace(/\.(csv|xlsx|xls)$/i, '');
    const ok = await onCsvIngest(sourceName, files);
    if (ok) handleClose();
  };

  const handleDdlSubmit = async () => {
    if (!ddl) return;
    const sourceName = name || 'DDL Upload';
    const ok = await onDDLIngest(sourceName, ddl, dialect);
    if (ok) handleClose();
  };

  const handleDbSubmit = async () => {
    if (!connectionString) return;
    const sourceName = name || `${dbType} connection`;
    const ok = await onDbIngest(sourceName, dbType, connectionString);
    if (ok) handleClose();
  };

  const handleSqliteSubmit = async () => {
    if (!sqliteFile) return;
    const sourceName = name || sqliteFile.name.replace(/\.(db|sqlite)$/i, '');
    const ok = await onSQLiteIngest(sourceName, sqliteFile);
    if (ok) handleClose();
  };

  const tabButton = (tab: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
          <p className="text-slate-500">Add CSVs or connect to databases to build your relationship graph.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700"
        >
          <Plus size={18} /> Add Data Source
        </button>
      </div>

      {error && <p className="text-sm text-rose-500 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dataSources.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-slate-500">
            No data sources yet. Add one to get started.
          </div>
        ) : (
          dataSources.map(source => (
            <div key={source.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{source.name}</h3>
                  <p className="text-xs text-slate-500">{source.type} • {source.tableCount} tables • {source.columnCount} cols</p>
                </div>
                <button
                  onClick={() => setConfirmDelete(source.id)}
                  className="text-slate-400 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Status: {source.status}</span>
                <span>Last sync: {source.lastSync}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add Data Source</h3>
              <p className="text-sm text-slate-500">Choose a source type and connect your data.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {tabButton('csv', 'CSV / Excel')}
                {tabButton('db', 'Database')}
                {tabButton('ddl', 'SQL DDL')}
                {tabButton('sqlite', 'SQLite File')}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Display Name</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                    placeholder="e.g. Donor CSV"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {activeTab === 'csv' && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2 text-slate-600">
                    <FileSpreadsheet size={18} /> Upload CSV or Excel files
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  <button
                    onClick={handleCsvSubmit}
                    disabled={!files.length || loading}
                    className="mt-3 w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Analyzing…' : 'Connect Files'}
                  </button>
                </div>
              )}

              {activeTab === 'db' && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Server size={18} /> Connect to Postgres / Supabase / MySQL
                  </div>
                  <select
                    value={dbType}
                    onChange={(e) => setDbType(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="postgres">Postgres</option>
                    <option value="supabase">Supabase (Postgres)</option>
                    <option value="mysql">MySQL</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Connection string"
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={handleDbSubmit}
                    disabled={!connectionString || loading}
                    className="w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Connecting…' : 'Connect Database'}
                  </button>
                </div>
              )}

              {activeTab === 'ddl' && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Code2 size={18} /> Paste CREATE TABLE statements
                  </div>
                  <select
                    value={dialect}
                    onChange={(e) => setDialect(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="postgresql">Postgres</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                  <textarea
                    className="w-full h-32 border border-slate-200 rounded-lg p-2 text-sm"
                    placeholder="Paste DDL here..."
                    value={ddl}
                    onChange={(e) => setDdl(e.target.value)}
                  />
                  <button
                    onClick={handleDdlSubmit}
                    disabled={!ddl || loading}
                    className="w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Analyzing…' : 'Analyze DDL'}
                  </button>
                </div>
              )}

              {activeTab === 'sqlite' && (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2 text-slate-600">
                    <FileText size={18} /> Upload SQLite database file
                  </div>
                  <input
                    ref={sqliteInputRef}
                    type="file"
                    accept=".db,.sqlite"
                    onChange={(e) => setSqliteFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  <button
                    onClick={handleSqliteSubmit}
                    disabled={!sqliteFile || loading}
                    className="mt-3 w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Analyzing…' : 'Connect SQLite'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Remove data source?"
        message="This will remove the data source from the list."
        confirmText="Remove"
        isDangerous
        onConfirm={() => {
          if (confirmDelete) onRemoveSource(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default DataSources;
