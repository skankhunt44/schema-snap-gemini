import { SchemaSnapshot } from '../types';

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
