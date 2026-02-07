import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ingestCsv, ingestDDL, ingestDB, ingestSQLite } from './lib/api';
import { Relationship, SchemaSnapshot, TemplateField } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DataSources from './pages/DataSources';
import Templates from './pages/Templates';
import Relationships from './pages/Relationships';
import Settings from './pages/Settings';

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

  const mappedCount = Object.values(mappingSelections).filter(Boolean).length;

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 md:ml-64 transition-all duration-300">
          <Routes>
            <Route
              path="/"
              element={<Dashboard snapshot={snapshot} templateFields={templateFields} mappedCount={mappedCount} />}
            />
            <Route
              path="/connect"
              element={
                <DataSources
                  ddl={ddl}
                  dialect={dialect}
                  dbType={dbType}
                  connectionString={connectionString}
                  loading={loading}
                  error={error}
                  onDdlChange={setDdl}
                  onDialectChange={setDialect}
                  onDbTypeChange={setDbType}
                  onConnectionChange={setConnectionString}
                  onCsvUpload={(files) => run(() => ingestCsv(files))}
                  onDDLAnalyze={() => run(() => ingestDDL(ddl, dialect))}
                  onDbAnalyze={() => run(() => ingestDB(dbType, connectionString))}
                  onSQLiteUpload={(file) => run(() => ingestSQLite(file))}
                />
              }
            />
            <Route
              path="/templates"
              element={
                <Templates
                  templateText={templateText}
                  templateFields={templateFields}
                  sourceFields={sourceFields}
                  mappingSelections={mappingSelections}
                  suggestionMap={suggestionMap}
                  onTemplateChange={setTemplateText}
                  onMappingChange={(fieldId, sourceId) =>
                    setMappingSelections(prev => ({
                      ...prev,
                      [fieldId]: sourceId
                    }))
                  }
                  onExport={exportTemplateMappings}
                  onLoadSample={loadSampleTemplate}
                />
              }
            />
            <Route
              path="/map"
              element={
                <Templates
                  templateText={templateText}
                  templateFields={templateFields}
                  sourceFields={sourceFields}
                  mappingSelections={mappingSelections}
                  suggestionMap={suggestionMap}
                  onTemplateChange={setTemplateText}
                  onMappingChange={(fieldId, sourceId) =>
                    setMappingSelections(prev => ({
                      ...prev,
                      [fieldId]: sourceId
                    }))
                  }
                  onExport={exportTemplateMappings}
                  onLoadSample={loadSampleTemplate}
                />
              }
            />
            <Route
              path="/relationships"
              element={
                <Relationships
                  snapshot={snapshot}
                  selectedRel={selectedRel}
                  onSelectRel={setSelectedRel}
                  onExportJson={() =>
                    snapshot && downloadTextFile('schema-snap.json', JSON.stringify(snapshot, null, 2))
                  }
                  onExportSql={() => snapshot && downloadTextFile('join-plan.sql', buildJoinPlan(snapshot))}
                />
              }
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
