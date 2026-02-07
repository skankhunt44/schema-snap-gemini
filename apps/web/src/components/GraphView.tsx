import React from 'react';
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { Relationship, TableSchema } from '../types';

const buildNodes = (tables: TableSchema[]): Node[] => {
  const cols = 3;
  const spacingX = 320;
  const spacingY = 220;

  return tables.map((t, idx) => {
    const x = (idx % cols) * spacingX;
    const y = Math.floor(idx / cols) * spacingY;
    return {
      id: t.name,
      position: { x, y },
      data: {
        label: (
          <div>
            <strong>{t.name}</strong>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{t.columns.length} columns</div>
          </div>
        )
      },
      style: {
        padding: 8,
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        color: '#0f172a',
        minWidth: 180
      }
    };
  });
};

const buildEdges = (rels: Relationship[]): Edge[] => {
  return rels.map((r, idx) => ({
    id: `${r.from.table}.${r.from.column}->${r.to.table}.${r.to.column}-${idx}`,
    source: r.from.table,
    target: r.to.table,
    label: `${r.from.column} → ${r.to.column} (${Math.round(r.confidence * 100)}%)`,
    animated: r.suggestedBy === 'gemini',
    data: { relationship: r },
    style: { stroke: r.suggestedBy === 'gemini' ? '#7c3aed' : '#0ea5e9' },
    labelStyle: { fill: '#334155', fontSize: 10 }
  }));
};

export default function GraphView({
  tables,
  relationships,
  onEdgeSelect
}: {
  tables: TableSchema[];
  relationships: Relationship[];
  onEdgeSelect?: (relationship: Relationship) => void;
}) {
  const nodes = React.useMemo(() => buildNodes(tables), [tables]);
  const edges = React.useMemo(() => buildEdges(relationships), [relationships]);

  return (
    <div style={{ height: 520, border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        onEdgeClick={(_, edge) => {
          const rel = (edge.data as any)?.relationship as Relationship | undefined;
          if (rel) onEdgeSelect?.(rel);
        }}
      >
        <Background color="#e2e8f0" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
