import { useEffect } from "react";
import { AssistantRuntimeProvider, useAuiState } from "@assistant-ui/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Thread } from "@/components/assistant-ui/thread";
import { WeatherTool } from "./custom-tools/WeatherWidget";
import { StockTool } from "./custom-tools/StockWidget";
import { SearchTool } from "./custom-tools/SearchWidget";
import { useMockRuntime } from "../hooks/use-mock-runtime";
import { getThreadDetail, syncThreadTree } from "../utils/storage";
import { Menu, Sparkles } from "lucide-react";

// Sub-component to trigger Sidebar re-rendering after streaming runs complete
function ChatMessagesSync({
  onMessagesChange
}: {
  onMessagesChange: () => void;
}) {
  const isRunning = useAuiState((s) => s.thread.isRunning);

  useEffect(() => {
    if (!isRunning) {
      onMessagesChange();
    }
  }, [isRunning, onMessagesChange]);

  return null;
}

interface ChatInterfaceProps {
  activeThreadId: string;
  initialMessages: any[];
  threadTitle: string;
  onToggleSidebar: () => void;
  onNewThread: () => void;
  onMessagesChange: () => void;
}

export function ChatInterface({
  activeThreadId,
  initialMessages,
  threadTitle,
  onToggleSidebar,
  onMessagesChange
}: ChatInterfaceProps) {
  // Initialize the runtime inside the keyed component for thread isolation!
  const runtime = useMockRuntime(activeThreadId, initialMessages);

  // Rehydrate the entire branching context from PostgreSQL on mount/change
  useEffect(() => {
    if (!activeThreadId) return;
    let active = true;

    const loadThreadTree = async () => {
      try {
        const data = await getThreadDetail(activeThreadId);
        if (!active) return;
        
        if (data && data.messages && data.messages.length > 0) {
          runtime.thread.import({
            headId: data.headId,
            messages: data.messages
          });
        }
      } catch (err) {
        console.error("Failed to rehydrate thread tree from database:", err);
      }
    };

    loadThreadTree();
    return () => {
      active = false;
    };
  }, [activeThreadId, runtime]);

  // Subscribe to all local runtime changes (edits, branch switches, new messages) and synchronize tree state
  useEffect(() => {
    if (!activeThreadId || !runtime) return;

    let timeoutId: any;

    const unsubscribe = runtime.thread.subscribe(() => {
      clearTimeout(timeoutId);

      // Debounce sync transactions to ensure performance
      timeoutId = setTimeout(async () => {
        try {
          const exported = runtime.thread.export();
          if (exported && exported.messages && exported.messages.length > 0) {
            await syncThreadTree(activeThreadId, exported.headId, exported.messages);
            onMessagesChange(); // Refresh sidebar titles
          }
        } catch (err) {
          console.error("Failed to synchronize active thread tree to database:", err);
        }
      }, 300);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [activeThreadId, runtime, onMessagesChange]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Mount custom tools for automatic UI registration */}
      <WeatherTool />
      <StockTool />
      <SearchTool />

      {/* Sync sidebar session titles on changes */}
      <ChatMessagesSync
        onMessagesChange={onMessagesChange}
      />

      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-border/40 px-6 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-sans font-bold text-sm md:text-base text-foreground truncate max-w-[200px] md:max-w-xs leading-none">
                {threadTitle || "Chat Session"}
              </h2>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase mt-1 tracking-wider">
                AuthBlue Secure Node
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted border border-border px-3 py-1.5 rounded-full select-none">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>Postgres Context Saver Active</span>
          </div>
        </header>

        {/* Viewport: Messages area displaying totally default template thread */}
        <div className="flex-1 overflow-hidden relative">
          <TooltipProvider>
            <Thread />
          </TooltipProvider>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
