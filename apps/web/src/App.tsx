import React from 'react';
import { ingestCsv, ingestDDL, ingestDB, ingestSQLite } from './lib/api';
import { SchemaSnapshot } from './types';
import GraphView from './components/GraphView';

export default function App() {
  const [snapshot, setSnapshot] = React.useState<SchemaSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [ddl, setDdl] = React.useState('');
  const [dialect, setDialect] = React.useState('postgresql');
  const [dbType, setDbType] = React.useState('postgres');
  const [connectionString, setConnectionString] = React.useState('');

  const run = async (fn: () => Promise<SchemaSnapshot>) => {
    try {
      setError(null);
      setLoading(true);
      const data = await fn();
      setSnapshot(data);
    } catch (e: any) {
      setError(e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Schema Snap (Gemini)</h1>
        <p>Infer relationships across messy schemas and get explainable mapping suggestions.</p>
      </header>

      <section className="panel">
        <h2>1) Ingest data</h2>
        <div className="grid">
          <div className="card">
            <h3>CSV Upload</h3>
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                run(() => ingestCsv(files));
              }}
            />
          </div>

          <div className="card">
            <h3>SQL DDL</h3>
            <select value={dialect} onChange={(e) => setDialect(e.target.value)}>
              <option value="postgresql">Postgres</option>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
            </select>
            <textarea
              placeholder="Paste CREATE TABLE statements..."
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
            />
            <button onClick={() => run(() => ingestDDL(ddl, dialect))} disabled={!ddl || loading}>
              Analyze DDL
            </button>
          </div>

          <div className="card">
            <h3>DB Connection</h3>
            <select value={dbType} onChange={(e) => setDbType(e.target.value)}>
              <option value="postgres">Postgres</option>
              <option value="supabase">Supabase (Postgres)</option>
              <option value="mysql">MySQL</option>
            </select>
            <input
              type="text"
              placeholder="Connection string"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
            />
            <button onClick={() => run(() => ingestDB(dbType, connectionString))} disabled={!connectionString || loading}>
              Analyze DB
            </button>
          </div>

          <div className="card">
            <h3>SQLite File</h3>
            <input
              type="file"
              accept=".db,.sqlite"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                run(() => ingestSQLite(file));
              }}
            />
          </div>
        </div>

        {loading && <p className="muted">Analyzing…</p>}
        {error && <p className="error">{error}</p>}
      </section>

      {snapshot && (
        <section className="panel">
          <h2>2) Relationship Graph</h2>
          <GraphView tables={snapshot.tables} relationships={snapshot.relationships} />
        </section>
      )}

      {snapshot && (
        <section className="panel">
          <h2>3) Details</h2>
          <div className="grid">
            {snapshot.tables.map((t) => (
              <div className="card" key={t.name}>
                <h3>{t.name}</h3>
                <ul>
                  {t.columns.map((c) => (
                    <li key={c.name}>
                      <strong>{c.name}</strong> <span className="muted">({c.dataType})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer>
        <p className="muted">Gemini suggestions are labeled in purple; heuristic links are blue.</p>
      </footer>
    </div>
  );
}
