import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { ingestCsvBuffer, ingestCsvBufferAutoFix } from '../ingest/csv';
import { ingestDDL } from '../ingest/ddl';

const makeWorkbookBuffer = () => {
  const data = [
    ['id', 'name'],
    [1, 'Alice'],
    [2, 'Bob']
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

describe('ingestCsvBuffer', () => {
  it('parses CSV and infers schema', () => {
    const csv = 'id,name\n1,Alice\n2,Bob';
    const table = ingestCsvBuffer(Buffer.from(csv), 'people.csv');
    expect(table.name).toBe('people');
    expect(table.rowCount).toBe(2);
    expect(table.source).toBe('csv');
    expect(table.columns.map(c => c.name)).toEqual(['id', 'name']);
  });

  it('parses XLSX and infers schema', () => {
    const buffer = makeWorkbookBuffer();
    const table = ingestCsvBuffer(Buffer.from(buffer), 'employees.xlsx');
    expect(table.name).toBe('employees');
    expect(table.rowCount).toBe(2);
    expect(table.source).toBe('excel');
    expect(table.columns.map(c => c.name)).toEqual(['id', 'name']);
  });

  it('auto-fixes missing values and duplicate ids', () => {
    const csv = 'id,amount\n1,10\n1,\n2,20\n3,';
    const table = ingestCsvBufferAutoFix(Buffer.from(csv), 'payments.csv');
    expect(table.rowCount).toBe(3);
    const amount = table.columns.find(c => c.name === 'amount');
    expect(amount?.nullRatio).toBe(0);
  });
});

describe('ingestDDL', () => {
  it('parses CREATE TABLE statements', () => {
    const ddl = `
      CREATE TABLE donors (
        donor_id uuid,
        donor_name text,
        join_date date
      );
    `;
    const tables = ingestDDL(ddl, 'postgres');
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('donors');
    expect(tables[0].columns.map(c => c.name)).toEqual(['donor_id', 'donor_name', 'join_date']);
    expect(tables[0].columns.map(c => c.dataType)).toEqual(['uuid', 'string', 'date']);
  });
});
