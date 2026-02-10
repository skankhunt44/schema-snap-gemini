import { PersistedState, SchemaSnapshot } from '../types';

type SourceField = { id: string; name: string; description?: string; dataType?: string };

type TemplateField = { id: string; name: string; description?: string };

export const ingestCsv = async (files: File[], options?: { autoFix?: boolean }): Promise<SchemaSnapshot> => {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const query = options?.autoFix ? '?autoFix=true' : '';
  const res = await fetch(`/api/ingest/csv${query}`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const ingestDDL = async (ddl: string, dialect: string): Promise<SchemaSnapshot> => {
  const res = await fetch('/api/ingest/ddl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ddl, dialect })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const ingestDB = async (dbType: string, connectionString: string): Promise<SchemaSnapshot> => {
  const res = await fetch('/api/ingest/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbType, connectionString })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const ingestSQLite = async (file: File): Promise<SchemaSnapshot> => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/ingest/sqlite', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fixCsvSource = async (fileId: string, fileName: string): Promise<SchemaSnapshot> => {
  const res = await fetch('/api/ingest/csv/fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, fileName })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const suggestMappings = async (sourceFields: SourceField[], templateFields: TemplateField[]) => {
  const res = await fetch('/api/mappings/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceFields, templateFields })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json() as Promise<{
    summary: string;
    mappings: Array<{ templateFieldId: string; sourceFieldId: string | null; confidence: number; rationale: string; operation?: string }>;
  }>;
};

export const explainSchema = async () => {
  const res = await fetch('/api/ai/schema-explain', { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ summary: string; joinPaths: Array<{ title: string; path: string[]; rationale: string }> }>;
};

export const generateTemplate = async (prompt: string) => {
  const res = await fetch('/api/ai/template-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    name: string;
    stakeholder: string;
    frequency: string;
    fields: Array<{ name: string; description?: string; required?: boolean; validationRule?: string }>;
  }>;
};

export const suggestFixes = async (tableName: string) => {
  const res = await fetch('/api/ai/fix-suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ summary: string; suggestions: Array<{ issue: string; fix: string; rationale?: string }> }>;
};

export const generateReportNarrative = async (payload: {
  templateName: string;
  stakeholder: string;
  metrics: Array<{ label: string; value: string | number }>;
  dataQuality?: { missingRatio: number; totalRows: number };
  joinPaths?: Array<{ title: string; path: string[] }>;
  highlights?: string[];
}) => {
  const res = await fetch('/api/ai/report-narrative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ narrative: string; highlights: string[] }>;
};

export const loadSampleSnapshot = async (): Promise<SchemaSnapshot> => {
  const res = await fetch('/api/samples');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getState = async (): Promise<PersistedState | null> => {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.state || null;
};

export const saveState = async (state: PersistedState) => {
  const res = await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw new Error(await res.text());
};
