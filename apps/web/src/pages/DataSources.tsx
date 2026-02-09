import React, { useRef, useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  FileSpreadsheet,
  Server,
  Code2,
  FileText,
  UploadCloud,
  X
} from 'lucide-react';
import { DataSource, SchemaSnapshot, TableSchema } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

type Props = {
  dataSources: DataSource[];
  snapshot: SchemaSnapshot | null;
  loading: boolean;
  error: string | null;
  onCsvIngest: (name: string, files: File[], autoFix?: boolean) => Promise<boolean> | boolean;
  onDDLIngest: (name: string, ddl: string, dialect: string) => Promise<boolean> | boolean;
  onDbIngest: (name: string, dbType: string, connectionString: string) => Promise<boolean> | boolean;
  onSQLiteIngest: (name: string, file: File) => Promise<boolean> | boolean;
  onRemoveSource: (id: string) => void;
};

const DataSources: React.FC<Props> = ({
  dataSources,
  snapshot,
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
  const [autoFix, setAutoFix] = useState(true);
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);
  const [previewTable, setPreviewTable] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sqliteInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setDdl('');
    setDialect('postgresql');
    setDbType('postgres');
    setConnectionString('');
    setFiles([]);
    setAutoFix(true);
    setSqliteFile(null);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleCsvSubmit = async () => {
    if (!files.length) return;
    const sourceName = name || files[0].name.replace(/\.(csv|xlsx|xls)$/i, '');
    const ok = await onCsvIngest(sourceName, files, autoFix);
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

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isIdColumn = (name: string) => /(^id$|_id$|id$)/i.test(name);

  const buildFixScript = (table: TableSchema) => {
    const missingColumns = table.columns.filter(c => (c.nullRatio ?? 0) >= 0.05);
    const idColumns = table.columns.filter(c => isIdColumn(c.name));

    const lines: string[] = [
      'import pandas as pd',
      '',
      `df = pd.read_csv("${table.name}.csv")`,
      ''
    ];

    missingColumns.forEach(col => {
      const name = col.name;
      const dataType = col.dataType;
      if (dataType === 'number' || dataType === 'currency') {
        lines.push(`df["${name}"] = pd.to_numeric(df["${name}"], errors="coerce")`);
        lines.push(`df["${name}"] = df["${name}"].fillna(df["${name}"].median())`);
      } else if (dataType === 'date') {
        lines.push(`df["${name}"] = pd.to_datetime(df["${name}"], errors="coerce")`);
        lines.push(`df["${name}"] = df["${name}"].fillna(df["${name}"].mode().iloc[0])`);
      } else {
        lines.push(`df["${name}"] = df["${name}"].fillna(df["${name}"].mode().iloc[0])`);
      }
      lines.push('');
    });

    if (idColumns.length) {
      const idList = idColumns.map(c => `"${c.name}"`).join(', ');
      lines.push(`df = df.drop_duplicates(subset=[${idList}])`);
      lines.push('');
    }

    lines.push(`df.to_csv("${table.name}.cleaned.csv", index=False)`);
    return lines.join('\n');
  };

  const qualityTables = (snapshot?.tables || []).map(table => {
    const missingColumns = table.columns.filter(c => (c.nullRatio ?? 0) >= 0.05);
    const duplicateIdColumns = table.columns.filter(
      c => isIdColumn(c.name) && (c.uniqueRatio ?? 1) < 0.9
    );
    const lowVarianceColumns = table.columns.filter(
      c => !isIdColumn(c.name) && (c.uniqueRatio ?? 1) > 0 && (c.uniqueRatio ?? 1) < 0.05
    );

    return { table, missingColumns, duplicateIdColumns, lowVarianceColumns };
  });

  const tablesWithIssues = qualityTables.filter(
    entry =>
      entry.missingColumns.length || entry.duplicateIdColumns.length || entry.lowVarianceColumns.length
  );

  const previewSource = dataSources.find(source => source.id === previewSourceId) || null;
  const previewTables = React.useMemo(() => {
    if (!snapshot?.tables?.length) return [] as TableSchema[];
    if (!previewSource?.fields?.length) return snapshot.tables;
    const tableNames = new Set(previewSource.fields.map(field => field.table));
    return snapshot.tables.filter(table => tableNames.has(table.name));
  }, [snapshot, previewSource]);

  React.useEffect(() => {
    if (!previewSourceId) {
      setPreviewTable(null);
      return;
    }
    if (previewTables.length === 0) {
      setPreviewTable(null);
      return;
    }
    if (!previewTable || !previewTables.some(table => table.name === previewTable)) {
      setPreviewTable(previewTables[0].name);
    }
  }, [previewSourceId, previewTables, previewTable]);

  const selectedPreviewTable = previewTables.find(table => table.name === previewTable) || previewTables[0];

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
              <div className="mt-3">
                <button
                  onClick={() => setPreviewSourceId(source.id)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Preview data
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Data Quality</h2>
          <p className="text-sm text-slate-500">
            Based on profile stats from the uploaded data sample (missing values, uniqueness, etc.).
          </p>
        </div>

        {!snapshot ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-slate-500">
            Upload data to generate a data quality report.
          </div>
        ) : tablesWithIssues.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-emerald-600">
            No major quality issues detected in the sampled data.
          </div>
        ) : (
          <div className="space-y-4">
            {tablesWithIssues.map(({ table, missingColumns, duplicateIdColumns, lowVarianceColumns }) => (
              <div key={table.name} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{table.name}</h3>
                    <p className="text-xs text-slate-500">{table.columns.length} columns • {table.rowCount ?? '—'} rows sampled</p>
                  </div>
                  <button
                    onClick={() => downloadTextFile(`${table.name}-cleaning.py`, buildFixScript(table))}
                    className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Download Fix Script
                  </button>
                </div>

                {missingColumns.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Missing values</div>
                    <ul className="text-sm text-slate-600 space-y-1">
                      {missingColumns.map(col => (
                        <li key={col.name}>
                          <span className="font-medium text-slate-800">{col.name}</span> — {Math.round((col.nullRatio || 0) * 100)}% missing. Suggest fill with {col.dataType === 'number' || col.dataType === 'currency' ? 'median' : 'mode'} or drop rows.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {duplicateIdColumns.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Duplicate IDs</div>
                    <ul className="text-sm text-slate-600 space-y-1">
                      {duplicateIdColumns.map(col => (
                        <li key={col.name}>
                          <span className="font-medium text-slate-800">{col.name}</span> — unique ratio {Math.round((col.uniqueRatio || 0) * 100)}%. Suggest deduping on this ID.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lowVarianceColumns.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Low variance</div>
                    <ul className="text-sm text-slate-600 space-y-1">
                      {lowVarianceColumns.map(col => (
                        <li key={col.name}>
                          <span className="font-medium text-slate-800">{col.name}</span> — low uniqueness. Consider dropping or grouping this column.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewSourceId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Data Preview</h3>
                <p className="text-sm text-slate-500">
                  {previewSource?.name || 'Selected source'} • showing up to 25 rows
                </p>
              </div>
              <button
                onClick={() => setPreviewSourceId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {previewTables.length === 0 ? (
                <div className="text-sm text-slate-500">No preview rows available for this source.</div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-xs uppercase tracking-wide text-slate-500">Table</label>
                    <select
                      value={selectedPreviewTable?.name || ''}
                      onChange={(e) => setPreviewTable(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {previewTables.map(table => (
                        <option key={table.name} value={table.name}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedPreviewTable?.sampleRows?.length ? (
                    <div className="text-sm text-slate-500">No row samples captured for this table.</div>
                  ) : (
                    <div className="overflow-auto border border-slate-200 rounded-xl">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            {selectedPreviewTable.columns.map(col => (
                              <th key={col.name} className="px-4 py-2 text-left font-medium">
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPreviewTable.sampleRows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-slate-50">
                              {selectedPreviewTable.columns.map(col => (
                                <td key={col.name} className="px-4 py-2 text-slate-600">
                                  {row[col.name] !== undefined && row[col.name] !== null && String(row[col.name]).length
                                    ? String(row[col.name])
                                    : '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const dropped = Array.from(e.dataTransfer.files || []).filter(file =>
                        /\.(csv|xlsx|xls)$/i.test(file.name)
                      );
                      if (dropped.length) setFiles(dropped);
                    }}
                    className={`border-2 border-dashed rounded-xl p-4 text-center text-sm ${
                      dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-slate-500">Drag & drop CSV/XLSX here or click to browse</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                      className="mt-3 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      id="auto-fix-toggle"
                      type="checkbox"
                      checked={autoFix}
                      onChange={(e) => setAutoFix(e.target.checked)}
                    />
                    <label htmlFor="auto-fix-toggle">
                      Auto-fix data quality issues before ingesting (fill missing values, dedupe IDs)
                    </label>
                  </div>
                  <button
                    onClick={handleCsvSubmit}
                    disabled={!files.length || loading}
                    className="mt-3 w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Analyzing…' : autoFix ? 'Auto-Fix & Re-Upload' : 'Connect Files'}
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
