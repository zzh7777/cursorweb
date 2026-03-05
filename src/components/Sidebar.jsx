import { useState, useRef, useEffect, useMemo } from 'react';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function getDateGroup(dateStr) {
  if (!dateStr) return '更早';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (d >= today) return '今天';
  if (d >= yesterday) return '昨天';
  if (d >= weekAgo) return '最近7天';
  return '更早';
}

function groupConversations(conversations) {
  const groups = new Map();
  const order = ['今天', '昨天', '最近7天', '更早'];
  for (const conv of conversations) {
    const group = getDateGroup(conv.updated_at);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(conv);
  }
  return order
    .filter((g) => groups.has(g))
    .map((g) => ({ label: g, items: groups.get(g) }));
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-zinc-900 border border-border rounded-xl w-full max-w-xs mx-4 shadow-2xl animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-200 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({ conv, isActive, onSelect, onDelete, onRename }) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conv.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleRenameSubmit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conv.title) {
      onRename(conv.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <div
      className={`
        group relative flex items-center gap-2 px-3 py-2.5 my-0.5 rounded-lg cursor-pointer transition-colors
        ${isActive ? 'bg-surface-active' : 'hover:bg-surface-hover'}
      `}
      onClick={() => !editing && onSelect(conv.id)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <svg className="w-4 h-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') { setEditing(false); setEditTitle(conv.title); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-zinc-800 border border-primary/50 rounded px-1.5 py-0.5 text-sm text-zinc-200
                       outline-none focus:border-primary"
          />
        ) : (
          <>
            <div className="text-sm truncate">{conv.title}</div>
            <div className="text-xs text-zinc-500">{formatTime(conv.updated_at)}</div>
          </>
        )}
      </div>

      {showActions && !editing && (
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Rename */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditTitle(conv.title);
              setEditing(true);
            }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="重命名"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conv.id, conv.title);
            }}
            className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
            title="删除"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename, onOpenSettings }) {
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => c.title?.toLowerCase().includes(q));
  }, [conversations, search]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  const handleDeleteRequest = (id, title) => {
    setConfirmDelete({ id, title });
  };

  const handleDeleteConfirm = () => {
    if (confirmDelete) {
      onDelete(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {confirmDelete && (
        <ConfirmDialog
          message={`确定要删除对话「${confirmDelete.title}」吗？此操作不可恢复。`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h1 className="text-base font-semibold">Cursor Web</h1>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="设置"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* New Chat button */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                     bg-primary hover:bg-primary-hover text-white font-medium
                     transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新对话
        </button>
      </div>

      {/* Search */}
      {conversations.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索对话..."
              className="w-full bg-zinc-800/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-200
                         placeholder-zinc-600 outline-none focus:border-primary/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-8 px-4">
            暂无对话，开始新的聊天吧
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-8 px-4">
            未找到匹配的对话
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={activeId === conv.id}
                  onSelect={onSelect}
                  onDelete={handleDeleteRequest}
                  onRename={onRename}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border text-xs text-zinc-500 text-center">
        Powered by Cursor CLI
      </div>
    </div>
  );
}
