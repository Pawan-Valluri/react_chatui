import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatInterface } from "./components/ChatInterface";
import {
  getThreads,
  createNewThread,
  deleteThread,
  renameThread,
  getUserProfile,
  type ChatThread
} from "./utils/storage";

function App() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadStateId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);

  // Initialize threads from backend REST service on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Load active SSO profile
        const profile = await getUserProfile();
        setUser(profile);

        // 2. Load threads from Postgres
        let storedThreads = await getThreads();

        if (storedThreads.length === 0) {
          const defaultThread = await createNewThread("New Chat");
          storedThreads = [defaultThread];
        }

        setThreads(storedThreads);

        // 3. Keep active thread ID purely in tab session state (clear on close)
        let activeId = sessionStorage.getItem("premium-chat-active-thread-id");
        if (!activeId || !storedThreads.some((t) => t.id === activeId)) {
          activeId = storedThreads[0].id;
          sessionStorage.setItem("premium-chat-active-thread-id", activeId);
        }
        
        setActiveThreadStateId(activeId);
      } catch (err) {
        console.error("Failed to initialize application session state:", err);
      }
    };

    initApp();
  }, []);

  const handleSelectThread = (id: string) => {
    sessionStorage.setItem("premium-chat-active-thread-id", id);
    setActiveThreadStateId(id);
  };

  const handleNewThread = async () => {
    try {
      const newThread = await createNewThread("New Chat");
      const allThreads = await getThreads();
      setThreads(allThreads);
      sessionStorage.setItem("premium-chat-active-thread-id", newThread.id);
      setActiveThreadStateId(newThread.id);
    } catch (err) {
      console.error("Failed to create new thread session:", err);
    }
  };

  const handleDeleteThread = async (id: string) => {
    try {
      await deleteThread(id);
      const allThreads = await getThreads();
      setThreads(allThreads);
      
      const currentActiveId = sessionStorage.getItem("premium-chat-active-thread-id");
      let nextActiveId = currentActiveId;
      
      if (currentActiveId === id) {
        nextActiveId = allThreads[0]?.id || null;
        if (nextActiveId) {
          sessionStorage.setItem("premium-chat-active-thread-id", nextActiveId);
        } else {
          sessionStorage.removeItem("premium-chat-active-thread-id");
        }
      }
      setActiveThreadStateId(nextActiveId);
    } catch (err) {
      console.error("Failed to delete thread session:", err);
    }
  };

  const handleRenameThread = async (id: string, newTitle: string) => {
    try {
      await renameThread(id, newTitle);
      const allThreads = await getThreads();
      setThreads(allThreads);
    } catch (err) {
      console.error("Failed to rename thread session:", err);
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Dynamic thread settings fetched from backend
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const threadTitle = activeThread ? activeThread.title : "Chat Session";

  // Callback triggers after an agent interaction completes to sync thread titles
  const handleMessagesChange = useCallback(
    () => {
      if (!activeThreadId) return;
      getThreads().then((allThreads) => {
        setThreads(allThreads);
      });
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
        user={user}
      />

      {/* Main Chat Interface */}
      {activeThreadId && (
        <ChatInterface
          key={activeThreadId}
          activeThreadId={activeThreadId}
          initialMessages={[]} // Rehydrated dynamically by tree GET api in ChatInterface
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
