import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'state.db');
let db: Database.Database | null = null;

const getDb = () => {
  if (!db) {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(dbFile);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }
  return db;
};

export const readState = async (): Promise<any | null> => {
  const database = getDb();
  const row = database.prepare('SELECT state FROM app_state WHERE id = ?').get('default') as
    | { state: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.state);
  } catch {
    return null;
  }
};

export const writeState = async (state: any) => {
  const database = getDb();
  const payload = JSON.stringify(state);
  const now = new Date().toISOString();
  database
    .prepare(
      `
      INSERT INTO app_state (id, state, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state = excluded.state,
        updated_at = excluded.updated_at
      `
    )
    .run('default', payload, now);
};

export const clearState = async () => {
  const database = getDb();
  database.prepare('DELETE FROM app_state WHERE id = ?').run('default');
};
