import React from 'react';
import { ingestCsv, ingestDDL, ingestDB, ingestSQLite } from './lib/api';
import { Relationship, SchemaSnapshot } from './types';
import GraphView from './components/GraphView';

export default function App() {
  const [snapshot, setSnapshot] = React.useState<SchemaSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [ddl, setDdl] = React.useState('');
  const [dialect, setDialect] = React.useState('postgresql');
  const [dbType, setDbType] = React.useState('postgres');
  const [connectionString, setConnectionString] = React.useState('');
  const [selectedRel, setSelectedRel] = React.useState<Relationship | null>(null);

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildJoinPlan = (snapshot: SchemaSnapshot) => {
    if (!snapshot.tables.length) return '-- No tables detected';
    const rels = [...snapshot.relationships].sort((a, b) => b.confidence - a.confidence);
    const used = new Set<string>();

    if (!rels.length) {
      return `SELECT *\nFROM ${snapshot.tables[0].name};`;
    }

    const first = rels[0];
    let sql = `SELECT *\nFROM ${first.from.table}\nLEFT JOIN ${first.to.table}\n  ON ${first.from.table}.${first.from.column} = ${first.to.table}.${first.to.column}`;
    used.add(first.from.table);
    used.add(first.to.table);

    for (const rel of rels.slice(1)) {
      const hasFrom = used.has(rel.from.table);
      const hasTo = used.has(rel.to.table);
      if (hasFrom && !hasTo) {
        sql += `\nLEFT JOIN ${rel.to.table}\n  ON ${rel.from.table}.${rel.from.column} = ${rel.to.table}.${rel.to.column}`;
        used.add(rel.to.table);
      } else if (hasTo && !hasFrom) {
        sql += `\nLEFT JOIN ${rel.from.table}\n  ON ${rel.to.table}.${rel.to.column} = ${rel.from.table}.${rel.from.column}`;
        used.add(rel.from.table);
      }
    }

    const unlinked = snapshot.tables.map(t => t.name).filter(t => !used.has(t));
    if (unlinked.length) {
      sql += `\n\n-- Unlinked tables: ${unlinked.join(', ')}`;
    }

    return sql + ';';
  };

  const run = async (fn: () => Promise<SchemaSnapshot>) => {
    try {
      setError(null);
      setLoading(true);
      const data = await fn();
      setSnapshot(data);
      setSelectedRel(null);
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
          <GraphView
            tables={snapshot.tables}
            relationships={snapshot.relationships}
            onEdgeSelect={setSelectedRel}
          />

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Selected relationship</h3>
            {selectedRel ? (
              <div>
                <p>
                  <strong>{selectedRel.from.table}.{selectedRel.from.column}</strong>
                  {' → '}
                  <strong>{selectedRel.to.table}.{selectedRel.to.column}</strong>
                </p>
                <p className="muted">Type: {selectedRel.type} • Confidence: {Math.round(selectedRel.confidence * 100)}% • {selectedRel.suggestedBy}</p>
                <p>{selectedRel.rationale}</p>
                {selectedRel.evidence && (
                  <ul>
                    {selectedRel.evidence.nameScore !== undefined && (
                      <li>Name similarity: {selectedRel.evidence.nameScore}</li>
                    )}
                    {selectedRel.evidence.typeScore !== undefined && (
                      <li>Type match: {selectedRel.evidence.typeScore}</li>
                    )}
                    {selectedRel.evidence.uniquenessScore !== undefined && (
                      <li>Uniqueness: {selectedRel.evidence.uniquenessScore}</li>
                    )}
                    {selectedRel.evidence.overlapScore !== undefined && (
                      <li>Value overlap: {selectedRel.evidence.overlapScore}</li>
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <p className="muted">Click an edge in the graph to view details.</p>
            )}
          </div>
        </section>
      )}

      {snapshot && (
        <section className="panel">
          <h2>3) Details</h2>
          <div className="grid" style={{ marginBottom: 16 }}>
            <button
              onClick={() => downloadTextFile('schema-snap.json', JSON.stringify(snapshot, null, 2))}
            >
              Export JSON
            </button>
            <button onClick={() => downloadTextFile('join-plan.sql', buildJoinPlan(snapshot))}>
              Export SQL Join Plan
            </button>
          </div>
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
