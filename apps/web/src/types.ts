export type ColumnProfile = {
  name: string;
  dataType: string;
  nullRatio?: number;
  uniqueRatio?: number;
  sampleValues?: Array<string | number | boolean>;
};

export type TableSchema = {
  name: string;
  columns: ColumnProfile[];
  rowCount?: number;
  source?: string;
};

export type Relationship = {
  from: { table: string; column: string };
  to: { table: string; column: string };
  type: string;
  confidence: number;
  rationale: string;
  suggestedBy: 'heuristic' | 'gemini';
  evidence?: {
    nameScore?: number;
    typeScore?: number;
    uniquenessScore?: number;
    overlapScore?: number;
  };
};

export type SchemaSnapshot = {
  tables: TableSchema[];
  relationships: Relationship[];
  warnings?: string[];
};

export type TemplateField = {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
};

export type Template = {
  id: string;
  name: string;
  stakeholder: string;
  frequency: string;
  fields: TemplateField[];
};

export type DataSource = {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'error';
  tableCount: number;
  columnCount: number;
  lastSync: string;
};
