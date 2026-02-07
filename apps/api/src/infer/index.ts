import { Relationship, SchemaSnapshot, TableSchema } from '../types/schema';
import { inferRelationshipsGemini } from './gemini';
import { inferRelationshipsHeuristic, mergeRelationships } from './heuristics';

export const inferRelationships = async (
  tables: TableSchema[],
  geminiKey?: string
): Promise<Relationship[]> => {
  const heuristics = inferRelationshipsHeuristic(tables);
  const ai = geminiKey ? await inferRelationshipsGemini(tables, geminiKey) : [];
  return mergeRelationships(heuristics, ai);
};
