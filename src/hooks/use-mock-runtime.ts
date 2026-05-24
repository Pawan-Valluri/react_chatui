import { useLocalRuntime, type ChatModelAdapter, type ThreadMessage } from "@assistant-ui/react";
import { useMemo } from "react";
import { BACKEND_CONFIG } from "../config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================================================================================
// SIMULATION HELPER GENERATOR
// ==================================================================================
// Streams reasoning text, tool state transitions (skeleton -> rich widget), and final text word-by-word.
async function* simulateStream(
  {
    reasoning,
    toolCall,
    reasoningAfter,
    finalText,
  }: {
    reasoning?: string;
    toolCall?: {
      name: string;
      id: string;
      args: any;
      result: any;
      loadingDelay?: number;
    };
    reasoningAfter?: string;
    finalText: string;
  },
  abortSignal: AbortSignal
) {
  let currentReasoning = "";
  let currentText = "";

  // 1. Stream thinking/reasoning process
  if (reasoning) {
    for (const word of reasoning.split(" ")) {
      if (abortSignal.aborted) return;
      currentReasoning += (currentReasoning ? " " : "") + word;
      yield { content: [{ type: "reasoning", text: currentReasoning }] };
      await sleep(15);
    }
    await sleep(250);
  }

  // 2. Stream tool call and result payload
  let activeToolCall: any = null;
  if (toolCall) {
    if (abortSignal.aborted) return;
    const initialText = toolCall.name === "getWeather" 
      ? `Checking current weather conditions for **${toolCall.args.location}**...`
      : toolCall.name === "getStockAnalysis"
      ? `Analyzing market metrics and historical data for ticker **${toolCall.args.symbol}**...`
      : `Searching global web indexes for: "${toolCall.args.query}"...`;
    
    currentText = initialText;
    activeToolCall = {
      type: "tool-call",
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      args: toolCall.args,
      argsText: JSON.stringify(toolCall.args)
    };

    // Yield skeleton loading animation state
    yield {
      content: [
        ...(reasoning ? [{ type: "reasoning", text: currentReasoning }] : []),
        { type: "text", text: currentText },
        activeToolCall
      ]
    };
    await sleep(toolCall.loadingDelay ?? 1500);

    // Yield tool call resolved with result payload to mount the rich widget
    activeToolCall = { ...activeToolCall, result: toolCall.result };
    yield {
      content: [
        ...(reasoning ? [{ type: "reasoning", text: currentReasoning }] : []),
        { type: "text", text: currentText },
        activeToolCall
      ]
    };
    await sleep(500);
  }

  // 3. Stream secondary reasoning process after tool resolves
  if (reasoningAfter) {
    currentReasoning += "\n\n";
    for (const word of reasoningAfter.split(" ")) {
      if (abortSignal.aborted) return;
      currentReasoning += (currentReasoning.endsWith("\n\n") || currentReasoning.endsWith(" ") ? "" : " ") + word;
      yield {
        content: [
          { type: "reasoning", text: currentReasoning },
          ...(currentText ? [{ type: "text", text: currentText }] : []),
          ...(activeToolCall ? [activeToolCall] : [])
        ]
      };
      await sleep(15);
    }
    await sleep(250);
  }

  // 4. Stream final synthesized explanation response
  if (finalText) {
    if (abortSignal.aborted) return;
    const prefix = currentText ? "\n\n" : "";
    let accumulatedFinal = "";
    for (const word of finalText.split(" ")) {
      if (abortSignal.aborted) return;
      accumulatedFinal += (accumulatedFinal ? " " : "") + word;
      yield {
        content: [
          ...(reasoning ? [{ type: "reasoning", text: currentReasoning }] : []),
          { type: "text", text: currentText + prefix + accumulatedFinal },
          ...(activeToolCall ? [activeToolCall] : [])
        ]
      };
      await sleep(20);
    }
  }
}

