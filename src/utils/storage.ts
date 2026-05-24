import { BACKEND_CONFIG } from "../config";

export interface MessagePart {
  type: "text" | "tool-call" | "tool-result" | "reasoning";
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

// REST Client Helper ensuring cookie pass-through for SSO
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${BACKEND_CONFIG.BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Crucial for SSO cookies
  });
  
  if (!response.ok) {
    throw new Error(`API returned status ${response.status}`);
  }
  
  return response.json();
}

export async function getThreads(): Promise<ChatThread[]> {
  try {
    const list = await apiFetch("/threads");
    return list || [];
  } catch (e) {
    console.error("Error reading threads from backend", e);
    return [];
  }
}

export async function getThreadDetail(threadId: string): Promise<any> {
  try {
    return await apiFetch(`/threads/${threadId}`);
  } catch (e) {
    console.error(`Error loading thread detail for ${threadId}`, e);
    return null;
  }
}

export async function createNewThread(title = "New Chat"): Promise<ChatThread> {
  const newThread: ChatThread = {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    messages: []
  };
  
  try {
    await apiFetch("/threads", {
      method: "POST",
      body: JSON.stringify({
        id: newThread.id,
        title: newThread.title,
        createdAt: newThread.createdAt
      }),
    });
  } catch (e) {
    console.error("Error creating new thread on backend", e);
  }
  
  return newThread;
}

export async function deleteThread(threadId: string): Promise<void> {
  try {
    await apiFetch(`/threads/${threadId}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.error(`Error deleting thread ${threadId}`, e);
  }
}

export async function renameThread(threadId: string, newTitle: string): Promise<void> {
  try {
    await apiFetch(`/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
    });
  } catch (e) {
    console.error(`Error renaming thread ${threadId}`, e);
  }
}

// Synchronize frontend branch tree modifications back to PostgreSQL
export async function syncThreadTree(threadId: string, headId: string | null, messages: any[]): Promise<void> {
  try {
    await apiFetch(`/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ headId, messages }),
    });
  } catch (e) {
    console.error(`Error syncing thread tree for ${threadId}`, e);
  }
}

export async function getUserProfile(): Promise<any> {
  try {
    return await apiFetch("/user/me");
  } catch (e) {
    console.error("Error fetching user session profile", e);
    return null;
  }
}
