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
  sampleRows?: Record<string, unknown>[];
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
  validationRule?: string;
};

export type Template = {
  id: string;
  name: string;
  stakeholder: string;
  frequency: string;
  nextDueDate?: string;
  reminderDays?: number[];
  fields: TemplateField[];
};

export type MappingEntry = {
  sourceFieldId: string | null;
  operation?: string;
  confidence?: number;
  rationale?: string;
  transformation?: string;
};

export type ReportStatus = 'Draft' | 'Published';

export type ReportEntry = {
  id: string;
  templateId: string;
  templateName: string;
  stakeholder: string;
  dateGenerated: string;
  status: ReportStatus;
};

export type SourceField = {
  id: string;
  table: string;
  column: string;
  dataType: string;
  sourceId?: string;
  sourceName?: string;
};

export type DataSource = {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'error';
  tableCount: number;
  columnCount: number;
  lastSync: string;
  fields?: SourceField[];
};

export type PersistedState = {
  snapshot: SchemaSnapshot | null;
  dataSources: DataSource[];
  templates: Template[];
  activeTemplateId: string | null;
  mappingByTemplate: Record<string, Record<string, MappingEntry>>;
  reports: ReportEntry[];
};
