import { GoogleGenAI, Type } from '@google/genai';
import { Relationship, TableSchema } from '../types/schema';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

export const inferRelationshipsGemini = async (
  tables: TableSchema[],
  apiKey: string
): Promise<Relationship[]> => {
  if (!apiKey) return [];

  const summarized = tables.map(t => ({
    name: t.name,
    columns: t.columns.map(c => ({
      name: c.name,
      type: c.dataType,
      sampleValues: (c.sampleValues || []).slice(0, 3)
    }))
  }));

  const prompt = `
You are a data modeling expert. Given table schemas, infer likely relationships (PK/FK). 
Return the most likely links with confidence and a short rationale.

Tables:
${JSON.stringify(summarized, null, 2)}

Return JSON array with:
- from.table
- from.column
- to.table
- to.column
- type: ONE_TO_MANY | ONE_TO_ONE | MANY_TO_MANY
- confidence: 0..1
- rationale
`;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            from: {
              type: Type.OBJECT,
              properties: {
                table: { type: Type.STRING },
                column: { type: Type.STRING }
              },
              required: ['table', 'column']
            },
            to: {
              type: Type.OBJECT,
              properties: {
                table: { type: Type.STRING },
                column: { type: Type.STRING }
              },
              required: ['table', 'column']
            },
            type: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            rationale: { type: Type.STRING }
          },
          required: ['from', 'to', 'confidence', 'rationale']
        }
      }
    }
  });

  const text = response.text || '';
  if (!text) return [];
  const parsed = JSON.parse(cleanJson(text));

  return (parsed as any[]).map(r => ({
    ...r,
    suggestedBy: 'gemini'
  }));
};
