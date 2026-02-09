import { inferColumnProfile } from './utils/profile';
import { TableSchema } from './types/schema';

const sampleData = {
  donors: [
    { donor_id: 'D001', donor_name: 'Jane Tan', donor_email: 'jane@example.org', join_date: '2024-01-12', country: 'Malaysia' },
    { donor_id: 'D002', donor_name: 'Ali Rahman', donor_email: 'ali@example.org', join_date: '2024-02-03', country: 'Malaysia' },
    { donor_id: 'D003', donor_name: 'Maya Lee', donor_email: 'maya@example.org', join_date: '2024-02-11', country: 'Singapore' }
  ],
  donor_touchpoints: [
    { touchpoint_id: 'T001', donor_id: 'D001', channel: 'email', touchpoint_date: '2024-02-15', outcome: 'opened' },
    { touchpoint_id: 'T002', donor_id: 'D001', channel: 'call', touchpoint_date: '2024-02-20', outcome: 'pledge' },
    { touchpoint_id: 'T003', donor_id: 'D002', channel: 'sms', touchpoint_date: '2024-02-22', outcome: 'clicked' },
    { touchpoint_id: 'T004', donor_id: 'D003', channel: 'email', touchpoint_date: '2024-02-25', outcome: 'opened' }
  ],
  donations: [
    { donation_id: 'N1001', donor_id: 'D001', program_id: 'P001', amount: 250, currency: 'MYR', payment_method: 'card', donation_date: '2024-03-01' },
    { donation_id: 'N1002', donor_id: 'D002', program_id: 'P002', amount: 100, currency: 'MYR', payment_method: 'bank_transfer', donation_date: '2024-03-02' },
    { donation_id: 'N1003', donor_id: 'D001', program_id: 'P002', amount: 75, currency: 'MYR', payment_method: 'card', donation_date: '2024-03-07' },
    { donation_id: 'N1004', donor_id: 'D003', program_id: 'P001', amount: 300, currency: 'SGD', payment_method: 'card', donation_date: '2024-03-08' }
  ],
  payments: [
    { payment_id: 'PAY001', donation_id: 'N1001', processor_fee: 7.5, net_amount: 242.5, settlement_date: '2024-03-02' },
    { payment_id: 'PAY002', donation_id: 'N1002', processor_fee: 2.5, net_amount: 97.5, settlement_date: '2024-03-03' },
    { payment_id: 'PAY003', donation_id: 'N1003', processor_fee: 2.1, net_amount: 72.9, settlement_date: '2024-03-08' },
    { payment_id: 'PAY004', donation_id: 'N1004', processor_fee: 9, net_amount: 291, settlement_date: '2024-03-09' }
  ],
  programs: [
    { program_id: 'P001', program_name: 'Food Relief', location: 'Johor', category: 'Relief', start_date: '2023-06-01' },
    { program_id: 'P002', program_name: 'Education Fund', location: 'Penang', category: 'Education', start_date: '2023-08-15' },
    { program_id: 'P003', program_name: 'Health Kits', location: 'Sabah', category: 'Health', start_date: '2024-01-10' }
  ],
  allocations: [
    { allocation_id: 'A001', program_id: 'P001', fiscal_year: 2024, allocated_amount: 50000 },
    { allocation_id: 'A002', program_id: 'P002', fiscal_year: 2024, allocated_amount: 35000 },
    { allocation_id: 'A003', program_id: 'P003', fiscal_year: 2024, allocated_amount: 20000 }
  ],
  campaigns: [
    { campaign_id: 'C001', campaign_name: 'Back to School', goal_amount: 20000, start_date: '2024-02-01', end_date: '2024-04-30', status: 'active' },
    { campaign_id: 'C002', campaign_name: 'Ramadan Giving', goal_amount: 30000, start_date: '2024-03-01', end_date: '2024-04-15', status: 'active' }
  ]
};

const buildTable = (name: string, rows: Record<string, any>[], source: string): TableSchema => {
  const columns = Object.keys(rows[0] || {});
  const profiles = columns.map(col => {
    const values = rows.map(r => r[col]);
    return inferColumnProfile(col, values);
  });

  return {
    name,
    columns: profiles,
    rowCount: rows.length,
    source,
    sampleRows: rows.slice(0, 25)
  };
};

export const loadSampleTables = (): TableSchema[] => {
  return [
    buildTable('donors', sampleData.donors, 'crm_csv'),
    buildTable('donor_touchpoints', sampleData.donor_touchpoints, 'crm_csv'),
    buildTable('donations', sampleData.donations, 'ledger_excel'),
    buildTable('payments', sampleData.payments, 'ledger_excel'),
    buildTable('programs', sampleData.programs, 'ops_db'),
    buildTable('allocations', sampleData.allocations, 'ops_db'),
    buildTable('campaigns', sampleData.campaigns, 'ops_db')
  ];
};
