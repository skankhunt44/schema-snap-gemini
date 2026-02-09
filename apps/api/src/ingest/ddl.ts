import pkg from 'node-sql-parser';
import { TableSchema, DataType } from '../types/schema';

const { Parser } = pkg as any;

const mapSqlType = (type?: string): DataType => {
  if (!type) return 'unknown';
  const t = type.toLowerCase();
  if (t.includes('uuid')) return 'uuid';
  if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) return 'number';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('date') || t.includes('time')) return 'date';
  if (t.includes('char') || t.includes('text') || t.includes('json')) return 'string';
  return 'unknown';
};

const normalizeDialect = (dialect: string) => {
  const d = dialect.toLowerCase();
  if (d === 'postgres' || d === 'postgresql') return 'postgresql';
  if (d === 'mysql') return 'mysql';
  if (d === 'sqlite') return 'sqlite';
  return 'postgresql';
};

export const ingestDDL = (ddl: string, dialect: string): TableSchema[] => {
  const parser = new Parser();
  const ast = parser.astify(ddl, { database: normalizeDialect(dialect) });
  const nodes = Array.isArray(ast) ? ast : [ast];

  const tables: TableSchema[] = [];

  for (const node of nodes) {
    if (node.type !== 'create' || node.keyword !== 'table') continue;
    const rawTable = (node as any).table;
    const tableName = Array.isArray(rawTable)
      ? rawTable[0]?.table || rawTable[0]
      : rawTable?.table || rawTable;
    const defs = node.create_definitions || [];

    const columns = defs
      .filter((d: any) => d.column)
      .map((d: any) => {
        const raw = d.column?.column ?? d.column?.name ?? d.column;
        const name =
          typeof raw === 'string'
            ? raw
            : raw?.value ?? raw?.expr?.value ?? raw?.expr?.column ?? raw?.column ?? 'unknown';
        return {
          name,
          dataType: mapSqlType(d.definition?.dataType || d.definition?.data_type),
          sampleValues: []
        };
      });

    tables.push({
      name: tableName,
      columns,
      source: 'ddl',
      sampleRows: []
    });
  }

  return tables;
};
