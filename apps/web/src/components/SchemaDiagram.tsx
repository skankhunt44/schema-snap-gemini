import React, { useMemo } from 'react';
import { Relationship, TableSchema } from '../types';

type Props = {
  tables: TableSchema[];
  relationships: Relationship[];
  minConfidence: number;
  onEdgeSelect?: (relationship: Relationship) => void;
};

const FIELD_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const BOX_WIDTH = 260;
const GAP_X = 300; // match autoreport
const GAP_Y = 40;
const PADDING_Y = 20;
const START_X = 50; // match autoreport
const START_Y = 50; // match autoreport
const CANVAS_WIDTH = 900; // match autoreport

const edgeColor = (confidence: number) => {
  if (confidence >= 0.8) return '#16a34a';
  if (confidence >= 0.6) return '#f59e0b';
  return '#ef4444';
};

export default function SchemaDiagram({ tables, relationships, minConfidence, onEdgeSelect }: Props) {
  const layout = useMemo(() => {
    const tablePositions: Record<string, { x: number; y: number; height: number }> = {};
    const fieldPositions: Record<string, Record<string, { x: number; y: number }>> = {};

    const heights = new Map<string, number>();
    tables.forEach(t => {
      heights.set(t.name, HEADER_HEIGHT + t.columns.length * FIELD_HEIGHT + PADDING_Y);
    });

    // Degree-based layout: center most-connected table, others fan left/right
    const degree: Record<string, number> = {};
    tables.forEach(t => (degree[t.name] = 0));
    relationships.forEach(r => {
      degree[r.from.table] = (degree[r.from.table] || 0) + 1;
      degree[r.to.table] = (degree[r.to.table] || 0) + 1;
    });

    const sorted = [...tables].sort((a, b) => (degree[b.name] || 0) - (degree[a.name] || 0));
    const center = sorted[0];

    const columnX = [
      START_X + GAP_X, // left
      START_X + GAP_X * 3, // right
      START_X, // far left
      START_X + GAP_X * 4 // far right
    ];

    const columnY = columnX.map(() => START_Y);

    if (center) {
      const centerX = START_X + GAP_X * 2;
      const centerY = START_Y + 60;
      tablePositions[center.name] = { x: centerX, y: centerY, height: heights.get(center.name)! };

      const fields: Record<string, { x: number; y: number }> = {};
      center.columns.forEach((col, i) => {
        const fieldY = centerY + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2;
        fields[col.name] = { x: centerX + BOX_WIDTH, y: fieldY };
      });
      fieldPositions[center.name] = fields;
    }

    const remaining = sorted.slice(1);
    remaining.forEach((table, idx) => {
      const colIdx = idx % columnX.length;
      const x = columnX[colIdx];
      const y = columnY[colIdx];
      const height = heights.get(table.name)!;
      tablePositions[table.name] = { x, y, height };

      const fields: Record<string, { x: number; y: number }> = {};
      table.columns.forEach((col, i) => {
        const fieldY = y + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2;
        fields[col.name] = { x: x + BOX_WIDTH, y: fieldY };
      });
      fieldPositions[table.name] = fields;

      columnY[colIdx] += height + GAP_Y;
    });

    const width = START_X + GAP_X * 5 + BOX_WIDTH;
    const height = Math.max(...columnY, START_Y + 200) + 100;

    return { tablePositions, fieldPositions, width, height };
  }, [tables, relationships]);

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

            const startX = sourceTable.x + BOX_WIDTH;
            const startY = sourceField.y;
            const endX = targetTable.x;
            const endY = targetField.y;
            const color = edgeColor(rel.confidence);

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const labelY = midY - 14;

            return (
              <g key={rel.from.table + rel.from.column + rel.to.table + rel.to.column + i}>
                <path
                  d={`M ${startX} ${startY} C ${startX + 100} ${startY}, ${endX - 100} ${endY}, ${endX} ${endY}`}
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
                    <circle cx={0} cy={FIELD_HEIGHT / 2} r="3" fill="#94a3b8" />
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
