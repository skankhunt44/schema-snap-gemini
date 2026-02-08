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

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

export const suggestMappingsGemini = async (
  sourceFields: SourceField[],
  templateFields: TemplateField[],
  apiKey: string
): Promise<MappingSuggestion[]> => {
  const prompt = `
You are an expert data integration specialist.
I have a list of Source Data Fields and a list of Template Requirement Fields.
Map each requirement field to the best matching source field based on name, description and type.

Source Fields:
${JSON.stringify(sourceFields.map(f => ({ id: f.id, name: f.name, desc: f.description, type: f.dataType })))}

Template Requirement Fields:
${JSON.stringify(templateFields.map(f => ({ id: f.id, name: f.name, desc: f.description })))}

Return a JSON array of mappings. If no suitable match is found, set sourceFieldId to null.
Provide a confidence score (0-1) and a short rationale.
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
            templateFieldId: { type: Type.STRING },
            sourceFieldId: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
            operation: { type: Type.STRING, nullable: true }
          },
          required: ['templateFieldId', 'confidence', 'rationale']
        }
      }
    }
  });

  const text = response.text || '';
  if (!text) return [];
  return JSON.parse(cleanJson(text)) as MappingSuggestion[];
};
