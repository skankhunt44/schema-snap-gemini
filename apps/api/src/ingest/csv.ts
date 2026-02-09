import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { inferColumnProfile } from '../utils/profile';
import { DataType, TableSchema } from '../types/schema';

const SAMPLE_LIMIT = 200;
const PREVIEW_LIMIT = 25;

const stripExt = (name: string) => name.replace(/\.(csv|xlsx|xls)$/i, '');
const isMissing = (value: unknown) => value === null || value === undefined || String(value).trim() === '';
const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const singularize = (value: string) => (value.endsWith('s') ? value.slice(0, -1) : value);
const tableBase = (name: string) => singularize(normalizeToken(name.split('_').slice(-1)[0] || name));
const isPrimaryKeyColumn = (tableName: string, columnName: string) => {
  const col = normalizeToken(columnName);
  const base = tableBase(tableName);
  return col === 'id' || col === `${base}id`;
};

const parseRows = (buffer: Buffer, filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    return { rows, source: 'excel' as const };
  }

  const text = buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false
  });

  if (parsed.errors?.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  return { rows: parsed.data || [], source: 'csv' as const };
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
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
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

const buildTable = (name: string, rows: Record<string, unknown>[], source: string): TableSchema => {
  const columns = Object.keys(rows[0] || {});
  const profiles = columns.map(col => {
    const values = rows.map(r => r[col]);
    return inferColumnProfile(col, values);
  });

  return {
    name,
    columns: profiles,
    rowCount: rows.length,
    source,
    sampleRows: rows.slice(0, PREVIEW_LIMIT)
  };
};

const applyAutoFix = (rows: Record<string, unknown>[], tableName: string) => {
  if (!rows.length) return rows;
  const columns = Object.keys(rows[0] || {});
  const profiles = columns.map(col => {
    const values = rows.map(r => r[col]);
    return inferColumnProfile(col, values);
  });

  const fillValues: Record<string, string | number> = {};
  profiles.forEach(profile => {
    const values = rows.map(r => r[profile.name]).filter(v => !isMissing(v));
    if (profile.dataType === 'number' || profile.dataType === 'currency') {
      const nums = values.map(v => Number(v)).filter(v => !Number.isNaN(v));
      fillValues[profile.name] = median(nums);
    } else if (profile.dataType === 'date') {
      const valid = values.map(v => String(v)).filter(v => !Number.isNaN(new Date(v).valueOf()));
      fillValues[profile.name] = mode(valid);
    } else if (profile.dataType === 'boolean') {
      const normalized = values.map(v => String(v).toLowerCase());
      fillValues[profile.name] = mode(normalized);
    } else {
      fillValues[profile.name] = mode(values.map(v => String(v)));
    }
  });

  const idColumns = profiles
    .filter(p => isPrimaryKeyColumn(tableName, p.name))
    .map(p => p.name);
  const seen = new Set<string>();

  const cleaned = rows.reduce<Record<string, unknown>[]>((acc, row) => {
    const next: Record<string, unknown> = { ...row };

    profiles.forEach(profile => {
      const value = row[profile.name];
      if (isMissing(value)) {
        next[profile.name] = fillValues[profile.name];
        return;
      }

      if (profile.dataType === 'number' || profile.dataType === 'currency') {
        const num = Number(value);
        next[profile.name] = Number.isNaN(num) ? fillValues[profile.name] : num;
        return;
      }

      if (profile.dataType === 'date') {
        const dateVal = new Date(String(value));
        next[profile.name] = Number.isNaN(dateVal.valueOf()) ? fillValues[profile.name] : value;
      }
    });

    if (idColumns.length) {
      const keyParts = idColumns.map(col => String(next[col] ?? '')).filter(Boolean);
      if (!keyParts.length) return acc;
      const key = keyParts.join('|');
      if (seen.has(key)) return acc;
      seen.add(key);
    }

    acc.push(next);
    return acc;
  }, []);

  return cleaned;
};

export const ingestCsvBuffer = (buffer: Buffer, filename: string): TableSchema => {
  const lower = filename.toLowerCase();
  const tableName = stripExt(filename);

  const { rows, source } = parseRows(buffer, filename);
  const sampleRows = rows.slice(0, SAMPLE_LIMIT);
  return buildTable(tableName, sampleRows, source);
};

export const ingestCsvBufferAutoFix = (buffer: Buffer, filename: string): TableSchema => {
  const tableName = stripExt(filename);
  const { rows, source } = parseRows(buffer, filename);
  const cleaned = applyAutoFix(rows, tableName);
  return buildTable(tableName, cleaned, source);
};
