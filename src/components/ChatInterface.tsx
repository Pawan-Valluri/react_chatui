import { useEffect } from "react";
import { AssistantRuntimeProvider, useAuiState } from "@assistant-ui/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Thread } from "@/components/assistant-ui/thread";
import { WeatherTool } from "./custom-tools/WeatherWidget";
import { StockTool } from "./custom-tools/StockWidget";
import { SearchTool } from "./custom-tools/SearchWidget";
import { useMockRuntime } from "../hooks/use-mock-runtime";
import { Menu, Sparkles } from "lucide-react";

// Sub-component to sync runtime message states back to App's local storage
function ChatMessagesSync({
  initialMessagesCount,
  onMessagesChange
}: {
  initialMessagesCount: number;
  onMessagesChange: (messages: readonly any[]) => void;
}) {
  const messages = useAuiState((s) => s.thread.messages);
  const isRunning = useAuiState((s) => s.thread.isRunning);

  useEffect(() => {
    if (isRunning) return; // Skip syncing during active streaming/thinking to prevent render loops!

    // Only sync if messages exist and we have actually added new messages beyond the initial mount state
    if (messages && messages.length > initialMessagesCount) {
      onMessagesChange(messages);
    }
  }, [messages, isRunning, initialMessagesCount, onMessagesChange]);

  return null;
}

interface ChatInterfaceProps {
  activeThreadId: string;
  initialMessages: any[];
  threadTitle: string;
  onToggleSidebar: () => void;
  onNewThread: () => void;
  onMessagesChange: (messages: readonly any[]) => void;
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

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Mount custom tools for automatic UI registration */}
      <WeatherTool />
      <StockTool />
      <SearchTool />

      {/* Sync history on change */}
      <ChatMessagesSync
        initialMessagesCount={initialMessages.length}
        onMessagesChange={onMessagesChange}
      />

      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-border/40 px-6 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-sans font-bold text-sm md:text-base text-foreground truncate max-w-[200px] md:max-w-xs leading-none">
                {threadTitle || "Chat Session"}
              </h2>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase mt-1 tracking-wider">
                Local Engine Ready
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted border border-border px-3 py-1.5 rounded-full select-none">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span>Local Engine Active</span>
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
