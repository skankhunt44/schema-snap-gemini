import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ingestCsv, ingestDDL, ingestDB, ingestSQLite } from './lib/api';
import { DataSource, Relationship, SchemaSnapshot, Template, TemplateField } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DataSources from './pages/DataSources';
import Templates from './pages/Templates';
import SmartMapper from './pages/SmartMapper';
import Relationships from './pages/Relationships';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

export default function App() {
  const [snapshot, setSnapshot] = React.useState<SchemaSnapshot | null>(null);
  const [dataSources, setDataSources] = React.useState<DataSource[]>([]);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = React.useState<string | null>(null);
  const [mappingByTemplate, setMappingByTemplate] = React.useState<Record<string, Record<string, string | null>>>({});

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selectedRel, setSelectedRel] = React.useState<Relationship | null>(null);

  const activeTemplate = templates.find(t => t.id === activeTemplateId) || null;
  const templateFields = activeTemplate?.fields ?? [];

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

  const buildJoinPlan = (data: SchemaSnapshot) => {
    if (!data.tables.length) return '-- No tables detected';
    const rels = [...data.relationships].sort((a, b) => b.confidence - a.confidence);
    const used = new Set<string>();

    if (!rels.length) {
      return `SELECT *\nFROM ${data.tables[0].name};`;
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

    const unlinked = data.tables.map(t => t.name).filter(t => !used.has(t));
    if (unlinked.length) {
      sql += `\n\n-- Unlinked tables: ${unlinked.join(', ')}`;
    }

    return sql + ';';
  };

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
    if (!snapshot || !templateFields.length) return map;

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

  const mappingSelections = activeTemplateId ? mappingByTemplate[activeTemplateId] || {} : {};

  React.useEffect(() => {
    if (!activeTemplateId) return;
    setMappingByTemplate(prev => {
      const current = prev[activeTemplateId] || {};
      const next: Record<string, string | null> = { ...current };
      templateFields.forEach(field => {
        if (next[field.id] === undefined) {
          next[field.id] = suggestionMap[field.id]?.sourceId ?? null;
        }
      });
      return { ...prev, [activeTemplateId]: next };
    });
  }, [activeTemplateId, templateFields, suggestionMap]);

  const applySuggestions = () => {
    if (!activeTemplateId) return;
    setMappingByTemplate(prev => {
      const next: Record<string, string | null> = { ...prev[activeTemplateId] };
      templateFields.forEach(field => {
        next[field.id] = suggestionMap[field.id]?.sourceId ?? null;
      });
      return { ...prev, [activeTemplateId]: next };
    });
  };

  const exportTemplateMappings = () => {
    if (!snapshot || !activeTemplate) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      template: {
        id: activeTemplate.id,
        name: activeTemplate.name,
        stakeholder: activeTemplate.stakeholder
      },
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

  const addTemplate = (template: Template) => {
    setTemplates(prev => {
      const next = [...prev, template];
      if (!activeTemplateId) setActiveTemplateId(template.id);
      return next;
    });
  };

  const updateTemplate = (templateId: string, update: Partial<Template>) => {
    setTemplates(prev => prev.map(t => (t.id === templateId ? { ...t, ...update } : t)));
  };

  const removeTemplate = (templateId: string) => {
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== templateId);
      if (activeTemplateId === templateId) setActiveTemplateId(next[0]?.id ?? null);
      return next;
    });
    setMappingByTemplate(prev => {
      const copy = { ...prev };
      delete copy[templateId];
      return copy;
    });
  };

  const mappedCountForTemplate = (templateId: string) => {
    const mapping = mappingByTemplate[templateId] || {};
    return Object.values(mapping).filter(Boolean).length;
  };

  const buildDataSourceEntry = (name: string, type: string, data: SchemaSnapshot): DataSource => {
    const tableCount = data.tables.length;
    const columnCount = data.tables.reduce((acc, t) => acc + t.columns.length, 0);
    return {
      id: `${type}-${Date.now()}`,
      name,
      type,
      status: 'connected',
      tableCount,
      columnCount,
      lastSync: new Date().toLocaleString()
    };
  };

  const handleIngest = async (type: string, name: string, action: () => Promise<SchemaSnapshot>) => {
    try {
      setError(null);
      setLoading(true);
      const data = await action();
      setSnapshot(data);
      setSelectedRel(null);
      setDataSources(prev => [buildDataSourceEntry(name, type, data), ...prev]);
      return true;
    } catch (e: any) {
      setError(e.message || 'Request failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const mappedCount = activeTemplateId ? mappedCountForTemplate(activeTemplateId) : 0;

  const totalMapped = Object.values(mappingByTemplate).reduce(
    (acc, mapping) => acc + Object.values(mapping).filter(Boolean).length,
    0
  );

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 md:ml-64 transition-all duration-300">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  snapshot={snapshot}
                  templates={templates}
                  dataSources={dataSources}
                  mappedCount={mappedCount}
                  totalMapped={totalMapped}
                />
              }
            />
            <Route
              path="/connect"
              element={
                <DataSources
                  dataSources={dataSources}
                  loading={loading}
                  error={error}
                  onCsvIngest={(name, files) => handleIngest('CSV', name, () => ingestCsv(files))}
                  onDDLIngest={(name, ddl, dialect) => handleIngest('DDL', name, () => ingestDDL(ddl, dialect))}
                  onDbIngest={(name, dbType, connectionString) => handleIngest(dbType, name, () => ingestDB(dbType, connectionString))}
                  onSQLiteIngest={(name, file) => handleIngest('SQLite', name, () => ingestSQLite(file))}
                  onRemoveSource={(id) => setDataSources(prev => prev.filter(ds => ds.id !== id))}
                />
              }
            />
            <Route
              path="/templates"
              element={
                <Templates
                  templates={templates}
                  activeTemplateId={activeTemplateId}
                  onSelectTemplate={setActiveTemplateId}
                  onCreateTemplate={addTemplate}
                  onUpdateTemplate={updateTemplate}
                  onDeleteTemplate={removeTemplate}
                  onExportMappings={exportTemplateMappings}
                  mappedCountForTemplate={mappedCountForTemplate}
                />
              }
            />
            <Route
              path="/map"
              element={
                <SmartMapper
                  templates={templates}
                  activeTemplateId={activeTemplateId}
                  onSelectTemplate={setActiveTemplateId}
                  templateFields={templateFields}
                  sourceFields={sourceFields}
                  mappingSelections={mappingSelections}
                  suggestionMap={suggestionMap}
                  onMappingChange={(fieldId, sourceId) => {
                    if (!activeTemplateId) return;
                    setMappingByTemplate(prev => ({
                      ...prev,
                      [activeTemplateId]: {
                        ...prev[activeTemplateId],
                        [fieldId]: sourceId
                      }
                    }));
                  }}
                  onApplySuggestions={applySuggestions}
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
            <Route
              path="/analytics"
              element={
                <Analytics
                  dataSources={dataSources}
                  templates={templates}
                  snapshot={snapshot}
                  totalMapped={totalMapped}
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
