import { useState } from "react";
import type { MouseEvent, KeyboardEvent } from "react";
import { MessageSquare, Plus, Trash2, Edit2, Check, X, Menu, Bot } from "lucide-react";
import type { ChatThread } from "../utils/storage";

interface SidebarProps {
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  user: any; // Dynamic SSO Authenticated User
}

export function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  isOpen,
  onToggle,
  user
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEditing = (thread: ChatThread, e: MouseEvent) => {
    e.stopPropagation();
    setEditingId(thread.id);
    setEditTitle(thread.title);
  };

  const cancelEditing = (e: MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const saveEdit = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameThread(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (id: string, e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editTitle.trim()) {
        onRenameThread(id, editTitle.trim());
      }
      setEditingId(null);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  return (
    <>
      {/* Mobile Sidebar Toggle Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0b0c10]/80 backdrop-blur-md sticky top-0 z-40 w-full">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <span className="font-display font-semibold text-lg text-white">Antigravity Chat</span>
        </div>
        <button
          onClick={onNewThread}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/10"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay to close sidebar on mobile click */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 shrink-0 bg-[#0b0c10] border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0 ml-0" : "-translate-x-full md:-ml-72"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <span className="font-display font-bold text-lg text-white tracking-wide">
              Antigravity AI
            </span>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onNewThread();
              if (window.innerWidth < 768) onToggle();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 group active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1.5 scrollbar-thin">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            History
          </div>

          {threads.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center italic">
              No conversations yet.
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              const isEditing = thread.id === editingId;

              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectThread(thread.id);
                      if (window.innerWidth < 768) onToggle();
                    }
                  }}
                  className={`group relative flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                    isActive
                      ? "bg-blue-600/10 border-blue-500/25 text-white"
                      : "bg-transparent border-transparent hover:bg-white/[0.03] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-4.5 h-4.5 shrink-0 ${
                        isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400"
                      }`}
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(thread.id, e)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-sm font-medium truncate pr-1">
                        {thread.title}
                      </span>
                    )}
                  </div>

                  {/* Actions overlay */}
                  {!isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 shrink-0 transition-opacity">
                      <button
                        onClick={(e) => startEditing(thread, e)}
                        className="p-1 rounded-md hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
                        title="Rename Chat"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.id);
                        }}
                        className="p-1 rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => saveEdit(thread.id, e)}
                        className="p-1 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-1 rounded-md bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 p-0.5 shrink-0">
            <div className="w-full h-full rounded-full bg-[#0b0c10] flex items-center justify-center text-xs font-bold text-white uppercase tracking-wider">
              {user && user.firstname ? (user.firstname[0] + (user.lastname ? user.lastname[0] : "")) : "DG"}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user ? user.fullname : "Developer Guest"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user && user.groups && user.groups.includes("SSO_APP_ADMIN") ? "System Admin" : "Amex Centurion Member"}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
