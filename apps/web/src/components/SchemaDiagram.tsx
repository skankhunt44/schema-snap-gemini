import React, { useMemo } from 'react';
import { Relationship, TableSchema } from '../types';

type Props = {
  tables: TableSchema[];
  relationships: Relationship[];
  minConfidence: number;
  onEdgeSelect?: (relationship: Relationship) => void;
};

const FIELD_HEIGHT = 28;
const HEADER_HEIGHT = 36;
const BOX_WIDTH = 240;
const GAP_X = 110;
const GAP_Y = 40;
const PADDING_Y = 16;
const START_X = 40;
const START_Y = 30;

const edgeColor = (confidence: number) => {
  if (confidence >= 0.8) return '#16a34a';
  if (confidence >= 0.6) return '#f59e0b';
  return '#ef4444';
};

export default function SchemaDiagram({ tables, relationships, minConfidence, onEdgeSelect }: Props) {
  const layout = useMemo(() => {
    const cols = Math.min(3, Math.max(1, tables.length));
    const rows: TableSchema[][] = [];
    for (let i = 0; i < tables.length; i += cols) {
      rows.push(tables.slice(i, i + cols));
    }

    const tablePositions: Record<string, { x: number; y: number; height: number }> = {};
    const fieldPositions: Record<string, Record<string, { x: number; y: number }>> = {};

    let currentY = START_Y;
    rows.forEach((row, rowIdx) => {
      const heights = row.map(t => HEADER_HEIGHT + t.columns.length * FIELD_HEIGHT + PADDING_Y);
      const rowHeight = Math.max(...heights, HEADER_HEIGHT + FIELD_HEIGHT + PADDING_Y);

      row.forEach((table, colIdx) => {
        const x = START_X + colIdx * (BOX_WIDTH + GAP_X);
        const y = currentY;
        const height = HEADER_HEIGHT + table.columns.length * FIELD_HEIGHT + PADDING_Y;
        tablePositions[table.name] = { x, y, height };

        const fields: Record<string, { x: number; y: number }> = {};
        table.columns.forEach((col, i) => {
          const fieldY = y + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2;
          fields[col.name] = { x: x + BOX_WIDTH, y: fieldY };
        });
        fieldPositions[table.name] = fields;
      });

      currentY += rowHeight + GAP_Y;
    });

    const width = START_X + cols * BOX_WIDTH + (cols - 1) * GAP_X + START_X;
    const height = currentY + START_Y;

    return { tablePositions, fieldPositions, width, height };
  }, [tables]);

  const filteredRels = relationships.filter(r => r.confidence >= minConfidence);

  return (
    <div className="overflow-auto bg-slate-50 rounded-xl border border-slate-200">
      <div className="min-w-[900px] p-6">
        <svg width={layout.width} height={layout.height} className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
          </defs>

          {filteredRels.map((rel, i) => {
            const sourceTable = layout.tablePositions[rel.from.table];
            const targetTable = layout.tablePositions[rel.to.table];
            const sourceField = layout.fieldPositions[rel.from.table]?.[rel.from.column];
            const targetField = layout.fieldPositions[rel.to.table]?.[rel.to.column];
            if (!sourceTable || !targetTable || !sourceField || !targetField) return null;

            const startX = sourceTable.x + BOX_WIDTH + 8;
            const startY = sourceField.y;
            const endX = targetTable.x - 8;
            const endY = targetField.y;
            const color = edgeColor(rel.confidence);

            const dx = endX - startX;
            const spread = (i % 5 - 2) * 8; // stagger overlapping lines
            const curve = Math.max(-60, Math.min(60, (startY - endY) * 0.3)) + spread;

            const c1x = startX + dx * 0.35;
            const c2x = startX + dx * 0.65;
            const c1y = startY + curve - 12;
            const c2y = endY + curve - 12;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2 + curve - 18;
            const labelY = midY;

            return (
              <g key={rel.from.table + rel.from.column + rel.to.table + rel.to.column + i}>
                <path
                  d={`M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  className="opacity-85 hover:opacity-100"
                  onClick={() => onEdgeSelect?.(rel)}
                  style={{ cursor: 'pointer' }}
                />
                <rect
                  x={midX - 20}
                  y={labelY - 9}
                  width={40}
                  height={18}
                  rx={9}
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  opacity="0.92"
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x={midX}
                  y={labelY + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={600}
                  fill="#334155"
                  style={{ pointerEvents: 'none' }}
                >
                  {Math.round(rel.confidence * 100)}%
                </text>
                <title>{`${rel.from.column} → ${rel.to.column} (${Math.round(rel.confidence * 100)}%)`}</title>
              </g>
            );
          })}

          {tables.map(table => {
            const pos = layout.tablePositions[table.name];
            const height = pos.height;
            return (
              <g key={table.name} transform={`translate(${pos.x}, ${pos.y})`}>
                <rect width={BOX_WIDTH} height={height} rx="10" fill="white" stroke="#e2e8f0" />
                <rect width={BOX_WIDTH} height={HEADER_HEIGHT} rx="10" fill="#f8fafc" />
                <text x="14" y="22" fontSize="12" fontWeight="600" fill="#0f172a">
                  {table.name}
                </text>
                <text x={BOX_WIDTH - 14} y="22" textAnchor="end" fontSize="10" fill="#94a3b8">
                  {table.columns.length} columns
                </text>

                {table.columns.map((col, idx) => (
                  <g key={col.name} transform={`translate(0, ${HEADER_HEIGHT + idx * FIELD_HEIGHT})`}>
                    <text x="14" y="18" fontSize="11" fill="#334155">
                      {col.name}
                    </text>
                    <text x={BOX_WIDTH - 14} y="18" textAnchor="end" fontSize="10" fill="#94a3b8">
                      {col.dataType}
                    </text>
                    <circle cx={BOX_WIDTH} cy={FIELD_HEIGHT / 2} r="3" fill="#64748b" />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
