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

    const degree: Record<string, number> = {};
    tables.forEach(t => (degree[t.name] = 0));
    relationships.forEach(r => {
      degree[r.from.table] = (degree[r.from.table] || 0) + 1;
      degree[r.to.table] = (degree[r.to.table] || 0) + 1;
    });

    const sorted = [...tables].sort((a, b) => (degree[b.name] || 0) - (degree[a.name] || 0));
    const hub = sorted[0];

    if (!hub) {
      return { tablePositions, fieldPositions, width: CANVAS_WIDTH, height: 300 };
    }

    const related = relationships.filter(r => r.from.table === hub.name || r.to.table === hub.name);
    const hubColumns = new Set<string>();
    related.forEach(r => {
      if (r.from.table === hub.name) hubColumns.add(r.from.column);
      if (r.to.table === hub.name) hubColumns.add(r.to.column);
    });

    const hubFields = hub.columns.filter(c => hubColumns.has(c.name));
    const hubHeight = HEADER_HEIGHT + Math.max(hubFields.length, 1) * FIELD_HEIGHT + PADDING_Y;

    const hubX = CANVAS_WIDTH - BOX_WIDTH - 50;
    const hubY = START_Y;

    tablePositions[hub.name] = { x: hubX, y: hubY, height: hubHeight };
    const hubFieldPositions: Record<string, { x: number; y: number }> = {};
    hubFields.forEach((col, i) => {
      const fieldY = hubY + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2;
      hubFieldPositions[col.name] = { x: hubX, y: fieldY };
    });
    fieldPositions[hub.name] = hubFieldPositions;

    const sources = sorted.slice(1).filter(t =>
      related.some(r => r.from.table === t.name || r.to.table === t.name)
    );

    let currentY = START_Y;
    sources.forEach(source => {
      const relCols = new Set<string>();
      related.forEach(r => {
        if (r.from.table === source.name) relCols.add(r.from.column);
        if (r.to.table === source.name) relCols.add(r.to.column);
      });

      const sourceFields = source.columns.filter(c => relCols.has(c.name));
      const sourceHeight = HEADER_HEIGHT + Math.max(sourceFields.length, 1) * FIELD_HEIGHT + PADDING_Y;
      const sourceX = START_X;
      const sourceY = currentY;

      tablePositions[source.name] = { x: sourceX, y: sourceY, height: sourceHeight };
      const fields: Record<string, { x: number; y: number }> = {};
      sourceFields.forEach((col, i) => {
        const fieldY = sourceY + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2;
        fields[col.name] = { x: sourceX + BOX_WIDTH, y: fieldY };
      });
      fieldPositions[source.name] = fields;

      currentY += sourceHeight + 30;
    });

    const height = Math.max(currentY + 100, hubY + hubHeight + 100, 400);

    return { tablePositions, fieldPositions, width: CANVAS_WIDTH, height };
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
            if (!pos) return null;
            const height = pos.height;
            const fields = layout.fieldPositions[table.name] || {};
            const visibleColumns = table.columns.filter(c => fields[c.name]);
            return (
              <g key={table.name} transform={`translate(${pos.x}, ${pos.y})`}>
                <rect width={BOX_WIDTH} height={height} rx="10" fill="white" stroke="#e2e8f0" />
                <rect width={BOX_WIDTH} height={HEADER_HEIGHT} rx="10" fill="#f8fafc" />
                <text x="14" y="22" fontSize="12" fontWeight="600" fill="#0f172a">
                  {table.name}
                </text>
                <text x={BOX_WIDTH - 14} y="22" textAnchor="end" fontSize="10" fill="#94a3b8">
                  {visibleColumns.length} columns
                </text>

                {visibleColumns.map((col, idx) => (
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
