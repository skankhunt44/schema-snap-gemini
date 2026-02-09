import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { ReportEntry } from '../types';

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Bold.ttf', fontWeight: 'bold' },
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Oblique.ttf', fontStyle: 'italic' }
  ]
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Helvetica',
    paddingBottom: 60
  },
  brandBar: {
    height: 6,
    backgroundColor: '#4F46E5',
    marginBottom: 20,
    width: '100%'
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  subtitle: {
    fontSize: 9,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  meta: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'right'
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  text: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#334155'
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  kpiCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 8,
    marginRight: 8,
    marginBottom: 8,
    width: '45%'
  },
  kpiLabel: {
    fontSize: 8,
    color: '#64748B'
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginTop: 8,
    borderRadius: 4,
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  tableRow: {
    flexDirection: 'row'
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    padding: 4
  },
  tableCell: {
    fontSize: 8,
    color: '#475569',
    padding: 4
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 8
  }
});

const ReportPDF: React.FC<{ report: ReportEntry }> = ({ report }) => {
  const preview = report.preview;
  const columns = preview?.columns || [];
  const rows = preview?.rows || [];
  const colWidth = columns.length ? `${100 / Math.min(columns.length, 6)}%` : '50%';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{report.templateName}</Text>
            <Text style={styles.subtitle}>EXECUTIVE REPORT</Text>
          </View>
          <View>
            <Text style={styles.meta}>Stakeholder: {report.stakeholder}</Text>
            <Text style={styles.meta}>Date: {report.dateGenerated}</Text>
            <Text style={styles.meta}>ID: {report.id.slice(-6)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.text}>{report.narrative || 'No narrative generated.'}</Text>
        </View>

        {report.highlights && report.highlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            {report.highlights.map((item, idx) => (
              <Text key={idx} style={styles.text}>• {item}</Text>
            ))}
          </View>
        )}

        {report.kpis && report.kpis.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Metrics</Text>
            <View style={styles.kpiRow}>
              {report.kpis.slice(0, 6).map((kpi, idx) => (
                <View key={idx} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{kpi.label}</Text>
                  <Text style={styles.kpiValue}>{String(kpi.value)}</Text>
                  {kpi.detail ? <Text style={styles.kpiLabel}>{kpi.detail}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {report.dataQuality && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Quality</Text>
            <Text style={styles.text}>
              Missing values rate: {(report.dataQuality.missingRatio * 100).toFixed(1)}% • Rows analyzed: {report.dataQuality.totalRows}
            </Text>
          </View>
        )}

        {report.joinPaths && report.joinPaths.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join Paths</Text>
            {report.joinPaths.map((path, idx) => (
              <Text key={idx} style={styles.text}>{path.title}: {path.path.join(' → ')}</Text>
            ))}
          </View>
        )}

        {columns.length > 0 && rows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appendix (Sample Rows)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                {columns.slice(0, 6).map(col => (
                  <Text key={col} style={[styles.tableCellHeader, { width: colWidth }]}>{col}</Text>
                ))}
              </View>
              {rows.slice(0, 6).map((row, idx) => (
                <View key={idx} style={styles.tableRow}>
                  {columns.slice(0, 6).map(col => (
                    <Text key={col} style={[styles.tableCell, { width: colWidth }]}>{String(row[col] ?? '')}</Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by SchemaSnap</Text>
          <Text style={styles.footerText}>Confidential</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReportPDF;
