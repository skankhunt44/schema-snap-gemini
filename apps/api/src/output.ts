import XLSX from 'xlsx';
import { SchemaSnapshot, Relationship, TableSchema } from './types/schema';

type TemplateField = {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  validationRule?: string;
};

type Template = {
  id: string;
  name: string;
  stakeholder?: string;
  fields: TemplateField[];
};

type MappingEntry = {
  sourceFieldId: string | null;
  operation?: string;
  confidence?: number;
  rationale?: string;
};

type PersistedState = {
  snapshot: SchemaSnapshot | null;
  templates?: Template[];
  mappingByTemplate?: Record<string, Record<string, MappingEntry>>;
};

type OutputTemplate = {
  templateId: string;
  templateName: string;
  baseTable: string | null;
  rowCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
};

type OutputPayload = {
  generatedAt: string;
  templates: OutputTemplate[];
};

type RelationshipMatch = {
  relationship: Relationship;
  reversed: boolean;
};

const isPresent = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';

const parseSourceFieldId = (sourceFieldId: string) => {
  const dot = sourceFieldId.indexOf('.');
  if (dot <= 0 || dot === sourceFieldId.length - 1) return null;
  return {
    table: sourceFieldId.slice(0, dot),
    column: sourceFieldId.slice(dot + 1)
  };
};

const getTableRows = (table?: TableSchema | null) => table?.sampleRows || [];

const findRelationship = (relationships: Relationship[], fromTable: string, toTable: string): RelationshipMatch | null => {
  const direct = relationships
    .filter(rel => rel.from.table === fromTable && rel.to.table === toTable)
    .sort((a, b) => b.confidence - a.confidence);
  if (direct.length) return { relationship: direct[0], reversed: false };

  const reverse = relationships
    .filter(rel => rel.from.table === toTable && rel.to.table === fromTable)
    .sort((a, b) => b.confidence - a.confidence);
  if (reverse.length) return { relationship: reverse[0], reversed: true };

  return null;
};

const getRelatedRows = (
  baseRow: Record<string, unknown>,
  baseTable: string,
  targetTable: string,
  relationships: Relationship[],
  tableMap: Map<string, TableSchema>
) => {
  const relation = findRelationship(relationships, baseTable, targetTable);
  if (!relation) return [];
  const target = tableMap.get(targetTable);
  if (!target) return [];

  const matchColumn = relation.reversed ? relation.relationship.from.column : relation.relationship.to.column;
  const baseColumn = relation.reversed ? relation.relationship.to.column : relation.relationship.from.column;
  const baseKey = baseRow[baseColumn];
  if (!isPresent(baseKey)) return [];

  return getTableRows(target).filter(row => String(row[matchColumn] ?? '') === String(baseKey ?? ''));
};

const numericValues = (rows: Record<string, unknown>[], column: string) =>
  rows
    .map(row => Number(row[column]))
    .filter(value => Number.isFinite(value));

const aggregateValue = (rows: Record<string, unknown>[], column: string, operation: string) => {
  if (operation === 'COUNT') {
    return rows.filter(row => isPresent(row[column])).length;
  }

  if (operation === 'COUNT_DISTINCT') {
    const values = rows
      .map(row => row[column])
      .filter(isPresent)
      .map(value => String(value));
    return new Set(values).size;
  }

  const values = numericValues(rows, column);
  if (operation === 'SUM') {
    return values.reduce((acc, value) => acc + value, 0);
  }

  if (operation === 'AVERAGE') {
    if (!values.length) return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }

  if (operation === 'FIRST') {
    return rows[0]?.[column] ?? null;
  }

  if (operation === 'LAST') {
    return rows.length ? rows[rows.length - 1]?.[column] ?? null : null;
  }

  return null;
};