// ==================================================================================
// MOCK DATA GENERATORS
// ==================================================================================
function getWeatherMockData(location: string) {
  const loc = location.toLowerCase();
  if (loc.includes("london")) {
    return {
      location: "London", temp: "58°F", weather: "Light Showers", humidity: "82%", wind: "14 mph", uvIndex: "Low (2)",
      forecast: [
        { time: "Now", temp: "58°", icon: "cloud-rain" },
        { time: "2h", temp: "56°", icon: "cloud-rain" },
        { time: "4h", temp: "59°", icon: "cloud" },
        { time: "6h", temp: "55°", icon: "cloud" }
      ]
    };
  }
  if (loc.includes("tokyo")) {
    return {
      location: "Tokyo", temp: "68°F", weather: "Sunny & Calm", humidity: "40%", wind: "5 mph", uvIndex: "High (7)",
      forecast: [
        { time: "Now", temp: "68°", icon: "sun" },
        { time: "2h", temp: "72°", icon: "sun" },
        { time: "4h", temp: "73°", icon: "sun" },
        { time: "6h", temp: "65°", icon: "cloud" }
      ]
    };
  }
  return {
    location, temp: "72°F", weather: "Partly Cloudy", humidity: "48%", wind: "7 mph", uvIndex: "Moderate (5)",
    forecast: [
      { time: "Now", temp: "72°", icon: "cloud" },
      { time: "2h", temp: "74°", icon: "sun" },
      { time: "4h", temp: "70°", icon: "cloud-rain" },
      { time: "6h", temp: "66°", icon: "cloud" }
    ]
  };
}

function getStockMockData(symbol: string) {
  const sym = symbol.toUpperCase().trim();
  let name = "Apple Inc.", price = 178.45, change = 3.52, changePercent = "+2.01%", high = 179.12, low = 174.60, volume = "54.2M", recommendation = "Strong Buy";
  let points = [80, 75, 78, 70, 68, 62, 50, 48, 42, 38, 35];

  if (sym.includes("MSFT")) {
    name = "Microsoft Corporation"; price = 412.30; change = 8.15; changePercent = "+2.02%"; high = 415.00; low = 402.50; volume = "22.8M"; recommendation = "Buy";
    points = [85, 80, 82, 75, 70, 72, 60, 55, 48, 44, 40];
  } else if (sym.includes("TSLA")) {
    name = "Tesla, Inc."; price = 184.20; change = -4.35; changePercent = "-2.31%"; high = 191.00; low = 182.10; volume = "98.4M"; recommendation = "Hold";
    points = [30, 38, 42, 48, 55, 60, 65, 78, 80, 85, 90];
  } else if (sym.includes("NVDA")) {
    name = "NVIDIA Corporation"; price = 875.12; change = 24.50; changePercent = "+2.88%"; high = 880.00; low = 848.00; volume = "41.6M"; recommendation = "Strong Buy";
    points = [90, 85, 75, 68, 55, 48, 42, 35, 28, 20, 15];
  }
  return { symbol: sym, name, price, change, changePercent, high, low, volume, recommendation, points };
}

function getSearchMockData(query: string) {
  const q = query.toLowerCase();
  let summary = "Vite React projects leverage advanced ESM features for blazing fast hot module replacement (HMR). Standard configurations rely on plugins like @vitejs/plugin-react alongside modern layout systems.";
  let sources = [
    { name: "Vite Official Guide", url: "https://vite.dev", snippet: "Getting started with Vite React templates and asset optimization configs.", favicon: "" },
    { name: "React Docs", url: "https://react.dev", snippet: "Best practices for React components, Hooks API, and build tool chains.", favicon: "" },
    { name: "Tailwind CSS v4", url: "https://tailwindcss.com", snippet: "Integrating Tailwind v4 plugin-based builds inside modern compiler paths.", favicon: "" }
  ];

  if (q.includes("state") || q.includes("zustand") || q.includes("redux")) {
    summary = "Zustand is widely regarded as a high-performance, lightweight state management library for React. It offers simple hook-based APIs, avoids unnecessary re-renders, and acts as a robust replacement for heavier legacy frameworks like Redux in modern greenfield apps.";
    sources = [
      { name: "Zustand GitHub", url: "https://github.com/pmndrs/zustand", snippet: "Bearish small, fast and scalable bearbones state-management solution.", favicon: "" },
      { name: "NPM Package", url: "https://npmjs.com/package/zustand", snippet: "Download stats, package sizes, and developer installation guides.", favicon: "" },
      { name: "Dev.to Articles", url: "https://dev.to", snippet: "A comparison of React Context, Zustand, and Recoil in production environments.", favicon: "" }
    ];
  } else if (q.includes("next") || q.includes("vs") || q.includes("performance")) {
    summary = "Vite offers significantly faster development server start times and HMR because it serves source code over native ESM, delegating transpilation to the browser. Next.js excels at production-grade Server-Side Rendering (SSR), Static Site Generation (SSG), and unified API routing structures.";
    sources = [
      { name: "Vercel NextJS", url: "https://nextjs.org", snippet: "NextJS React framework docs detailing server components and file routing.", favicon: "" },
      { name: "Vite Configs", url: "https://vite.dev/config/", snippet: "Configuring build output directories, base assets, and environment variables.", favicon: "" },
      { name: "LogRocket Blog", url: "https://blog.logrocket.com", snippet: "Detailed benchmarks comparing Vite-bundled SPAs vs Next.js statically exported web apps.", favicon: "" }
    ];
  }
  return { query, summary, sourceCount: sources.length, sources };
}

