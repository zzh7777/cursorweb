import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';

const API = '/api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ConnectionBadge({ status }) {
  if (!status) return null;
  const color = status.connected ? 'bg-green-500' : status.configured ? 'bg-amber-500' : 'bg-zinc-500';
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400" title={status.message}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span>{status.connected ? 'MySQL 已连接' : status.configured ? '连接失败' : 'MySQL 未配置'}</span>
    </div>
  );
}

function ResultTable({ result, onClose }) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-red-400">执行错误</span>
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">关闭</button>
        </div>
        <p className="text-xs text-red-300">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-hover/50 border-b border-border">
        <span className="text-xs text-zinc-400">
          {result.row_count} 条结果
          {result.elapsed_seconds !== undefined && ` · ${result.elapsed_seconds}s`}
          {result.truncated && ' · 已截断'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(result)}
            className="text-xs text-primary hover:text-primary-hover cursor-pointer"
          >
            导出 CSV
          </button>
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">关闭</button>
        </div>
      </div>
      {result.row_count > 0 ? (
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-hover/30 sticky top-0">
                {result.columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-zinc-400 font-medium whitespace-nowrap border-b border-border">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/20">
                  {result.columns.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-zinc-300 whitespace-nowrap max-w-[300px] truncate">
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-zinc-600">NULL</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-xs text-zinc-500">查询无结果</div>
      )}
    </div>
  );
}

