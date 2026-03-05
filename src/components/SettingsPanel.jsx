import { useState } from 'react';

export default function SettingsPanel({ settings, onSave, onClose }) {
  const [backend, setBackend] = useState(settings.backend || 'cursor');
  const [model, setModel] = useState(settings.model || '');
  const [customModel, setCustomModel] = useState('');

  const models = backend === 'cursor'
    ? (settings.cursor_models || [])
    : (settings.opencode_models || []);

  const isCustom = model === '__custom__';

  const handleSave = () => {
    const finalModel = isCustom ? customModel.trim() : model;
    if (!finalModel) return;
    onSave({ backend, model: finalModel });
  };

  const handleBackendChange = (newBackend) => {
    setBackend(newBackend);
    const newModels = newBackend === 'cursor'
      ? (settings.cursor_models || [])
      : (settings.opencode_models || []);
    if (newModels.length > 0) {
      setModel(newModels[0].id);
    }
    setCustomModel('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">设置</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">后端 CLI</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cursor', label: 'Cursor', desc: '使用 Cursor 账号认证' },
                { id: 'opencode', label: 'OpenCode', desc: '需要配置 API Key' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleBackendChange(opt.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-sm transition-colors cursor-pointer
                    ${backend === opt.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface hover:bg-surface-hover text-zinc-300'
                    }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[11px] text-zinc-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">模型</label>
            <select
              value={isCustom ? '__custom__' : model}
              onChange={(e) => {
                setModel(e.target.value);
                if (e.target.value !== '__custom__') setCustomModel('');
              }}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                         focus:outline-none focus:border-primary/50 transition-colors"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__custom__">自定义模型...</option>
            </select>

            {isCustom && (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={backend === 'cursor' ? 'e.g. claude-4.6-opus' : 'e.g. openai/gpt-4o'}
                className="w-full mt-2 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                           placeholder-zinc-600 focus:outline-none focus:border-primary/50 transition-colors"
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isCustom && !customModel.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
