import React from 'react';
import { MappingEntry, Template, TemplateField } from '../types';

type SourceField = {
  id: string;
  table: string;
  column: string;
  dataType: string;
};

type Props = {
  template: Template | null;
  mappings: Record<string, MappingEntry>;
  sourceFields: SourceField[];
};

const FIELD_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const BOX_WIDTH = 260;
const CANVAS_WIDTH = 900;
const PADDING_Y = 20;
const START_Y = 50;

const buildSourceBoxes = (template: Template, mappings: Record<string, MappingEntry>, sourceFields: SourceField[]) => {
  const mapped = Object.entries(mappings)
    .filter(([_, m]) => m?.sourceFieldId)
    .map(([_, m]) => m.sourceFieldId as string);

  const sources = new Map<string, SourceField[]>();
  mapped.forEach(id => {
    const field = sourceFields.find(f => f.id === id);
    if (!field) return;
    if (!sources.has(field.table)) sources.set(field.table, []);
    sources.get(field.table)!.push(field);
  });

  let currentY = START_Y;
  const boxes = Array.from(sources.entries()).map(([table, fields]) => {
    const uniqueFields = Array.from(new Map(fields.map(f => [f.id, f])).values());
    const height = HEADER_HEIGHT + uniqueFields.length * FIELD_HEIGHT + PADDING_Y;
    const node = {
      table,
      x: 50,
      y: currentY,
      height,
      fields: uniqueFields.map((f, i) => ({
        ...f,
        absY: currentY + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2
      }))
    };
    currentY += height + 30;
    return node;
  });

  return { boxes, height: Math.max(currentY + 60, 500) };
};

const buildTemplateNode = (template: Template) => {
  const height = HEADER_HEIGHT + template.fields.length * FIELD_HEIGHT + PADDING_Y;
  return {
    x: CANVAS_WIDTH - BOX_WIDTH - 50,
    y: START_Y,
    height,
    fields: template.fields.map((f, i) => ({
      ...f,
      y: START_Y + HEADER_HEIGHT + i * FIELD_HEIGHT + FIELD_HEIGHT / 2
    }))
  };
};

export default function TemplateDiagram({ template, mappings, sourceFields }: Props) {
  if (!template) {
    return <p className="text-sm text-slate-500">Select a template to view mappings.</p>;
  }

  const templateNode = buildTemplateNode(template);
  const { boxes, height } = buildSourceBoxes(template, mappings, sourceFields);

  const connections = template.fields
    .map(field => {
      const mapping = mappings[field.id];
      if (!mapping?.sourceFieldId) return null;

      const sourceBox = boxes.find(b => b.fields.some(f => f.id === mapping.sourceFieldId));
      if (!sourceBox) return null;
      const sourceField = sourceBox.fields.find(f => f.id === mapping.sourceFieldId);
      if (!sourceField) return null;

      return {
        id: `${mapping.sourceFieldId}-${field.id}`,
        startX: sourceBox.x + BOX_WIDTH,
        startY: sourceField.absY,
        endX: templateNode.x,
        endY: templateNode.fields.find(f => f.id === field.id)?.y || 0
      };
    })
    .filter(Boolean) as Array<{ id: string; startX: number; startY: number; endX: number; endY: number }>;

  return (
    <div className="overflow-auto bg-slate-50 rounded-xl border border-slate-200">
      <div className="min-w-[900px] p-6">
        <svg width={CANVAS_WIDTH} height={height} className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
            </marker>
          </defs>

          {connections.map(conn => (
            <path
              key={conn.id}
              d={`M ${conn.startX} ${conn.startY} C ${conn.startX + 100} ${conn.startY}, ${conn.endX - 100} ${conn.endY}, ${conn.endX} ${conn.endY}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
              className="opacity-70 hover:opacity-100"
            />
          ))}

          {boxes.map(box => (
            <g key={box.table} transform={`translate(${box.x}, ${box.y})`}>
              <rect width={BOX_WIDTH} height={box.height} rx="10" fill="white" stroke="#e2e8f0" />
              <rect width={BOX_WIDTH} height={HEADER_HEIGHT} rx="10" fill="#f8fafc" />
              <text x="14" y="22" fontSize="12" fontWeight="600" fill="#0f172a">
                {box.table}
              </text>
              <text x={BOX_WIDTH - 14} y="22" textAnchor="end" fontSize="10" fill="#94a3b8">
                {box.fields.length} columns
              </text>

              {box.fields.map((field, idx) => (
                <g key={field.id} transform={`translate(0, ${HEADER_HEIGHT + idx * FIELD_HEIGHT})`}>
                  <text x="14" y="18" fontSize="11" fill="#334155">
                    {field.column}
                  </text>
                  <text x={BOX_WIDTH - 14} y="18" textAnchor="end" fontSize="10" fill="#94a3b8">
                    {field.dataType}
                  </text>
                  <circle cx={BOX_WIDTH} cy={FIELD_HEIGHT / 2} r="3" fill="#6366f1" />
                </g>
              ))}
            </g>
          ))}

          <g transform={`translate(${templateNode.x}, ${templateNode.y})`}>
            <rect width={BOX_WIDTH} height={templateNode.height} rx="10" fill="white" stroke="#6366f1" strokeWidth="2" />
            <rect width={BOX_WIDTH} height={HEADER_HEIGHT} rx="10" fill="#eef2ff" />
            <text x="14" y="22" fontSize="12" fontWeight="600" fill="#1e1b4b">
              {template.name}
            </text>
            <text x={BOX_WIDTH - 14} y="22" textAnchor="end" fontSize="10" fill="#6366f1">
              TEMPLATE
            </text>

            {templateNode.fields.map((field, idx) => (
              <g key={field.id} transform={`translate(0, ${HEADER_HEIGHT + idx * FIELD_HEIGHT})`}>
                <circle cx={0} cy={FIELD_HEIGHT / 2} r="3" fill="#6366f1" />
                <text x="14" y="18" fontSize="11" fill="#334155" fontWeight={600}>
                  {field.name}
                </text>
                {field.required && (
                  <text x={BOX_WIDTH - 14} y="18" textAnchor="end" fontSize="10" fill="#ef4444">
                    REQ
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
