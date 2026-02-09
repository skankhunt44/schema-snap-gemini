import { GoogleGenAI, Type } from '@google/genai';

export type SourceField = {
  id: string;
  name: string;
  description?: string;
  dataType?: string;
};

export type TemplateField = {
  id: string;
  name: string;
  description?: string;
};

export type MappingSuggestion = {
  templateFieldId: string;
  sourceFieldId: string | null;
  confidence: number;
  rationale: string;
  operation?: string;
};

export type MappingSuggestionResponse = {
  summary: string;
  mappings: MappingSuggestion[];
};

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

export const suggestMappingsGemini = async (
  sourceFields: SourceField[],
  templateFields: TemplateField[],
  apiKey: string
): Promise<MappingSuggestionResponse> => {
  const prompt = `
You are an expert data integration specialist.
I have a list of Source Data Fields and a list of Template Requirement Fields.
Map each requirement field to the best matching source field based on name, description and type.

Source Fields:
${JSON.stringify(sourceFields.map(f => ({ id: f.id, name: f.name, desc: f.description, type: f.dataType })))}

Template Requirement Fields:
${JSON.stringify(templateFields.map(f => ({ id: f.id, name: f.name, desc: f.description })))}

Return JSON with:
- summary: short rationale about overall mapping quality
- mappings: array of mappings. If no suitable match is found, set sourceFieldId to null.
Provide a confidence score (0-1), a short rationale, and an operation.
Operation must be one of: DIRECT, COUNT, COUNT_DISTINCT, SUM, AVERAGE, FIRST, LAST.
If a field implies aggregation (e.g., count/total/average/last), set the appropriate operation and still choose the sourceFieldId for the column to aggregate.
`;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          mappings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                templateFieldId: { type: Type.STRING },
                sourceFieldId: { type: Type.STRING, nullable: true },
                confidence: { type: Type.NUMBER },
                rationale: { type: Type.STRING },
                operation: { type: Type.STRING, nullable: true }
              },
              required: ['templateFieldId', 'confidence', 'rationale', 'operation']
            }
          }
        },
        required: ['summary', 'mappings']
      }
    }
  });

  const text = response.text || '';
  if (!text) return { summary: '', mappings: [] };
  return JSON.parse(cleanJson(text)) as MappingSuggestionResponse;
};
