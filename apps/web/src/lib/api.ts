import { PersistedState, SchemaSnapshot } from '../types';

type SourceField = { id: string; name: string; description?: string; dataType?: string };

type TemplateField = { id: string; name: string; description?: string };

export const ingestCsv = async (files: File[]): Promise<SchemaSnapshot> => {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch('/api/ingest/csv', { method: 'POST', body: form });
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

  return res.json() as Promise<{ mappings: Array<{ templateFieldId: string; sourceFieldId: string | null; confidence: number; rationale: string }> }>;
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
