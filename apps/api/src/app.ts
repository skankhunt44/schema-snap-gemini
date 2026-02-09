import express from 'express';
import cors from 'cors';
import multer from 'multer';

import { ingestCsvBuffer, ingestCsvBufferAutoFix } from './ingest/csv';
import { ingestDDL } from './ingest/ddl';
import { ingestMySQL, ingestPostgres, ingestSQLite } from './ingest/db';
import { inferRelationships } from './infer';
import { suggestMappingsGemini } from './map/suggest';
import { explainSchemaGemini, generateTemplateGemini, suggestFixesGemini } from './ai';
import { loadSampleTables } from './samples';
import { readState, writeState } from './store';
import { buildCombinedOutput, buildCombinedWorkbook } from './output';
import { SchemaSnapshot, TableSchema } from './types/schema';

export const createApp = () => {
  const app = express();
  const upload = multer();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/state', async (_req, res) => {
    try {
      const state = await readState();
      res.json({ state });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to read state' });
    }
  });

  app.post('/api/state', async (req, res) => {
    try {
      await writeState(req.body);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save state' });
    }
  });

  app.get('/api/output', async (req, res) => {
    try {
      const format = String(req.query.format || 'json').toLowerCase();
      const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : undefined;
      const state = await readState();
      if (!state) return res.status(400).json({ error: 'No saved state available.' });

      const payload = buildCombinedOutput(state, templateId);
      if (format === 'xlsx') {
        const buffer = buildCombinedWorkbook(payload);
        const templateName = payload.templates[0]?.templateName || 'combined-data';
        const filename = templateId ? `combined-data-${templateName}.xlsx` : 'combined-data.xlsx';
        res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/\s+/g, '_')}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        return;
      }

      res.json(payload);
    } catch (err: any) {
      const message = err.message || 'Failed to generate combined output';
      const status = message.toLowerCase().includes('template') || message.toLowerCase().includes('state') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ingest/csv', upload.array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) return res.status(400).json({ error: 'No CSV files uploaded.' });

      const autoFix = String(req.query.autoFix || '').toLowerCase() === 'true';
      const tables: TableSchema[] = files.map(file =>
        autoFix ? ingestCsvBufferAutoFix(file.buffer, file.originalname) : ingestCsvBuffer(file.buffer, file.originalname)
      );
      const relationships = await inferRelationships(tables, process.env.GEMINI_API_KEY);

      const snapshot: SchemaSnapshot = { tables, relationships };
      res.json({ ...snapshot, autoFixApplied: autoFix });
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

      const result = await suggestMappingsGemini(sourceFields, templateFields, apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'AI mapping failed' });
    }
  });

  app.post('/api/ai/schema-explain', async (_req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY not configured on server' });
      const state = await readState();
      if (!state?.snapshot) return res.status(400).json({ error: 'No saved snapshot available.' });

      const result = await explainSchemaGemini(state.snapshot, apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Schema explain failed' });
    }
  });

  app.post('/api/ai/template-generate', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY not configured on server' });
      const state = await readState();
      if (!state?.snapshot) return res.status(400).json({ error: 'No saved snapshot available.' });
      const prompt = String(req.body?.prompt || 'Create a donor impact report template');

      const result = await generateTemplateGemini(state.snapshot, prompt, apiKey);
      if (!result) return res.status(500).json({ error: 'Template generation failed' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Template generation failed' });
    }
  });

  app.post('/api/ai/fix-suggestions', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(400).json({ error: 'GEMINI_API_KEY not configured on server' });
      const tableName = String(req.body?.tableName || '');
      if (!tableName) return res.status(400).json({ error: 'tableName is required' });
      const state = await readState();
      if (!state?.snapshot) return res.status(400).json({ error: 'No saved snapshot available.' });
      const table = state.snapshot.tables.find((t: TableSchema) => t.name === tableName);
      if (!table) return res.status(400).json({ error: 'Table not found in snapshot' });

      const result = await suggestFixesGemini(table, apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Fix suggestions failed' });
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

  return app;
};