// ==================================================================================
// CUSTOM MODEL RUNTIME HOOK
// ==================================================================================
export function useMockRuntime(threadId: string, initialMessages: any[]) {
  const stableInitialMessages = useMemo(() => initialMessages, [threadId]);

  const adapter = useMemo<ChatModelAdapter>(() => {
    return {
      async *run({ messages, abortSignal }) {
        if (messages.length === 0) return;
        console.log(`[Runtime:${threadId}] Run triggered with message history size: ${messages.length}`);

        // -------------------------------------------------------------
        // Option A: Live Python FastAPI Backend Stream NDJSON Protocol
        // -------------------------------------------------------------
        if (BACKEND_CONFIG.USE_BACKEND_API) {
          try {
            const parentId = messages.length > 1 ? messages[messages.length - 2].id : null;
            const response = await fetch(BACKEND_CONFIG.BACKEND_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                threadId,
                parentId,
                messages: messages.map(m => ({ 
                  id: m.id,
                  role: m.role, 
                  content: m.content 
                }))
              }),
              credentials: "include", // Essential for cookie-based SSO validation
              signal: abortSignal
            });

            if (!response.ok) throw new Error(`Server returned status code: ${response.status}`);
            const reader = response.body?.getReader();
            if (!reader) throw new Error("API stream body is not readable");

            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || ""; // Trailing chunk

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const data = JSON.parse(trimmed);
                if (data.content) yield { content: data.content };
              }
            }

            if (buffer.trim()) {
              const data = JSON.parse(buffer.trim());
              if (data.content) yield { content: data.content };
            }
            return;
          } catch (err: any) {
            console.error("FastAPI backend connection error:", err);
            yield {
              content: [
                {
                  type: "text",
                  text: `⚠️ **Failed to connect to Python backend**: ${err.message}\n\nPlease verify that your FastAPI server is running locally at \`${BACKEND_CONFIG.BACKEND_URL}\` (and has CORS headers enabled), or toggle \`USE_BACKEND_API: false\` inside \`src/config.ts\` to switch back to the offline standalone simulator.`
                }
              ]
            } as any;
            return;
          }
        }

        // -------------------------------------------------------------
        // Option B: Offline Simulated Client-Side Mocks (Consolidated)
        // -------------------------------------------------------------
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === "user") {
          const userText = (lastMessage.content?.find((p: any) => p.type === "text") as any)?.text || "";
          const normalized = userText.toLowerCase().trim();

          // Check keywords
          const isWeather = normalized.includes("weather") || normalized.startsWith("🌦️") || normalized.includes("paris") || normalized.includes("london") || normalized.includes("tokyo");
          const isStock = normalized.includes("stock") || normalized.startsWith("📈") || normalized.includes("aapl") || normalized.includes("msft") || normalized.includes("tsla") || normalized.includes("nvda");
          const isSearch = normalized.includes("search") || normalized.startsWith("🔍") || normalized.includes("perplexity") || normalized.includes("google") || normalized.includes("find");

          // 1. Weather flow
          if (isWeather) {
            let location = "Paris";
            if (normalized.includes("london")) location = "London";
            if (normalized.includes("tokyo")) location = "Tokyo";
            if (normalized.includes("new york")) location = "New York";

            const result = getWeatherMockData(location);
            yield* simulateStream({
              reasoning: `Thinking Process: The user is asking for the weather in ${location}. I should retrieve live meteorological and forecast conditions for this city. I will trigger the 'getWeather' tool with the location parameter set to '${location}' to retrieve current metrics.`,
              toolCall: { name: "getWeather", id: "call_weather_" + Date.now(), args: { location }, result },
              reasoningAfter: `Thinking Process: The tool 'getWeather' has executed successfully and returned the weather parameters. Let me analyze these details for ${location} and synthesize a clean, natural-language explanation for the user. I should make sure to highlight the key metrics and present them in a friendly, conversational manner.`,
              finalText: `Based on the latest data for **${location}**, it is currently **${result.weather}** with a temperature of **${result.temp}**. The humidity is **${result.humidity}** and wind speeds are at **${result.wind}**. We forecast pleasant conditions with mild uv indexes over the next few hours.`
            }, abortSignal);
            return;
          }

          // 2. Stock flow
          if (isStock) {
            let symbol = "AAPL";
            if (normalized.includes("msft")) symbol = "MSFT";
            if (normalized.includes("tsla")) symbol = "TSLA";
            if (normalized.includes("nvda")) symbol = "NVDA";

            const result = getStockMockData(symbol);
            yield* simulateStream({
              reasoning: `Thinking Process: The user is requesting a financial analysis of the stock ticker '${symbol}'. I have the 'getStockAnalysis' tool which retrieves live stock evaluations and historical data trends. Let me invoke 'getStockAnalysis' with the symbol set to '${symbol}'.`,
              toolCall: { name: "getStockAnalysis", id: "call_stock_" + Date.now(), args: { symbol }, result },
              reasoningAfter: `Thinking Process: The tool 'getStockAnalysis' has executed successfully. Let me analyze these financial parameters for ${symbol} and synthesize a clean, natural-language explanation for the user, highlighting current pricing, daily bounds, and indicators.`,
              finalText: `Financial analysis for **${symbol}** (${result.name}) is complete. The stock is currently trading at **$${result.price.toFixed(2)}** (${result.change >= 0 ? "+" : ""}${result.change} / ${result.changePercent}). Our custom local model maintains a rating of **${result.recommendation}** based on day indicators.`
            }, abortSignal);
            return;
          }

          // 3. Search flow
          if (isSearch) {
            let query = "Vite React styling best practices";
            const cleanQuery = userText.replace(/search|web|for|perplexity|google|find/gi, "").trim();
            if (cleanQuery.length > 2) query = cleanQuery;

            const result = getSearchMockData(query);
            yield* simulateStream({
              reasoning: `Thinking Process: The user wishes to execute a web index search for: "${query}". I will trigger the 'searchWeb' tool with query parameter set to '${query}' to fetch citation articles, snippet sources, and aggregated highlights.`,
              toolCall: { name: "searchWeb", id: "call_search_" + Date.now(), args: { query }, result },
              reasoningAfter: `Thinking Process: The tool 'searchWeb' has executed successfully. Let me analyze these aggregated citations and summarize search highlights in a helpful, conversational format.`,
              finalText: `I searched the web for "${query}" and summarized findings from **${result.sourceCount} sources**: ${result.summary}`
            }, abortSignal);
            return;
          }

          // 4. Default conversation replies
          let reply = "Hello! I am your premium AI assistant powered by `assistant-ui` and Vite. I'm completely responsive and style-optimized!";
          if (normalized.includes("hello") || normalized.includes("hi")) {
            reply = "Hello there! How can I help you today? Try typing 'weather in Paris' or click one of the quick chips below to test my tools!";
          } else if (normalized.includes("help") || normalized.includes("what can you do")) {
            reply = "Here's what I can do for you:\n- **🌦️ Fetch Weather Details**: Shows custom gradient cards for major cities.\n- **📈 Analyze Stocks**: Visualizes price movements with beautiful financial trend SVG graphs.\n- **🔍 Search the Web**: Mimics Perplexity results with search citation cards and favicons.\n- **💬 Maintain Thread History**: Saved locally in the sidebar for persistent workspace session context.";
          }

          yield* simulateStream({
            reasoning: `Thinking Process: The user sent a general message: '${userText}'. Since no local mock tools are needed for this query, I will construct a helpful natural language response. Let me formulate a reply explaining our current setup with assistant-ui and Vite.`,
            finalText: reply
          }, abortSignal);
        }
      }
    };
  }, [threadId]);

  const runtime = useLocalRuntime(adapter, {
    initialMessages: stableInitialMessages as ThreadMessage[]
  });

  return runtime;
}
