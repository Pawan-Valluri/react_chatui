export interface MessagePart {
  type: "text" | "tool-call" | "tool-result";
  text?: string;
  toolName?: string;
  toolCallId?: string;
  args?: any;
  result?: any;
}

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: MessagePart[];
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  messages: ThreadMessage[];
}

const THREADS_KEY = "premium-chat-threads";
const ACTIVE_THREAD_ID_KEY = "premium-chat-active-thread-id";

export function getThreads(): ChatThread[] {
  try {
    const data = localStorage.getItem(THREADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading threads from local storage", e);
    return [];
  }
}

export function saveThreads(threads: ChatThread[]): void {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch (e) {
    console.error("Error writing threads to local storage", e);
  }
}

export function getActiveThreadId(): string | null {
  return localStorage.getItem(ACTIVE_THREAD_ID_KEY);
}

export function setActiveThreadId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_THREAD_ID_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_THREAD_ID_KEY);
  }
}

export function createNewThread(title = "New Chat"): ChatThread {
  const newThread: ChatThread = {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    messages: []
  };
  const threads = getThreads();
  threads.unshift(newThread);
  saveThreads(threads);
  setActiveThreadId(newThread.id);
  return newThread;
}

export function updateThreadMessages(threadId: string, messages: any[]): void {
  const threads = getThreads();
  const index = threads.findIndex(t => t.id === threadId);
  if (index !== -1) {
    threads[index].messages = messages.map(m => ({
      id: m.id || crypto.randomUUID(),
      role: m.role,
      content: m.content || []
    }));
    
    // Auto-generate title from the first user message if it's currently "New Chat"
    if (threads[index].title === "New Chat" && messages.length > 0) {
      const firstUserMessage = messages.find(m => m.role === "user");
      if (firstUserMessage) {
        const textContent = firstUserMessage.content.find((p: any) => p.type === "text")?.text || "";
        if (textContent) {
          threads[index].title = textContent.slice(0, 30) + (textContent.length > 30 ? "..." : "");
        }
      }
    }
    
    saveThreads(threads);
  }
}

export function deleteThread(threadId: string): string | null {
  let threads = getThreads();
  threads = threads.filter(t => t.id !== threadId);
  saveThreads(threads);
  
  if (getActiveThreadId() === threadId) {
    const nextActive = threads[0]?.id || null;
    setActiveThreadId(nextActive);
    return nextActive;
  }
  return getActiveThreadId();
}

export function renameThread(threadId: string, newTitle: string): void {
  const threads = getThreads();
  const index = threads.findIndex(t => t.id === threadId);
  if (index !== -1) {
    threads[index].title = newTitle;
    saveThreads(threads);
  }
}
