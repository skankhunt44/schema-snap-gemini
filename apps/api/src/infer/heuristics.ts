import { Relationship, SchemaSnapshot, TableSchema } from '../types/schema';
import { nameSimilarity, normalizeName } from '../utils/similarity';

const isLikelyPk = (table: TableSchema, column: string) => {
  const col = table.columns.find(c => c.name === column);
  if (!col) return false;
  const base = normalizeName(table.name);
  const name = column.toLowerCase();
  const nameMatches = name === 'id' || name === `${base}_id` || name === `${base}id`;
  const unique = (col.uniqueRatio ?? 0) >= 0.9;
  return nameMatches || unique;
};

const overlapScore = (a?: Array<string | number | boolean>, b?: Array<string | number | boolean>) => {
  if (!a?.length || !b?.length) return 0;
  const sa = new Set(a.map(String));
  const sb = new Set(b.map(String));
  let overlap = 0;
  sa.forEach(v => { if (sb.has(v)) overlap++; });
  const denom = Math.min(sa.size, sb.size) || 1;
  return overlap / denom;
};

const typeScore = (a: string, b: string) => {
  if (a === b) return 1;
  const numeric = ['number', 'currency'];
  if (numeric.includes(a) && numeric.includes(b)) return 0.8;
  if (a === 'uuid' && b === 'string') return 0.5;
  if (b === 'uuid' && a === 'string') return 0.5;
  return 0.2;
};

export const inferRelationshipsHeuristic = (tables: TableSchema[]): Relationship[] => {
  const relationships: Relationship[] = [];

  for (const source of tables) {
    for (const target of tables) {
      if (source.name === target.name) continue;

      for (const sourceCol of source.columns) {
        for (const targetCol of target.columns) {
          const nameScore = nameSimilarity(sourceCol.name, targetCol.name);
          if (nameScore < 0.6) continue;

          const tScore = typeScore(sourceCol.dataType, targetCol.dataType);
          const overlap = overlapScore(sourceCol.sampleValues, targetCol.sampleValues);
          const uniqueness = Math.max(sourceCol.uniqueRatio ?? 0, targetCol.uniqueRatio ?? 0);

          const confidence = Math.min(1, nameScore * 0.5 + tScore * 0.2 + overlap * 0.1 + uniqueness * 0.2);
          if (confidence < 0.55) continue;

          const relationship: Relationship = {
            from: { table: source.name, column: sourceCol.name },
            to: { table: target.name, column: targetCol.name },
            type: isLikelyPk(target, targetCol.name) ? 'ONE_TO_MANY' : 'MANY_TO_MANY',
            confidence: Number(confidence.toFixed(2)),
            rationale: `Name similarity (${nameScore.toFixed(2)}), type compatibility (${tScore.toFixed(2)}), overlap (${overlap.toFixed(2)})`,
            evidence: {
              nameScore: Number(nameScore.toFixed(2)),
              typeScore: Number(tScore.toFixed(2)),
              overlapScore: Number(overlap.toFixed(2)),
              uniquenessScore: Number(uniqueness.toFixed(2))
            },
            suggestedBy: 'heuristic'
          };

          relationships.push(relationship);
        }
      }
    }
  }

  return relationships;
};

export const mergeRelationships = (base: Relationship[], extra: Relationship[]) => {
  const key = (r: Relationship) => `${r.from.table}.${r.from.column}->${r.to.table}.${r.to.column}`;
  const map = new Map(base.map(r => [key(r), r]));

  for (const r of extra) {
    const k = key(r);
    if (!map.has(k)) map.set(k, r);
  }

  return Array.from(map.values());
};
