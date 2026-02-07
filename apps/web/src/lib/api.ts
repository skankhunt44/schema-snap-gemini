import { SchemaSnapshot } from '../types';

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