const buildCombinedRows = (
  template: Template,
  mapping: Record<string, MappingEntry>,
  snapshot: SchemaSnapshot
): { rows: Record<string, unknown>[]; baseTable: string | null } => {
  const tableMap = new Map(snapshot.tables.map(table => [table.name, table]));
  const mappedFields = template.fields.filter(field => mapping[field.id]?.sourceFieldId);

  let baseTable: string | null = null;
  if (mappedFields.length) {
    const counts = new Map<string, number>();
    mappedFields.forEach(field => {
      const sourceId = mapping[field.id]?.sourceFieldId;
      if (!sourceId) return;
      const parsed = parseSourceFieldId(sourceId);
      if (!parsed) return;
      const table = tableMap.get(parsed.table);
      if (!table || !getTableRows(table).length) return;
      counts.set(parsed.table, (counts.get(parsed.table) || 0) + 1);
    });

    if (counts.size) {
      baseTable = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  if (!baseTable) {
    baseTable = snapshot.tables.find(table => getTableRows(table).length)?.name || null;
  }

  const baseRows = baseTable ? getTableRows(tableMap.get(baseTable)) : [];
  const seedRows = baseRows.length ? baseRows : [{}];

  const rows = seedRows.map(baseRow => {
    const output: Record<string, unknown> = {};

    template.fields.forEach(field => {
      const entry = mapping[field.id];
      if (!entry?.sourceFieldId) {
        output[field.name] = null;
        return;
      }

      const parsed = parseSourceFieldId(entry.sourceFieldId);
      if (!parsed) {
        output[field.name] = null;
        return;
      }

      const sourceTable = tableMap.get(parsed.table);
      const sourceRows = getTableRows(sourceTable);
      const relatedRows = baseTable && parsed.table !== baseTable
        ? getRelatedRows(baseRow, baseTable, parsed.table, snapshot.relationships || [], tableMap)
        : [];

      const operation = (entry.operation || 'DIRECT').toUpperCase();

      if (operation === 'DIRECT') {
        if (parsed.table === baseTable && baseRows.length) {
          output[field.name] = baseRow[parsed.column] ?? null;
          return;
        }
        if (relatedRows.length) {
          output[field.name] = relatedRows[0]?.[parsed.column] ?? null;
          return;
        }
        output[field.name] = sourceRows[0]?.[parsed.column] ?? null;
        return;
      }

      const aggregateRows = parsed.table === baseTable
        ? sourceRows
        : (relatedRows.length ? relatedRows : sourceRows);

      output[field.name] = aggregateValue(aggregateRows, parsed.column, operation);
    });

    return output;
  });

  return { rows, baseTable };
};

export const buildCombinedOutput = (state: PersistedState, templateId?: string): OutputPayload => {
  if (!state?.snapshot) {
    throw new Error('No saved snapshot available.');
  }

  const templates = state.templates || [];
  const mappingByTemplate = state.mappingByTemplate || {};

  const mappedTemplates = templates.filter(template =>
    template.fields.some(field => mappingByTemplate[template.id]?.[field.id]?.sourceFieldId)
  );

  if (templateId) {
    const target = mappedTemplates.find(template => template.id === templateId);
    if (!target) {
      throw new Error('Template not found or has no mappings.');
    }

    const { rows, baseTable } = buildCombinedRows(target, mappingByTemplate[target.id] || {}, state.snapshot);
    return {
      generatedAt: new Date().toISOString(),
      templates: [
        {
          templateId: target.id,
          templateName: target.name,
          baseTable,
          rowCount: rows.length,
          columns: target.fields.map(field => field.name),
          rows
        }
      ]
    };
  }

  const outputs: OutputTemplate[] = mappedTemplates.map(template => {
    const { rows, baseTable } = buildCombinedRows(template, mappingByTemplate[template.id] || {}, state.snapshot as SchemaSnapshot);
    return {
      templateId: template.id,
      templateName: template.name,
      baseTable,
      rowCount: rows.length,
      columns: template.fields.map(field => field.name),
      rows
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    templates: outputs
  };
};

export const buildCombinedWorkbook = (payload: OutputPayload) => {
  const workbook = XLSX.utils.book_new();

  if (!payload.templates.length) {
    const sheet = XLSX.utils.aoa_to_sheet([['No mapped templates found']]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'No Data');
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  }

  payload.templates.forEach(template => {
    const headers = template.columns;
    const sheet = XLSX.utils.json_to_sheet(template.rows, { header: headers });
    const sheetName = template.templateName.slice(0, 31) || 'Template';
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
};
