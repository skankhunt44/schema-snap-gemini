import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  MarkerType,
  NodeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Relationship, TableSchema } from '../types';

type TableNodeData = {
  name: string;
  columns: { name: string; dataType: string }[];
};

const TableNode = ({ data }: { data: TableNodeData }) => {
  const columns = data.columns.slice(0, 6);
  const extra = data.columns.length - columns.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm min-w-[220px]">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="text-sm font-semibold text-slate-900">{data.name}</div>
        <div className="text-xs text-slate-500">{data.columns.length} columns</div>
      </div>
      <div className="px-3 py-2 text-xs text-slate-600 space-y-1">
        {columns.map(col => (
          <div key={col.name} className="flex items-center justify-between">
            <span className="truncate max-w-[140px]">{col.name}</span>
            <span className="text-slate-400">{col.dataType}</span>
          </div>
        ))}
        {extra > 0 && <div className="text-slate-400">+{extra} more…</div>}
      </div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
};

const nodeTypes: NodeTypes = { table: TableNode };

const buildNodes = (tables: TableSchema[]): Node[] => {
  const cols = 3;
  const spacingX = 320;
  const spacingY = 240;

  return tables.map((t, idx) => {
    const x = (idx % cols) * spacingX;
    const y = Math.floor(idx / cols) * spacingY;
    return {
      id: t.name,
      type: 'table',
      position: { x, y },
      data: {
        name: t.name,
        columns: t.columns.map(col => ({ name: col.name, dataType: col.dataType }))
      }
    };
  });
};

const edgeColor = (confidence: number) => {
  if (confidence >= 0.8) return '#16a34a';
  if (confidence >= 0.6) return '#f59e0b';
  return '#ef4444';
};

const buildEdges = (rels: Relationship[], minConfidence: number): Edge[] => {
  return rels
    .filter(r => r.confidence >= minConfidence)
    .map((r, idx) => {
      const color = edgeColor(r.confidence);
      return {
        id: `${r.from.table}.${r.from.column}->${r.to.table}.${r.to.column}-${idx}`,
        source: r.from.table,
        target: r.to.table,
        label: `${r.from.column} → ${r.to.column} (${Math.round(r.confidence * 100)}%)`,
        animated: r.suggestedBy === 'gemini',
        data: { relationship: r },
        style: { stroke: color, strokeWidth: 2 },
        labelStyle: { fill: '#0f172a', fontSize: 10 },
        labelBgStyle: { fill: '#ffffff', stroke: '#e2e8f0' },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        type: 'smoothstep'
      };
    });
};

export default function GraphView({
  tables,
  relationships,
  minConfidence = 0,
  onEdgeSelect
}: {
  tables: TableSchema[];
  relationships: Relationship[];
  minConfidence?: number;
  onEdgeSelect?: (relationship: Relationship) => void;
}) {
  const nodes = React.useMemo(() => buildNodes(tables), [tables]);
  const edges = React.useMemo(() => buildEdges(relationships, minConfidence), [relationships, minConfidence]);

  return (
    <div style={{ height: 520, border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodeTypes={nodeTypes}
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
