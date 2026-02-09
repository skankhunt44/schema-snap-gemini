import { GoogleGenAI, Type } from '@google/genai';
import { SchemaSnapshot, TableSchema } from './types/schema';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

const isMissing = (value: unknown) => value === null || value === undefined || String(value).trim() === '';

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const singularize = (value: string) => (value.endsWith('s') ? value.slice(0, -1) : value);
const tableBase = (name: string) => singularize(normalizeToken(name.split('_').slice(-1)[0] || name));
const isPrimaryKeyColumn = (tableName: string, columnName: string) => {
  const col = normalizeToken(columnName);
  const base = tableBase(tableName);
  return col === 'id' || col === `${base}id`;
};

const quantile = (values: number[], q: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const getNumericValues = (table: TableSchema, columnName: string) => {
  if (!table.sampleRows?.length) return [];
  return table.sampleRows
    .map(row => Number(row[columnName]))
    .filter(value => !Number.isNaN(value));
};

export const explainSchemaGemini = async (snapshot: SchemaSnapshot, apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
You are a data architect. Summarize the schema and suggest 3 join paths.

Schema tables and columns:
${JSON.stringify(snapshot.tables.map(t => ({
    table: t.name,
    columns: t.columns.map(c => ({ name: c.name, type: c.dataType }))
  })))}

Relationships:
${JSON.stringify(snapshot.relationships.map(r => ({
    from: r.from,
    to: r.to,
    type: r.type,
    confidence: r.confidence
  })))}

Return JSON with:
- summary: short paragraph
- joinPaths: array of 3 items with title, path (list of table.column joins), rationale
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          joinPaths: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                path: { type: Type.ARRAY, items: { type: Type.STRING } },
                rationale: { type: Type.STRING }
              },
              required: ['title', 'path', 'rationale']
            }
          }
        },
        required: ['summary', 'joinPaths']
      }
    }
  });

  const text = response.text || '';
  if (!text) return { summary: '', joinPaths: [] };
  return JSON.parse(cleanJson(text));
};

export const generateTemplateGemini = async (snapshot: SchemaSnapshot, prompt: string, apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const context = snapshot.tables.map(t => ({ table: t.name, columns: t.columns.map(c => c.name) }));

  const content = `
You are a reporting analyst. Create a stakeholder report template based on the schema and user goal.
User goal: ${prompt}
Schema context:
${JSON.stringify(context)}

Return JSON with:
- name (template name)
- stakeholder (who it's for)
- frequency (e.g., Monthly)
- fields: array of { name, description, required, validationRule }
Validation rules can be simple (e.g., ">0", "not empty", "date")
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: content,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          stakeholder: { type: Type.STRING },
          frequency: { type: Type.STRING },
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                required: { type: Type.BOOLEAN },
                validationRule: { type: Type.STRING }
              },
              required: ['name']
            }
          }
        },
        required: ['name', 'stakeholder', 'frequency', 'fields']
      }
    }
  });

  const text = response.text || '';
  if (!text) return null;
  return JSON.parse(cleanJson(text));
};

export const suggestFixesGemini = async (table: TableSchema, apiKey: string) => {
  const missingColumns = table.columns.filter(c => (c.nullRatio ?? 0) >= 0.05);
  const duplicateIdColumns = table.columns.filter(
    c => isPrimaryKeyColumn(table.name, c.name) && (c.uniqueRatio ?? 1) < 0.9
  );
  const lowVarianceColumns = table.columns.filter(
    c => !isPrimaryKeyColumn(table.name, c.name) && (c.uniqueRatio ?? 1) > 0 && (c.uniqueRatio ?? 1) < 0.05
  );

  const outlierColumns = table.columns
    .filter(c => c.dataType === 'number' || c.dataType === 'currency')
    .map(c => {
      const values = getNumericValues(table, c.name);
      if (values.length < 8) return null;
      const q1 = quantile(values, 0.25);
      const q3 = quantile(values, 0.75);
      const iqr = q3 - q1;
      if (iqr === 0) return null;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      const outliers = values.filter(v => v < lower || v > upper);
      if (!outliers.length) return null;
      return {
        name: c.name,
        count: outliers.length,
        sample: outliers.slice(0, 5),
        lower,
        upper
      };
    })
    .filter(Boolean);

  const issueSummary = {
    missing: missingColumns.map(c => ({ name: c.name, nullRatio: c.nullRatio })),
    duplicates: duplicateIdColumns.map(c => ({ name: c.name, uniqueRatio: c.uniqueRatio })),
    lowVariance: lowVarianceColumns.map(c => ({ name: c.name, uniqueRatio: c.uniqueRatio })),
    outliers: outlierColumns
  };

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
You are a data quality analyst. Explain issues and propose fixes.
Table: ${table.name}
Issue summary:
${JSON.stringify(issueSummary)}
Sample rows (up to 25):
${JSON.stringify((table.sampleRows || []).slice(0, 25))}

Return JSON with:
- summary (short paragraph)
- suggestions: array of { issue, fix, rationale }
Focus on outliers and missing data fixes.
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                issue: { type: Type.STRING },
                fix: { type: Type.STRING },
                rationale: { type: Type.STRING }
              },
              required: ['issue', 'fix']
            }
          }
        },
        required: ['summary', 'suggestions']
      }
    }
  });

  const text = response.text || '';
  if (!text) return { summary: '', suggestions: [] };
  return JSON.parse(cleanJson(text));
};

export const generateReportNarrative = async (payload: {
  templateName: string;
  stakeholder: string;
  metrics: Array<{ label: string; value: string | number }>;
  dataQuality?: { missingRatio: number; totalRows: number };
  joinPaths?: Array<{ title: string; path: string[] }>;
  highlights?: string[];
}, apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
You are an executive reporting analyst. Write a concise executive summary and 3 highlights for the report.
Template: ${payload.templateName}
Stakeholder: ${payload.stakeholder}
Metrics: ${JSON.stringify(payload.metrics)}
Data quality: ${JSON.stringify(payload.dataQuality || {})}
Join paths: ${JSON.stringify(payload.joinPaths || [])}

Return JSON with:
- narrative: 3-5 sentences
- highlights: array of 3 bullet points
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          narrative: { type: Type.STRING },
          highlights: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['narrative', 'highlights']
      }
    }
  });

  const text = response.text || '';
  if (!text) return { narrative: '', highlights: [] };
  return JSON.parse(cleanJson(text));
};