function exportCSV(result) {
  if (!result?.columns?.length) return;
  const header = result.columns.join(',');
  const rows = result.rows.map((r) =>
    result.columns.map((c) => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rules_result_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EditRuleDialog({ rule, onSave, onClose }) {
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description || '');
  const [category, setCategory] = useState(rule.category || '');
  const [sqlCode, setSqlCode] = useState(rule.sql_code);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !sqlCode.trim()) return;
    setSaving(true);
    try {
      await onSave(rule.id, { name: name.trim(), description: description.trim(), category: category.trim(), sql_code: sqlCode.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-zinc-900 border border-border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">编辑规则</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover text-zinc-400 hover:text-zinc-200 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">规则名称 *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                           outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">分类</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                           outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">描述</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-200
                         outline-none focus:border-primary/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">SQL 代码 *</label>
            <textarea value={sqlCode} onChange={(e) => setSqlCode(e.target.value)} rows={12}
              className="w-full bg-[#1e1e2e] border border-border rounded-lg px-3 py-2 text-[13px] text-zinc-200
                         font-mono outline-none focus:border-primary/50 transition-colors resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover transition-colors cursor-pointer">
            取消
          </button>
          <button onClick={handleSave} disabled={!name.trim() || !sqlCode.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover text-white
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ rule, onEdit, onDelete, onToggle, onRun, runResult, onClearResult }) {
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      await onRun(rule.id);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border border-border rounded-xl bg-surface overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-200 truncate">{rule.name}</h3>
              {rule.category && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                  {rule.category}
                </span>
              )}
            </div>
            {rule.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{rule.description}</p>}
            <div className="text-[11px] text-zinc-600 mt-1">{formatTime(rule.updated_at)}</div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle enabled */}
            <button onClick={() => onToggle(rule.id, rule.enabled ? 0 : 1)}
              className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer
                ${rule.enabled ? 'bg-primary' : 'bg-zinc-700'}`}
              title={rule.enabled ? '已启用' : '已禁用'}>
              <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform shadow
                ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>

            {/* Run */}
            <button onClick={handleRun} disabled={running}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer disabled:opacity-40"
              title="运行">
              {running ? (
                <div className="w-3.5 h-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Edit */}
            <button onClick={() => onEdit(rule)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover transition-colors cursor-pointer"
              title="编辑">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {/* Delete */}
            <button onClick={() => onDelete(rule.id)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="删除">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* SQL preview */}
        <button onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-left cursor-pointer">
          <pre className={`text-[11px] text-zinc-500 font-mono bg-[#1e1e2e] rounded-lg px-3 py-2 ${expanded ? '' : 'max-h-[60px]'} overflow-hidden`}>
            {rule.sql_code}
          </pre>
        </button>
      </div>

      {runResult && <div className="px-4 pb-3"><ResultTable result={runResult} onClose={onClearResult} /></div>}
    </div>
  );
}

export default forwardRef(function RulesPanel(_props, ref) {
  const [rules, setRules] = useState([]);
  const [mysqlStatus, setMysqlStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [runResults, setRunResults] = useState({});
  const [runningAll, setRunningAll] = useState(false);
  const [allResults, setAllResults] = useState(null);

  const fetchRules = useCallback(async () => {
    const res = await fetch(`${API}/rules`);
    const data = await res.json();
    setRules(data);
  }, []);

  useImperativeHandle(ref, () => ({ refresh: fetchRules }), [fetchRules]);

  const fetchMysqlStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/rules/mysql-status`);
      const data = await res.json();
      setMysqlStatus(data);
    } catch {
      setMysqlStatus({ configured: false, connected: false, message: '无法检查连接' });
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchMysqlStatus();
  }, [fetchRules, fetchMysqlStatus]);

  const handleUpdateRule = async (id, fields) => {
    await fetch(`${API}/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    fetchRules();
  };

  const handleToggle = async (id, enabled) => {
    await handleUpdateRule(id, { enabled });
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/rules/${id}`, { method: 'DELETE' });
    setRunResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
    fetchRules();
  };

  const handleRunSingle = async (id) => {
    const res = await fetch(`${API}/rules/${id}/run`, { method: 'POST' });
    const data = await res.json();
    setRunResults((prev) => ({ ...prev, [id]: data }));
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    setAllResults(null);
    try {
      const res = await fetch(`${API}/rules/run-all`, { method: 'POST' });
      const data = await res.json();
      setAllResults(data);
      const byId = {};
      for (const r of data) byId[r.rule_id] = r;
      setRunResults(byId);
    } finally {
      setRunningAll(false);
    }
  };

  const filtered = search.trim()
    ? rules.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase())
        || (r.category || '').toLowerCase().includes(search.trim().toLowerCase()))
    : rules;

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">规则管理</h1>
              <p className="text-xs text-zinc-500 mt-0.5">{rules.length} 条规则 · {enabledCount} 条已启用</p>
            </div>
            <div className="flex items-center gap-3">
              <ConnectionBadge status={mysqlStatus} />
              <button
                onClick={handleRunAll}
                disabled={runningAll || enabledCount === 0 || !mysqlStatus?.connected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {runningAll ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
                {runningAll ? '运行中...' : `运行全部 (${enabledCount})`}
              </button>
            </div>
          </div>

          {/* Search */}
          {rules.length > 0 && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索规则名称或分类..."
                className="w-full bg-surface border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-200
                           placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* Run-all summary */}
      {allResults && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-200">批量执行结果</h3>
              <button onClick={() => setAllResults(null)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">关闭</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-surface-hover/50">
                <div className="text-lg font-semibold text-zinc-200">{allResults.length}</div>
                <div className="text-[11px] text-zinc-500">执行总数</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-500/10">
                <div className="text-lg font-semibold text-green-400">{allResults.filter((r) => !r.error).length}</div>
                <div className="text-[11px] text-zinc-500">成功</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-500/10">
                <div className="text-lg font-semibold text-red-400">{allResults.filter((r) => r.error).length}</div>
                <div className="text-[11px] text-zinc-500">失败</div>
              </div>
            </div>
            <div className="mt-3 space-y-1 max-h-[200px] overflow-auto">
              {allResults.map((r) => (
                <div key={r.rule_id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-surface-hover/30">
                  <span className="text-zinc-300 truncate">{r.rule_name}</span>
                  <span className={r.error ? 'text-red-400' : 'text-green-400'}>
                    {r.error ? '失败' : `${r.row_count} 条`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="max-w-4xl mx-auto px-6 py-4 space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-300 mb-1">暂无规则</h2>
            <p className="text-sm text-zinc-500">在对话中让 AI 生成 SQL，然后点击代码块上的「保存为规则」按钮</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">未找到匹配的规则</div>
        ) : (
          filtered.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={setEditingRule}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onRun={handleRunSingle}
              runResult={runResults[rule.id]}
              onClearResult={() => setRunResults((prev) => { const next = { ...prev }; delete next[rule.id]; return next; })}
            />
          ))
        )}
      </div>

      {editingRule && (
        <EditRuleDialog
          rule={editingRule}
          onSave={handleUpdateRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
})
