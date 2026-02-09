import { Client } from 'pg';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import { TableSchema } from '../types/schema';
import { inferColumnProfile } from '../utils/profile';

const SAMPLE_LIMIT = 100;
const PREVIEW_LIMIT = 25;

const mapType = (sqlType: string) => {
  const t = sqlType.toLowerCase();
  if (t.includes('uuid')) return 'uuid';
  if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) return 'number';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('date') || t.includes('time')) return 'date';
  if (t.includes('char') || t.includes('text') || t.includes('json')) return 'string';
  return 'unknown';
};

export const ingestPostgres = async (connectionString: string): Promise<TableSchema[]> => {
  const client = new Client({ connectionString });
  await client.connect();

  const cols = await client.query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema='public'
     ORDER BY table_name, ordinal_position;`
  );

  const tables = new Map<string, string[]>();
  for (const row of cols.rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, []);
    tables.get(row.table_name)!.push(row.column_name);
  }

  const results: TableSchema[] = [];
  for (const [tableName, columnNames] of tables) {
    const sample = await client.query(`SELECT * FROM ${tableName} LIMIT ${SAMPLE_LIMIT}`);
    const rows = (sample.rows || []) as Record<string, any>[];
    const profiles = columnNames.map(col => {
      const values = rows.map((r: Record<string, any>) => r[col]);
      return inferColumnProfile(col, values);
    });

    results.push({
      name: tableName,
      columns: profiles,
      source: 'db',
      sampleRows: rows.slice(0, PREVIEW_LIMIT)
    });
  }

  await client.end();
  return results;
};

export const ingestMySQL = async (connectionString: string): Promise<TableSchema[]> => {
  const conn = await mysql.createConnection(connectionString);
  const [rows] = await conn.query(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
     ORDER BY table_name, ordinal_position;`
  );

  const tables = new Map<string, string[]>();
  (rows as any[]).forEach(row => {
    if (!tables.has(row.table_name)) tables.set(row.table_name, []);
    tables.get(row.table_name)!.push(row.column_name);
  });

  const results: TableSchema[] = [];
  for (const [tableName, columnNames] of tables) {
    const [sample] = await conn.query(`SELECT * FROM ${tableName} LIMIT ${SAMPLE_LIMIT}`);
    const sampleRows = sample as any[];
    const profiles = columnNames.map(col => {
      const values = sampleRows.map(r => r[col]);
      return inferColumnProfile(col, values);
    });
    results.push({
      name: tableName,
      columns: profiles,
      source: 'db',
      sampleRows: sampleRows.slice(0, PREVIEW_LIMIT)
    });
  }

  await conn.end();
  return results;
};

export const ingestSQLite = async (filePath: string): Promise<TableSchema[]> => {
  const db = new Database(filePath, { readonly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;

  const results: TableSchema[] = [];
  for (const t of tables) {
    const tableName = t.name;
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const sampleRows = db.prepare(`SELECT * FROM ${tableName} LIMIT ${SAMPLE_LIMIT}`).all();

    const profiles = columns.map((col: any) => {
      const values = sampleRows.map((r: any) => r[col.name]);
      return inferColumnProfile(col.name, values);
    });

    results.push({
      name: tableName,
      columns: profiles,
      source: 'db',
      sampleRows: sampleRows.slice(0, PREVIEW_LIMIT)
    });
  }

  db.close();
  return results;
};
