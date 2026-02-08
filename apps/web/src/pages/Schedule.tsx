import React from 'react';
import { Bell, Clock, AlertTriangle } from 'lucide-react';
import { Template } from '../types';

type Props = {
  templates: Template[];
  onRequestNotifications: () => void;
};

const getStatus = (nextDueDate?: string) => {
  if (!nextDueDate) return { label: 'No due date', color: 'text-slate-400' };
  const today = new Date();
  const due = new Date(nextDueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Overdue', color: 'text-rose-600' };
  if (diffDays <= 3) return { label: 'Due soon', color: 'text-amber-600' };
  return { label: 'On track', color: 'text-emerald-600' };
};

const Schedule: React.FC<Props> = ({ templates, onRequestNotifications }) => {
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule & Reminders</h1>
          <p className="text-slate-500">Track upcoming template deadlines and notifications.</p>
        </div>
        <button
          onClick={onRequestNotifications}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700"
        >
          <Bell size={18} /> Enable Browser Notifications
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Upcoming Deadlines</h3>
          <p className="text-sm text-slate-500">Based on template due dates and reminder settings.</p>
        </div>

        {templates.length === 0 ? (
          <div className="p-10 text-center text-slate-400">No templates yet. Create one to enable reminders.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Template</th>
                  <th className="px-6 py-4">Stakeholder</th>
                  <th className="px-6 py-4">Next Due</th>
                  <th className="px-6 py-4">Reminders</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map(template => {
                  const status = getStatus(template.nextDueDate);
                  return (
                    <tr key={template.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{template.name}</td>
                      <td className="px-6 py-4 text-slate-600">{template.stakeholder}</td>
                      <td className="px-6 py-4 text-slate-600">{template.nextDueDate || '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{(template.reminderDays || []).join(', ') || '—'}</td>
                      <td className={`px-6 py-4 font-medium ${status.color}`}>{status.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedule;
