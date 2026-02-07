import React from 'react';
import { ingestCsv, ingestDDL, ingestDB, ingestSQLite } from './lib/api';
import { Relationship, SchemaSnapshot, TemplateField } from './types';
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
  const [templateText, setTemplateText] = React.useState('');
  const [mappingSelections, setMappingSelections] = React.useState<Record<string, string | null>>({});

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

  const levenshtein = (a: string, b: string) => {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  };

  const nameSimilarity = (a: string, b: string) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return 0;
    const dist = levenshtein(na, nb);
    const maxLen = Math.max(na.length, nb.length) || 1;
    return 1 - dist / maxLen;
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

  const parseTemplateFields = (text: string): TemplateField[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        const [name, description] = line.split('|').map(part => part.trim());
        return {
          id: `${idx}-${name}`,
          name,
          description
        };
      });
  };

  const templateFields = React.useMemo(() => parseTemplateFields(templateText), [templateText]);
  const sourceFields = React.useMemo(() => {
    if (!snapshot) return [];
    return snapshot.tables.flatMap(table =>
      table.columns.map(col => ({
        id: `${table.name}.${col.name}`,
        table: table.name,
        column: col.name,
        dataType: col.dataType
      }))
    );
  }, [snapshot]);

  const suggestionMap = React.useMemo(() => {
    const map: Record<string, { sourceId: string | null; confidence: number; rationale: string }> = {};
    if (!snapshot) return map;

    templateFields.forEach(field => {
      let best: { sourceId: string | null; score: number } = { sourceId: null, score: 0 };
      sourceFields.forEach(source => {
        const score = nameSimilarity(field.name, source.column);
        if (score > best.score) best = { sourceId: source.id, score };
      });

      map[field.id] = {
        sourceId: best.score >= 0.35 ? best.sourceId : null,
        confidence: Number(best.score.toFixed(2)),
        rationale: best.sourceId ? `Name similarity ${best.score.toFixed(2)}` : 'No strong match'
      };
    });

    return map;
  }, [templateFields, sourceFields, snapshot]);

  React.useEffect(() => {
    if (!templateFields.length) {
      setMappingSelections({});
      return;
    }

    setMappingSelections(prev => {
      const next: Record<string, string | null> = {};
      templateFields.forEach(field => {
        next[field.id] = prev[field.id] ?? suggestionMap[field.id]?.sourceId ?? null;
      });
      return next;
    });
  }, [templateFields, suggestionMap]);

  const exportTemplateMappings = () => {
    if (!snapshot) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      templateFields: templateFields.map(field => ({
        name: field.name,
        description: field.description,
        sourceField: mappingSelections[field.id],
        confidence: suggestionMap[field.id]?.confidence ?? null,
        rationale: suggestionMap[field.id]?.rationale ?? null
      }))
    };
    downloadTextFile('template-mapping.json', JSON.stringify(payload, null, 2));
  };

  const loadSampleTemplate = () => {
    setTemplateText(
      [
        'Donor Name',
        'Donor Email',
        'Total Donations',
        'Donation Date',
        'Donation Amount',
        'Program Name'
      ].join('\n')
    );
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
          <h2>3) Template Mapping</h2>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <button onClick={loadSampleTemplate}>Load sample template</button>
              <button onClick={exportTemplateMappings} disabled={!templateFields.length}>
                Export Mapping JSON
              </button>
            </div>
            <textarea
              placeholder="One field per line. Optional: name | description"
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
            />
          </div>

          {templateFields.length > 0 && (
            <div className="grid">
              {templateFields.map(field => (
                <div className="card" key={field.id}>
                  <h3>{field.name}</h3>
                  {field.description && <p className="muted">{field.description}</p>}
                  <label className="muted">Mapped source</label>
                  <select
                    value={mappingSelections[field.id] ?? ''}
                    onChange={(e) =>
                      setMappingSelections(prev => ({
                        ...prev,
                        [field.id]: e.target.value || null
                      }))
                    }
                  >
                    <option value="">— Not mapped —</option>
                    {sourceFields.map(source => (
                      <option key={source.id} value={source.id}>
                        {source.table}.{source.column} ({source.dataType})
                      </option>
                    ))}
                  </select>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Suggested: {suggestionMap[field.id]?.sourceId ?? '—'} • Confidence {suggestionMap[field.id]?.confidence ?? 0}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {snapshot && (
        <section className="panel">
          <h2>4) Details</h2>
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
