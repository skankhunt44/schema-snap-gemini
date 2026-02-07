import React from 'react';

const Settings: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Configure API keys and local preferences.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-2">Gemini API Key</h3>
        <p className="text-sm text-slate-500 mb-4">
          Add <code className="bg-slate-100 px-2 py-1 rounded">GEMINI_API_KEY</code> to your <code className="bg-slate-100 px-2 py-1 rounded">.env</code>
          file in the repo root to enable AI explainability.
        </p>
        <p className="text-sm text-slate-500">
          This demo runs locally. No data is stored or shared.
        </p>
      </div>
    </div>
  );
};

export default Settings;
