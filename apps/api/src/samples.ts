import { inferColumnProfile } from './utils/profile';
import { TableSchema } from './types/schema';

const sampleData = {
  donors: [
    { donor_id: 'D001', donor_name: 'Jane Tan', donor_email: 'jane@example.org', join_date: '2024-01-12' },
    { donor_id: 'D002', donor_name: 'Ali Rahman', donor_email: 'ali@example.org', join_date: '2024-02-03' },
    { donor_id: 'D003', donor_name: 'Maya Lee', donor_email: 'maya@example.org', join_date: '2024-02-11' }
  ],
  donations: [
    { donation_id: 'N1001', donor_id: 'D001', program_id: 'P001', amount: 250, donation_date: '2024-03-01' },
    { donation_id: 'N1002', donor_id: 'D002', program_id: 'P002', amount: 100, donation_date: '2024-03-02' },
    { donation_id: 'N1003', donor_id: 'D001', program_id: 'P002', amount: 75, donation_date: '2024-03-07' }
  ],
  programs: [
    { program_id: 'P001', program_name: 'Food Relief', location: 'Johor' },
    { program_id: 'P002', program_name: 'Education Fund', location: 'Penang' }
  ]
};

const buildTable = (name: string, rows: Record<string, any>[]): TableSchema => {
  const columns = Object.keys(rows[0] || {});
  const profiles = columns.map(col => {
    const values = rows.map(r => r[col]);
    return inferColumnProfile(col, values);
  });

  return {
    name,
    columns: profiles,
    rowCount: rows.length,
    source: 'sample'
  };
};

export const loadSampleTables = (): TableSchema[] => {
  return [
    buildTable('donors', sampleData.donors),
    buildTable('donations', sampleData.donations),
    buildTable('programs', sampleData.programs)
  ];
};
