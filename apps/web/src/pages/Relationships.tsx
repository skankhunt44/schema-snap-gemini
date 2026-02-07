import React from 'react';
import GraphView from '../components/GraphView';
import { Relationship, SchemaSnapshot } from '../types';

type Props = {
  snapshot: SchemaSnapshot | null;
  selectedRel: Relationship | null;
  onSelectRel: (rel: Relationship) => void;
  onExportJson: () => void;
  onExportSql: () => void;
};

const Relationships: React.FC<Props> = ({ snapshot, selectedRel, onSelectRel, onExportJson, onExportSql }) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Relationships</h1>
        <p className="text-slate-500">Inspect inferred joins and evidence from Gemini + heuristics.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <button onClick={onExportJson} className="bg-slate-900 text-white rounded-lg py-2 px-4 hover:bg-slate-800">
            Export JSON Snapshot
          </button>
          <button onClick={onExportSql} className="bg-indigo-600 text-white rounded-lg py-2 px-4 hover:bg-indigo-700">
            Export SQL Join Plan
          </button>
        </div>
        {snapshot ? (
          <GraphView tables={snapshot.tables} relationships={snapshot.relationships} onEdgeSelect={onSelectRel} />
        ) : (
          <p className="text-sm text-slate-500">Upload data sources to view relationships.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-2">Selected relationship</h3>
        {selectedRel ? (
          <div>
            <p className="text-sm text-slate-700">
              <strong>{selectedRel.from.table}.{selectedRel.from.column}</strong>
              {' → '}
              <strong>{selectedRel.to.table}.{selectedRel.to.column}</strong>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Type: {selectedRel.type} • Confidence: {Math.round(selectedRel.confidence * 100)}% • {selectedRel.suggestedBy}
            </p>
            <p className="text-sm text-slate-600 mt-2">{selectedRel.rationale}</p>
            {selectedRel.evidence && (
              <ul className="text-xs text-slate-500 mt-2 space-y-1">
                {selectedRel.evidence.nameScore !== undefined && <li>Name similarity: {selectedRel.evidence.nameScore}</li>}
                {selectedRel.evidence.typeScore !== undefined && <li>Type match: {selectedRel.evidence.typeScore}</li>}
                {selectedRel.evidence.uniquenessScore !== undefined && <li>Uniqueness: {selectedRel.evidence.uniquenessScore}</li>}
                {selectedRel.evidence.overlapScore !== undefined && <li>Value overlap: {selectedRel.evidence.overlapScore}</li>}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Click an edge in the graph to view details.</p>
        )}
      </div>
    </div>
  );
};

export default Relationships;
