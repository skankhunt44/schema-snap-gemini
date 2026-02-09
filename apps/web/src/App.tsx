import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ingestCsv, ingestDDL, ingestDB, ingestSQLite, getState, loadSampleSnapshot, saveState, suggestMappings } from './lib/api';
import { DataSource, MappingEntry, Relationship, ReportEntry, SchemaSnapshot, Template, TemplateField, SourceField, TableSchema } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DataSources from './pages/DataSources';
import Templates from './pages/Templates';
import SmartMapper from './pages/SmartMapper';
import Relationships from './pages/Relationships';
import Analytics from './pages/Analytics';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';

export default function App() {
  const [snapshot, setSnapshot] = React.useState<SchemaSnapshot | null>(null);
  const [dataSources, setDataSources] = React.useState<DataSource[]>([]);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = React.useState<string | null>(null);
  const [mappingByTemplate, setMappingByTemplate] = React.useState<Record<string, Record<string, MappingEntry>>>({});
  const [reports, setReports] = React.useState<ReportEntry[]>([]);

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [selectedRel, setSelectedRel] = React.useState<Relationship | null>(null);
  const [aiSuggestionsByTemplate, setAiSuggestionsByTemplate] = React.useState<Record<string, Record<string, { sourceId: string | null; confidence: number; rationale: string }>>>({});
  const [aiSummaryByTemplate, setAiSummaryByTemplate] = React.useState<Record<string, string>>({});

  const [hydrated, setHydrated] = React.useState(false);

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

  const mergeSnapshots = (current: SchemaSnapshot | null, incoming: SchemaSnapshot): SchemaSnapshot => {
    if (!current) return incoming;

    const tableMap = new Map(current.tables.map(table => [table.name, table]));
    incoming.tables.forEach(table => tableMap.set(table.name, table));
    const tables = Array.from(tableMap.values());

    const relKey = (rel: Relationship) =>
      `${rel.from.table}.${rel.from.column}->${rel.to.table}.${rel.to.column}:${rel.type}`;
    const relMap = new Map(current.relationships.map(rel => [relKey(rel), rel]));
    incoming.relationships.forEach(rel => {
      const key = relKey(rel);
      const existing = relMap.get(key);
      if (!existing || (existing.confidence ?? 0) < (rel.confidence ?? 0)) {
        relMap.set(key, rel);
      }
    });

    return { tables, relationships: Array.from(relMap.values()) };
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

  const isMissing = (value: unknown) => value === null || value === undefined || String(value).trim() === '';
  const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const singularize = (value: string) => (value.endsWith('s') ? value.slice(0, -1) : value);
  const tableBase = (name: string) => singularize(normalizeToken(name.split('_').slice(-1)[0] || name));
  const isPrimaryKeyColumn = (tableName: string, columnName: string) => {
    const col = normalizeToken(columnName);
    const base = tableBase(tableName);
    return col === 'id' || col === `${base}id`;
  };

  const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const mode = (values: string[]) => {
    if (!values.length) return '';
    const counts = new Map<string, number>();
    values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
    let best = values[0];
    let bestCount = 0;
    counts.forEach((count, value) => {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    });
    return best;
  };

  const computeColumnStats = (name: string, dataType: string, rows: Record<string, unknown>[]) => {
    const values = rows.map(row => row[name]);
    const cleaned = values.map(value => (value === null || value === undefined ? '' : String(value).trim())).filter(Boolean);
    const total = values.length || 1;
    const nullRatio = (values.length - cleaned.length) / total;
    const unique = new Set(cleaned);
    const uniqueRatio = cleaned.length ? unique.size / cleaned.length : 0;
    const sampleValues = Array.from(unique)
      .slice(0, 5)
      .map(value => (dataType === 'number' || dataType === 'currency' ? Number(value) : value));

    return { nullRatio, uniqueRatio, sampleValues };
  };

  const applyAutoFixToTable = (table: TableSchema): TableSchema => {
    if (!table.sampleRows?.length) return table;
    const rows = table.sampleRows;
    const fillValues: Record<string, string | number> = {};

    table.columns.forEach(column => {
      const values = rows.map(row => row[column.name]).filter(value => !isMissing(value));
      if (column.dataType === 'number' || column.dataType === 'currency') {
        const numeric = values.map(value => Number(value)).filter(value => !Number.isNaN(value));
        fillValues[column.name] = median(numeric);
      } else if (column.dataType === 'date') {
        const valid = values.map(value => String(value)).filter(value => !Number.isNaN(new Date(value).valueOf()));
        fillValues[column.name] = mode(valid);
      } else if (column.dataType === 'boolean') {
        const normalized = values.map(value => String(value).toLowerCase());
        fillValues[column.name] = mode(normalized);
      } else {
        fillValues[column.name] = mode(values.map(value => String(value)));
      }
    });

    const idColumns = table.columns
      .filter(column => isPrimaryKeyColumn(table.name, column.name))
      .map(column => column.name);
    const seen = new Set<string>();

    const cleanedRows = rows.reduce<Record<string, unknown>[]>((acc, row) => {
      const next: Record<string, unknown> = { ...row };
      table.columns.forEach(column => {
        const value = row[column.name];
        if (isMissing(value)) {
          next[column.name] = fillValues[column.name];
          return;
        }

        if (column.dataType === 'number' || column.dataType === 'currency') {
          const num = Number(value);
          next[column.name] = Number.isNaN(num) ? fillValues[column.name] : num;
          return;
        }

        if (column.dataType === 'date') {
          const dateVal = new Date(String(value));
          next[column.name] = Number.isNaN(dateVal.valueOf()) ? fillValues[column.name] : value;
        }
      });

      if (idColumns.length) {
        const keyParts = idColumns.map(column => String(next[column] ?? '')).filter(Boolean);
        if (!keyParts.length) return acc;
        const key = keyParts.join('|');
        if (seen.has(key)) return acc;
        seen.add(key);
      }

      acc.push(next);
      return acc;
    }, []);

    const updatedColumns = table.columns.map(column => ({
      ...column,
      ...computeColumnStats(column.name, column.dataType, cleanedRows)
    }));

    return {
      ...table,
      columns: updatedColumns,
      sampleRows: cleanedRows,
      rowCount: cleanedRows.length
    };
  };

  const applyAutoFixToSnapshot = (tableName: string) => {
    if (!snapshot) return;
    const tables = snapshot.tables.map(table => {
      if (table.name !== tableName) return table;
      return applyAutoFixToTable(table);
    });
    setSnapshot({ ...snapshot, tables });
  };

  const buildSourceFields = (data: SchemaSnapshot, sourceId?: string, sourceName?: string): SourceField[] => {
    return data.tables.flatMap(table =>
      table.columns.map(col => ({
        id: `${table.name}.${col.name}`,
        table: table.name,
        column: col.name,
        dataType: col.dataType,
        sourceId,
        sourceName
      }))
    );
  };

  const sourceFields = React.useMemo(() => {
    const fromSources = dataSources.flatMap(ds => ds.fields || []);
    if (fromSources.length) return fromSources;
    return snapshot ? buildSourceFields(snapshot) : [];
  }, [snapshot, dataSources]);

  React.useEffect(() => {
    if (!snapshot || !dataSources.length) return;
    const needsPatch = dataSources.some(ds => !ds.fields || ds.fields.length === 0);
    if (!needsPatch) return;

    const tableLookup = new Map(snapshot.tables.map(table => [normalize(table.name), table]));
    const patchedSources = dataSources.map(ds => {
      if (ds.fields?.length) return ds;
      const matchedTable = tableLookup.get(normalize(ds.name));
      if (matchedTable) {
        return {
          ...ds,
          fields: buildSourceFields({ tables: [matchedTable], relationships: [] }, ds.id, ds.name)
        };
      }
      return {
        ...ds,
        fields: buildSourceFields(snapshot, ds.id, ds.name)
      };
    });

    setDataSources(patchedSources);
  }, [snapshot, dataSources]);

  const heuristicSuggestionMap = React.useMemo(() => {
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

  const mappingEntries = activeTemplateId ? mappingByTemplate[activeTemplateId] || {} : {};
  const mappingSelections = Object.fromEntries(
    Object.entries(mappingEntries).map(([key, value]) => [key, value.sourceFieldId ?? null])
  ) as Record<string, string | null>;
  const mappingOperations = Object.fromEntries(
    Object.entries(mappingEntries).map(([key, value]) => [key, value.operation || 'DIRECT'])
  ) as Record<string, string>;

  const suggestionMap = activeTemplateId && aiSuggestionsByTemplate[activeTemplateId]
    ? aiSuggestionsByTemplate[activeTemplateId]
    : heuristicSuggestionMap;

  React.useEffect(() => {
    if (!activeTemplateId) return;
    setMappingByTemplate(prev => {
      const current = prev[activeTemplateId] || {};
      const next: Record<string, MappingEntry> = { ...current };
      templateFields.forEach(field => {
        if (next[field.id] === undefined) {
          next[field.id] = {
            sourceFieldId: suggestionMap[field.id]?.sourceId ?? null,
            operation: 'DIRECT',
            confidence: suggestionMap[field.id]?.confidence,
            rationale: suggestionMap[field.id]?.rationale
          };
        }
      });
      return { ...prev, [activeTemplateId]: next };
    });
  }, [activeTemplateId, templateFields, suggestionMap]);

  const applySuggestions = async (sources = sourceFields) => {
    if (!activeTemplateId) return;
    if (!sources.length) {
      setAiError('Select at least one data source before running Auto-Map.');
      return;
    }
    setAiLoading(true);
    setAiError(null);

    try {
      const payloadSourceFields = sources.map(field => ({
        id: field.id,
        name: field.column,
        description: field.table,
        dataType: field.dataType
      }));
      const payloadTemplateFields = templateFields.map(field => ({
        id: field.id,
        name: field.name,
        description: field.description
      }));

      const result = await suggestMappings(payloadSourceFields, payloadTemplateFields);
      const map: Record<string, { sourceId: string | null; confidence: number; rationale: string; operation?: string }> = {};
      result.mappings.forEach(mapping => {
        map[mapping.templateFieldId] = {
          sourceId: mapping.sourceFieldId ?? null,
          confidence: mapping.confidence ?? 0,
          rationale: mapping.rationale || '',
          operation: mapping.operation
        };
      });

      setAiSuggestionsByTemplate(prev => ({ ...prev, [activeTemplateId]: map }));
      setAiSummaryByTemplate(prev => ({ ...prev, [activeTemplateId]: result.summary || '' }));
      setMappingByTemplate(prev => {
        const next: Record<string, MappingEntry> = {};
        templateFields.forEach(field => {
          next[field.id] = {
            sourceFieldId: map[field.id]?.sourceId ?? null,
            operation: map[field.id]?.operation ?? 'DIRECT',
            confidence: map[field.id]?.confidence ?? 0,
            rationale: map[field.id]?.rationale ?? ''
          };
        });
        return { ...prev, [activeTemplateId]: next };
      });
    } catch (err: any) {
      setAiError(err.message || 'AI mapping failed');
    } finally {
      setAiLoading(false);
    }
  };

  const exportTemplateMappings = () => {
    if (!snapshot || !activeTemplate) return;
    const payload = buildTemplateMappingPayload(activeTemplate.id);
    if (!payload) return;
    downloadTextFile('template-mapping.json', JSON.stringify(payload, null, 2));
  };

  const buildTemplateMappingPayload = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return null;
    const mapping = mappingByTemplate[templateId] || {};

    return {
      generatedAt: new Date().toISOString(),
      template: {
        id: template.id,
        name: template.name,
        stakeholder: template.stakeholder
      },
      templateFields: template.fields.map(field => ({
        name: field.name,
        description: field.description,
        required: field.required ?? true,
        validationRule: field.validationRule ?? '',
        sourceField: mapping[field.id]?.sourceFieldId ?? null,
        confidence: mapping[field.id]?.confidence ?? null,
        rationale: mapping[field.id]?.rationale ?? null,
        operation: mapping[field.id]?.operation || 'DIRECT'
      }))
    };
  };

  const downloadSnapshot = () => {
    if (!snapshot) return;
    downloadTextFile('schema-snap.json', JSON.stringify(snapshot, null, 2));
  };

  const downloadTemplates = () => {
    downloadTextFile('templates.json', JSON.stringify(templates, null, 2));
  };

  const downloadMappings = () => {
    downloadTextFile('mappings.json', JSON.stringify(mappingByTemplate, null, 2));
  };

  const downloadJoinPlan = () => {
    if (!snapshot) return;
    downloadTextFile('join-plan.sql', buildJoinPlan(snapshot));
  };

  const addTemplate = (template: Template) => {
    setTemplates(prev => {
      const next = [...prev, template];
      if (!activeTemplateId) setActiveTemplateId(template.id);
      return next;
    });
  };

  const loadSampleData = async () => {
    const data = await loadSampleSnapshot();
    setSnapshot(data);
    setSelectedRel(null);

    const sourceGroups = new Map<string, TableSchema[]>();
    data.tables.forEach(table => {
      const key = table.source || 'sample';
      if (!sourceGroups.has(key)) sourceGroups.set(key, []);
      sourceGroups.get(key)!.push(table);
    });

    const sourceMeta: Record<string, { name: string; type: string }> = {
      crm_csv: { name: 'Donor CRM (CSV)', type: 'CSV' },
      ledger_excel: { name: 'Donation Ledger (Excel)', type: 'Excel' },
      ops_db: { name: 'Program Ops DB (Postgres)', type: 'Postgres' },
      sample: { name: 'Sample Source', type: 'CSV' }
    };

    const sampleSources: DataSource[] = Array.from(sourceGroups.entries()).map(([key, tables], index) => {
      const meta = sourceMeta[key] || { name: key, type: 'CSV' };
      const id = `sample-${key}-${index}`;
      const columnCount = tables.reduce((acc, table) => acc + table.columns.length, 0);
      return {
        id,
        name: meta.name,
        type: meta.type,
        status: 'connected',
        tableCount: tables.length,
        columnCount,
        lastSync: new Date().toLocaleString(),
        fields: buildSourceFields({ tables, relationships: [] }, id, meta.name)
      };
    });
    setDataSources(sampleSources);

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 14);

    const sampleTemplate: Template = {
      id: 'tpl_sample',
      name: 'Donor Impact Summary',
      stakeholder: 'Board & Major Donors',
      frequency: 'Monthly',
      nextDueDate: nextDue.toISOString().split('T')[0],
      reminderDays: [7, 3, 1],
      fields: [
        { id: 'tf_donor_name', name: 'Donor Name', description: 'Primary donor name', required: true },
        { id: 'tf_donor_email', name: 'Donor Email', description: 'Primary email', required: true },
        { id: 'tf_donor_country', name: 'Donor Country', description: 'Country of residence', required: false },
        { id: 'tf_donation_count', name: 'Donations Count', description: 'Total number of donations', required: false },
        { id: 'tf_total_donations', name: 'Total Donations', description: 'Total donation amount', required: false },
        { id: 'tf_avg_donation', name: 'Average Donation', description: 'Average donation amount', required: false },
        { id: 'tf_last_donation', name: 'Last Donation Date', description: 'Most recent donation date', required: false },
        { id: 'tf_program_name', name: 'Program Name', description: 'Program funded', required: true },
        { id: 'tf_program_location', name: 'Program Location', description: 'Location of program', required: false },
        { id: 'tf_program_budget', name: 'Allocated Program Budget', description: 'Budget allocated for program', required: false },
        { id: 'tf_campaigns_active', name: 'Active Campaigns', description: 'Number of active campaigns', required: false }
      ]
    };

    setTemplates([sampleTemplate]);
    setActiveTemplateId(sampleTemplate.id);
    setMappingByTemplate({});
    setReports([]);
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
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
    return Object.values(mapping).filter(entry => entry?.sourceFieldId).length;
  };

  const templateCoverage = templates.map(template => {
    const mapped = mappedCountForTemplate(template.id);
    const total = template.fields.length || 0;
    const percent = total ? Math.round((mapped / total) * 100) : 0;
    return { id: template.id, name: template.name, mapped, total, percent };
  });

  const validationIssues = templates.filter(template =>
    template.fields.some(field => (field.required ?? true) && !mappingByTemplate[template.id]?.[field.id]?.sourceFieldId)
  ).length;

  const createReportEntry = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return null;
    const report: ReportEntry = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      templateId: template.id,
      templateName: template.name,
      stakeholder: template.stakeholder,
      dateGenerated: new Date().toLocaleDateString(),
      status: 'Draft'
    };
    setReports(prev => [report, ...prev]);
    return report;
  };

  const publishReport = (reportId: string) => {
    setReports(prev =>
      prev.map(report => (report.id === reportId ? { ...report, status: 'Published' } : report))
    );
  };

  const generateAndDownload = (templateId: string) => {
    const mappingCount = mappedCountForTemplate(templateId);
    if (!mappingCount) return;
    createReportEntry(templateId);
    const url = `/api/output?format=xlsx&templateId=${encodeURIComponent(templateId)}`;
    window.location.href = url;
  };

  const buildDataSourceEntry = (name: string, type: string, data: SchemaSnapshot): DataSource => {
    const tableCount = data.tables.length;
    const columnCount = data.tables.reduce((acc, t) => acc + t.columns.length, 0);
    const id = `${type}-${Date.now()}`;
    return {
      id,
      name,
      type,
      status: 'connected',
      tableCount,
      columnCount,
      lastSync: new Date().toLocaleString(),
      fields: buildSourceFields(data, id, name)
    };
  };

  const handleIngest = async (type: string, name: string, action: () => Promise<SchemaSnapshot>) => {
    try {
      setError(null);
      setLoading(true);
      const data = await action();
      setSnapshot(prev => mergeSnapshots(prev, data));
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
    (acc, mapping) => acc + Object.values(mapping).filter(entry => entry?.sourceFieldId).length,
    0
  );

  React.useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveState({
        snapshot,
        dataSources,
        templates,
        activeTemplateId,
        mappingByTemplate,
        reports
      }).catch(() => undefined);
    }, 500);

    return () => clearTimeout(timer);
  }, [hydrated, snapshot, dataSources, templates, activeTemplateId, mappingByTemplate, reports]);

  React.useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const interval = setInterval(() => {
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const store = JSON.parse(localStorage.getItem('schemaSnapNotified') || '{}');

      templates.forEach(template => {
        if (!template.nextDueDate) return;
        const due = new Date(template.nextDueDate);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const reminders = template.reminderDays || [];

        if (reminders.includes(diffDays)) {
          const key = `${template.id}:${diffDays}`;
          if (store[key] === todayKey) return;
          new Notification(`Reminder: ${template.name} due in ${diffDays} day${diffDays > 1 ? 's' : ''}`, {
            body: `Stakeholder: ${template.stakeholder}`
          });
          store[key] = todayKey;
        }
      });

      localStorage.setItem('schemaSnapNotified', JSON.stringify(store));
    }, 60000);

    return () => clearInterval(interval);
  }, [templates]);

  React.useEffect(() => {
    const init = async () => {
      try {
        const state = await getState();
        if (state) {
          setSnapshot(state.snapshot);
          const incomingSources = state.dataSources || [];
          const tableLookup = new Map(
            (state.snapshot?.tables || []).map(table => [normalize(table.name), table])
          );
          const patchedSources = incomingSources.map(ds => {
            if (ds.fields?.length) return ds;
            if (!state.snapshot) return ds;
            const matchedTable = tableLookup.get(normalize(ds.name));
            if (matchedTable) {
              return {
                ...ds,
                fields: buildSourceFields({ tables: [matchedTable], relationships: [] }, ds.id, ds.name)
              };
            }
            return { ...ds, fields: buildSourceFields(state.snapshot, ds.id, ds.name) };
          });
          setDataSources(patchedSources);
          setTemplates(state.templates || []);
          setActiveTemplateId(state.activeTemplateId || null);
          setReports(state.reports || []);
          const normalized: Record<string, Record<string, MappingEntry>> = {};
          Object.entries(state.mappingByTemplate || {}).forEach(([tplId, mapping]) => {
            const record: Record<string, MappingEntry> = {};
            Object.entries(mapping as any).forEach(([fieldId, value]) => {
              if (value && typeof value === 'object') {
                record[fieldId] = value as MappingEntry;
              } else {
                record[fieldId] = { sourceFieldId: value as string | null, operation: 'DIRECT' };
              }
            });
            normalized[tplId] = record;
          });
          setMappingByTemplate(normalized);
        } else {
          await loadSampleData();
        }
      } catch (e) {
        await loadSampleData();
      } finally {
        setHydrated(true);
      }
    };

    init();
  }, []);

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
                  templates={templates}
                  dataSources={dataSources}
                  templateCoverage={templateCoverage}
                  reports={reports}
                  validationIssues={validationIssues}
                  onLoadSample={loadSampleData}
                  onGenerateReport={generateAndDownload}
                  onPublishReport={publishReport}
                />
              }
            />
            <Route
              path="/connect"
              element={
                <DataSources
                  dataSources={dataSources}
                  snapshot={snapshot}
                  loading={loading}
                  error={error}
                  onCsvIngest={(name, files, autoFix) => handleIngest('CSV', name, () => ingestCsv(files, { autoFix }))}
                  onDDLIngest={(name, ddl, dialect) => handleIngest('DDL', name, () => ingestDDL(ddl, dialect))}
                  onDbIngest={(name, dbType, connectionString) => handleIngest(dbType, name, () => ingestDB(dbType, connectionString))}
                  onSQLiteIngest={(name, file) => handleIngest('SQLite', name, () => ingestSQLite(file))}
                  onRemoveSource={(id) => setDataSources(prev => prev.filter(ds => ds.id !== id))}
                  onApplyFix={applyAutoFixToSnapshot}
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
                  dataSources={dataSources}
                  sourceFields={sourceFields}
                  mappingSelections={mappingSelections}
                  mappingOperations={mappingOperations}
                  suggestionMap={suggestionMap}
                  aiLoading={aiLoading}
                  aiError={aiError}
                  aiSummary={activeTemplateId ? aiSummaryByTemplate[activeTemplateId] || null : null}
                  onMappingChange={(fieldId, sourceId) => {
                    if (!activeTemplateId) return;
                    setMappingByTemplate(prev => ({
                      ...prev,
                      [activeTemplateId]: {
                        ...prev[activeTemplateId],
                        [fieldId]: {
                          ...(prev[activeTemplateId]?.[fieldId] || { operation: 'DIRECT' }),
                          sourceFieldId: sourceId
                        }
                      }
                    }));
                  }}
                  onOperationChange={(fieldId, operation) => {
                    if (!activeTemplateId) return;
                    setMappingByTemplate(prev => ({
                      ...prev,
                      [activeTemplateId]: {
                        ...prev[activeTemplateId],
                        [fieldId]: {
                          ...(prev[activeTemplateId]?.[fieldId] || { sourceFieldId: null }),
                          operation
                        }
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
                  template={activeTemplate}
                  mappings={mappingEntries}
                  sourceFields={sourceFields}
                  onExportJson={() =>
                    snapshot && downloadTextFile('schema-snap.json', JSON.stringify(snapshot, null, 2))
                  }
                  onExportSql={() => snapshot && downloadTextFile('join-plan.sql', buildJoinPlan(snapshot))}
                />
              }
            />
            <Route
              path="/schedule"
              element={<Schedule templates={templates} onRequestNotifications={requestNotifications} />}
            />
            <Route
              path="/analytics"
              element={
                <Analytics
                  dataSources={dataSources}
                  templates={templates}
                  snapshot={snapshot}
                  totalMapped={totalMapped}
                  templateCoverage={templateCoverage}
                  activeTemplateId={activeTemplateId}
                  onSelectTemplate={setActiveTemplateId}
                  onDownloadSnapshot={downloadSnapshot}
                  onDownloadTemplates={downloadTemplates}
                  onDownloadMappings={downloadMappings}
                  onDownloadJoinPlan={downloadJoinPlan}
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
