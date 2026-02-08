import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env if present
dotenv.config({ path: path.join(__dirname, '../../../.env') });
// Fallback to local .env
dotenv.config();
import { ingestCsvBuffer } from './ingest/csv';
import { ingestDDL } from './ingest/ddl';
import { ingestMySQL, ingestPostgres, ingestSQLite } from './ingest/db';
import { inferRelationships } from './infer';
import { suggestMappingsGemini } from './map/suggest';
import { loadSampleTables } from './samples';
import { SchemaSnapshot, TableSchema } from './types/schema';

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/ingest/csv', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No CSV files uploaded.' });

    const tables: TableSchema[] = files.map(file => ingestCsvBuffer(file.buffer, file.originalname));
    const relationships = await inferRelationships(tables, process.env.GEMINI_API_KEY);

    const snapshot: SchemaSnapshot = { tables, relationships };
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'CSV ingest failed' });
  }
});

app.post('/api/ingest/ddl', async (req, res) => {
  try {
    const { ddl, dialect } = req.body || {};
    if (!ddl) return res.status(400).json({ error: 'DDL is required' });
    const tables = ingestDDL(ddl, dialect || 'postgresql');
    const relationships = await inferRelationships(tables, process.env.GEMINI_API_KEY);
    const snapshot: SchemaSnapshot = { tables, relationships };
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'DDL ingest failed' });
  }
});

app.post('/api/ingest/db', async (req, res) => {
  try {
    const { dbType, connectionString } = req.body || {};
    if (!dbType || !connectionString) return res.status(400).json({ error: 'dbType + connectionString required' });

    let tables: TableSchema[] = [];
    if (dbType === 'postgres' || dbType === 'supabase') tables = await ingestPostgres(connectionString);
    if (dbType === 'mysql') tables = await ingestMySQL(connectionString);

    if (!tables.length) return res.status(400).json({ error: 'Unsupported dbType or no tables found' });

    const relationships = await inferRelationships(tables, process.env.GEMINI_API_KEY);
    const snapshot: SchemaSnapshot = { tables, relationships };
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'DB ingest failed' });
  }
});

app.post('/api/ingest/sqlite', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File;
    if (!file) return res.status(400).json({ error: 'SQLite file required' });

    const tmpPath = `/tmp/schema-snap-${Date.now()}.db`;
    await import('fs/promises').then(fs => fs.writeFile(tmpPath, file.buffer));

    const tables = await ingestSQLite(tmpPath);
    const relationships = await inferRelationships(tables, process.env.GEMINI_API_KEY);
    const snapshot: SchemaSnapshot = { tables, relationships };

    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'SQLite ingest failed' });
  }
});

app.post('/api/mappings/suggest', async (req, res) => {
  try {
    const { sourceFields, templateFields } = req.body || {};
    if (!sourceFields?.length || !templateFields?.length) {
      return res.status(400).json({ error: 'sourceFields and templateFields are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY not configured on server' });

    const mappings = await suggestMappingsGemini(sourceFields, templateFields, apiKey);
    res.json({ mappings });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI mapping failed' });
  }
});

app.get('/api/samples', async (_req, res) => {
  try {
    const tables = loadSampleTables();
    const relationships = await inferRelationships(tables, process.env.GEMINI_API_KEY);
    const snapshot: SchemaSnapshot = { tables, relationships };
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load samples' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Schema Snap API running on ${port}`);
});
