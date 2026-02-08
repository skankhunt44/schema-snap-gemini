import React from 'react';
import TemplateDiagram from '../components/TemplateDiagram';
import { MappingEntry, SchemaSnapshot, Template } from '../types';

type SourceField = {
  id: string;
  table: string;
  column: string;
  dataType: string;
};

type Props = {
  snapshot: SchemaSnapshot | null;
  template: Template | null;
  mappings: Record<string, MappingEntry>;
  sourceFields: SourceField[];
  onExportJson: () => void;
  onExportSql: () => void;
};

const Relationships: React.FC<Props> = ({ snapshot, template, mappings, sourceFields, onExportJson, onExportSql }) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Mappings</h1>
        <p className="text-slate-500">Visualize data → template mappings (autoreport style).</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3">
            <button onClick={onExportJson} className="bg-slate-900 text-white rounded-lg py-2 px-4 hover:bg-slate-800">
              Export JSON Snapshot
            </button>
            <button onClick={onExportSql} className="bg-indigo-600 text-white rounded-lg py-2 px-4 hover:bg-indigo-700">
              Export SQL Join Plan
            </button>
          </div>
        </div>
        {snapshot ? (
          <TemplateDiagram template={template} mappings={mappings} sourceFields={sourceFields} />
        ) : (
          <p className="text-sm text-slate-500">Upload data sources to view mappings.</p>
        )}
      </div>
    </div>
  );
};

export default Relationships;
