import React, { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Edit, Trash2, UploadCloud, Wand2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Template, TemplateField } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyField = (): TemplateField => ({
  id: `tf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  description: '',
  required: true
});

type Props = {
  templates: Template[];
  activeTemplateId: string | null;
  onSelectTemplate: (id: string | null) => void;
  onCreateTemplate: (template: Template) => void;
  onUpdateTemplate: (id: string, update: Partial<Template>) => void;
  onDeleteTemplate: (id: string) => void;
  onExportMappings: () => void;
  mappedCountForTemplate: (id: string) => number;
};

const Templates: React.FC<Props> = ({
  templates,
  activeTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onExportMappings,
  mappedCountForTemplate
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [stakeholder, setStakeholder] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [fields, setFields] = useState<TemplateField[]>([emptyField()]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isModalOpen) return;
    if (!editingId) return;
    const template = templates.find(t => t.id === editingId);
    if (!template) return;
    setName(template.name);
    setStakeholder(template.stakeholder);
    setFrequency(template.frequency);
    setFields(template.fields.length ? template.fields : [emptyField()]);
  }, [editingId, isModalOpen, templates]);

  const resetForm = () => {
    setName('');
    setStakeholder('');
    setFrequency('Monthly');
    setFields([emptyField()]);
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (template: Template) => {
    setEditingId(template.id);
    setIsModalOpen(true);
  };

  const saveTemplate = () => {
    if (!name || !stakeholder) return;
    const cleanFields = fields.filter(f => f.name.trim());
    if (!cleanFields.length) return;

    if (editingId) {
      onUpdateTemplate(editingId, { name, stakeholder, frequency, fields: cleanFields });
    } else {
      onCreateTemplate({
        id: `tpl_${Date.now()}`,
        name,
        stakeholder,
        frequency,
        fields: cleanFields
      });
    }
    setIsModalOpen(false);
    resetForm();
  };

  const addField = () => setFields(prev => [...prev, emptyField()]);
  const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));

  const updateField = (idx: number, key: keyof TemplateField, value: any) => {
    setFields(prev => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const importFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (!data) return;

      let headers: string[] = [];

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (jsonData.length > 0) {
          headers = (jsonData[0] as any[]).map(h => String(h ?? '').trim()).filter(Boolean);
        }
      } else {
        const text = new TextDecoder().decode(data as ArrayBuffer);
        const [headerLine] = text.split(/\r?\n/);
        headers = headerLine
          .split(',')
          .map(h => h.replace(/"/g, '').trim())
          .filter(Boolean);
      }

      if (headers.length) {
        setFields(headers.map(h => ({ id: `tf_${Date.now()}_${h}`, name: h, description: '', required: true })));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-slate-500">Create stakeholder templates and map them to your schema.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExportMappings}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-800"
            disabled={!activeTemplateId}
          >
            <UploadCloud size={18} /> Export Mapping JSON
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700"
          >
            <Plus size={18} /> New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-slate-500">
            No templates yet. Create one to start mapping.
          </div>
        ) : (
          templates.map(template => (
            <div
              key={template.id}
              className={`bg-white p-6 rounded-xl border shadow-sm ${
                template.id === activeTemplateId ? 'border-indigo-500' : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{template.name}</h3>
                  <p className="text-xs text-slate-500">{template.stakeholder} • {template.frequency}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelectTemplate(template.id)}
                    className="text-indigo-600 hover:text-indigo-700"
                    title="Set active"
                  >
                    <Wand2 size={16} />
                  </button>
                  <button onClick={() => openEdit(template)} className="text-slate-400 hover:text-slate-600">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => setConfirmDelete(template.id)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{template.fields.length} fields</span>
                <span>{mappedCountForTemplate(template.id)} mapped</span>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Template' : 'New Template'}</h3>
              <p className="text-sm text-slate-500">Define the stakeholder fields you need to report.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Template Name</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Stakeholder</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                    value={stakeholder}
                    onChange={(e) => setStakeholder(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Frequency</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                  >
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Annual</option>
                    <option>Ad-hoc</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-500">Import CSV/Excel (headers)</label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) importFromFile(file);
                    }}
                    className={`mt-1 border-2 border-dashed rounded-xl p-4 text-center text-sm ${
                      dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p className="text-slate-500">Drag & drop CSV/XLSX here or click to browse</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) importFromFile(file);
                      }}
                      className="mt-3 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900">Fields</h4>
                  <button
                    onClick={addField}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                </div>

                {fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-xl">
                    <div className="md:col-span-4">
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2"
                        placeholder="Field name"
                        value={field.name}
                        onChange={(e) => updateField(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-5">
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2"
                        placeholder="Description"
                        value={field.description || ''}
                        onChange={(e) => updateField(idx, 'description', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.required ?? true}
                        onChange={(e) => updateField(idx, 'required', e.target.checked)}
                      />
                      <span className="text-xs text-slate-500">Required</span>
                    </div>
                    <div className="md:col-span-1 flex items-center justify-end">
                      <button
                        onClick={() => removeField(idx)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete template?"
        message="This will remove the template and its mappings."
        confirmText="Delete"
        isDangerous
        onConfirm={() => {
          if (confirmDelete) onDeleteTemplate(confirmDelete);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default Templates;
