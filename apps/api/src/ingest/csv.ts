import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { inferColumnProfile } from '../utils/profile';
import { TableSchema } from '../types/schema';

const SAMPLE_LIMIT = 200;

const stripExt = (name: string) => name.replace(/\.(csv|xlsx|xls)$/i, '');

export const ingestCsvBuffer = (buffer: Buffer, filename: string): TableSchema => {
  const lower = filename.toLowerCase();
  const tableName = stripExt(filename);

  let rows: Record<string, unknown>[] = [];

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' }).slice(0, SAMPLE_LIMIT);
  } else {
    const text = buffer.toString('utf-8');
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    if (parsed.errors?.length) {
      throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
    }

    rows = (parsed.data || []).slice(0, SAMPLE_LIMIT);
  }

  const columns = Object.keys(rows[0] || {});
  const profiles = columns.map(col => {
    const values = rows.map(r => r[col]);
    return inferColumnProfile(col, values);
  });

  return {
    name: tableName,
    columns: profiles,
    rowCount: rows.length,
    source: lower.endsWith('.xlsx') || lower.endsWith('.xls') ? 'excel' : 'csv'
  };
};
