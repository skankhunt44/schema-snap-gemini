import Papa from 'papaparse';
import { inferColumnProfile } from '../utils/profile';
import { TableSchema } from '../types/schema';

const SAMPLE_LIMIT = 200;

export const ingestCsvBuffer = (buffer: Buffer, tableName: string): TableSchema => {
  const text = buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false
  });

  if (parsed.errors?.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const rows = (parsed.data || []).slice(0, SAMPLE_LIMIT);
  const columns = Object.keys(rows[0] || {});

  const profiles = columns.map(col => {
    const values = rows.map(r => r[col]);
    return inferColumnProfile(col, values);
  });

  return {
    name: tableName,
    columns: profiles,
    rowCount: (parsed.data || []).length,
    source: 'csv'
  };
};
