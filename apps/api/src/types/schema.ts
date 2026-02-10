export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'currency' | 'unknown';

export type ColumnProfile = {
  name: string;
  dataType: DataType;
  nullRatio?: number; // 0..1
  uniqueRatio?: number; // 0..1
  sampleValues?: Array<string | number | boolean>;
};

export type TableSchema = {
  name: string;
  columns: ColumnProfile[];
  rowCount?: number;
  source?: string; // csv|ddl|db
  sampleRows?: Record<string, unknown>[];
  fileId?: string;
  fileName?: string;
};

export type Relationship = {
  from: { table: string; column: string };
  to: { table: string; column: string };
  type: 'ONE_TO_MANY' | 'ONE_TO_ONE' | 'MANY_TO_MANY';
  confidence: number; // 0..1
  rationale: string;
  evidence?: {
    nameScore?: number;
    typeScore?: number;
    uniquenessScore?: number;
    overlapScore?: number;
  };
  suggestedBy: 'heuristic' | 'gemini';
};

export type SchemaSnapshot = {
  tables: TableSchema[];
  relationships: Relationship[];
  warnings?: string[];
};
