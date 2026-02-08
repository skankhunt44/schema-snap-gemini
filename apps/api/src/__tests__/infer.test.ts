import { describe, it, expect } from 'vitest';
import { inferRelationshipsHeuristic, mergeRelationships } from '../infer/heuristics';
import type { TableSchema } from '../types/schema';

const makeTables = (): TableSchema[] => [
  {
    name: 'donors',
    columns: [
      { name: 'donor_id', dataType: 'uuid', uniqueRatio: 1, sampleValues: ['a', 'b'] },
      { name: 'donor_name', dataType: 'string', sampleValues: ['Alice'] }
    ]
  },
  {
    name: 'donations',
    columns: [
      { name: 'donation_id', dataType: 'uuid', uniqueRatio: 1, sampleValues: ['d1'] },
      { name: 'donor_id', dataType: 'uuid', sampleValues: ['a', 'b'] },
      { name: 'amount', dataType: 'number', sampleValues: [10, 20] }
    ]
  }
];

describe('inferRelationshipsHeuristic', () => {
  it('finds a relationship for matching id columns', () => {
    const relationships = inferRelationshipsHeuristic(makeTables());
    const hasDonorRel = relationships.some(r =>
      r.from.table === 'donations' && r.from.column === 'donor_id' && r.to.table === 'donors'
    );
    expect(hasDonorRel).toBe(true);
  });
});

describe('mergeRelationships', () => {
  it('dedupes relationships by from/to columns', () => {
    const rels = inferRelationshipsHeuristic(makeTables());
    const merged = mergeRelationships(rels, rels);
    expect(merged.length).toBe(rels.length);
  });
});
