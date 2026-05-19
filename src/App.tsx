import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatInterface } from "./components/ChatInterface";
import {
  getThreads,
  getActiveThreadId,
  setActiveThreadId,
  createNewThread,
  updateThreadMessages,
  deleteThread,
  renameThread
} from "./utils/storage";
import type { ChatThread } from "./utils/storage";

function App() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadStateId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initialize threads from local storage on mount
  useEffect(() => {
    let storedThreads = getThreads();
    let storedActiveId = getActiveThreadId();

    if (storedThreads.length === 0) {
      const defaultThread = createNewThread("New Chat");
      storedThreads = [defaultThread];
      storedActiveId = defaultThread.id;
    } else if (!storedActiveId || !storedThreads.some((t) => t.id === storedActiveId)) {
      storedActiveId = storedThreads[0].id;
      setActiveThreadId(storedActiveId);
    }

    setThreads(storedThreads);
    setActiveThreadStateId(storedActiveId);
  }, []);

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    setActiveThreadStateId(id);
  };

  const handleNewThread = () => {
    const newThread = createNewThread("New Chat");
    setThreads(getThreads());
    setActiveThreadStateId(newThread.id);
  };

  const handleDeleteThread = (id: string) => {
    const nextActiveId = deleteThread(id);
    setThreads(getThreads());
    setActiveThreadStateId(nextActiveId);
  };

  const handleRenameThread = (id: string, newTitle: string) => {
    renameThread(id, newTitle);
    setThreads(getThreads());
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Find active thread details
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const initialMessages = activeThread ? activeThread.messages : [];
  const threadTitle = activeThread ? activeThread.title : "Chat Session";

  // Callback to persist messages inside storage and sync sidebar thread titles
  const handleMessagesChange = useCallback(
    (newMessages: readonly any[]) => {
      if (!activeThreadId) return;

      // Persist messages in localStorage
      updateThreadMessages(activeThreadId, newMessages as any[]);

      // Sync threads state to update Sidebar titles in real-time!
      setThreads(getThreads());
    },
    [activeThreadId]
  );

  return (
    <div className="dark flex h-screen w-screen bg-background overflow-hidden text-foreground antialiased font-sans">
      {/* Sidebar history manager */}
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={handleRenameThread}
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
      />

      {/* Main Chat Interface */}
      {/* key={activeThreadId} isolates component lifecycles to avoid switching race conditions */}
      {activeThreadId && (
        <ChatInterface
          key={activeThreadId}
          activeThreadId={activeThreadId}
          initialMessages={initialMessages}
          threadTitle={threadTitle}
          onToggleSidebar={handleToggleSidebar}
          onNewThread={handleNewThread}
          onMessagesChange={handleMessagesChange}
        />
      )}
    </div>
  );
}

export default App;
