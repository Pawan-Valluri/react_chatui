import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from "zod";
import { Search, Globe, Link2, BookOpen } from "lucide-react";

// Define the simulated web search tool
const searchTool = tool({
  description: "Execute a web index lookup to retrieve the latest articles, citations, and aggregated results.",
  parameters: z.object({
    query: z.string().describe("The search query parameters to search for."),
  }),
  execute: async ({ query }) => {
    // Simulate real web search network latency
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Seed mock search sources based on query details
    const qLower = query.toLowerCase();
    let summary = "Vite React projects leverage advanced ESM features for blazing fast hot module replacement (HMR). Standard configurations rely on plugins like @vitejs/plugin-react alongside modern layout systems.";
    let sources = [
      { name: "Vite Official Guide", url: "https://vite.dev", snippet: "Getting started with Vite React templates and asset optimization configs.", favicon: "https://vite.dev/logo.svg" },
      { name: "React Docs", url: "https://react.dev", snippet: "Best practices for React components, Hooks API, and build tool chains.", favicon: "https://react.dev/favicon.ico" },
      { name: "Tailwind CSS v4", url: "https://tailwindcss.com", snippet: "Integrating Tailwind v4 plugin-based builds inside modern compiler paths.", favicon: "https://tailwindcss.com/favicons/favicon.ico" }
    ];

    if (qLower.includes("state") || qLower.includes("zustand") || qLower.includes("redux")) {
      summary = "Zustand is widely regarded as a high-performance, lightweight state management library for React. It offers simple hook-based APIs, avoids unnecessary re-renders, and acts as a robust replacement for heavier legacy frameworks like Redux in modern greenfield apps.";
      sources = [
        { name: "Zustand GitHub", url: "https://github.com/pmndrs/zustand", snippet: "Bearish small, fast and scalable bearbones state-management solution.", favicon: "https://github.com/favicon.ico" },
        { name: "NPM Package", url: "https://npmjs.com/package/zustand", snippet: "Download stats, package sizes, and developer installation guides.", favicon: "https://www.npmjs.com/static/images/touch-icons/favicon-32x32.png" },
        { name: "Dev.to Articles", url: "https://dev.to", snippet: "A comparison of React Context, Zustand, and Recoil in production environments.", favicon: "https://dev.to/favicon.ico" }
      ];
    } else if (qLower.includes("next") || qLower.includes("vs") || qLower.includes("performance")) {
      summary = "Vite offers significantly faster development server start times and HMR because it serves source code over native ESM, delegating transpilation to the browser. Next.js excels at production-grade Server-Side Rendering (SSR), Static Site Generation (SSG), and unified API routing structures.";
      sources = [
        { name: "Vercel NextJS", url: "https://nextjs.org", snippet: "NextJS React framework docs detailing server components and file routing.", favicon: "https://nextjs.org/favicon.ico" },
        { name: "Vite Configs", url: "https://vite.dev/config/", snippet: "Configuring build output directories, base assets, and environment variables.", favicon: "https://vite.dev/logo.svg" },
        { name: "LogRocket Blog", url: "https://blog.logrocket.com", snippet: "Detailed benchmarks comparing Vite-bundled SPAs vs Next.js statically exported web apps.", favicon: "https://blog.logrocket.com/favicon.ico" }
      ];
    }

    return { query, summary, sourceCount: sources.length, sources };
  }
});

interface SearchWidgetProps {
  result: any;
  status: { type: string };
}

export function SearchWidget({ result, status }: SearchWidgetProps) {
  const isRunning = status.type === "running";

  if (isRunning) {
    return (
      <div className="w-full max-w-md bg-[#111318] border-white/10 rounded-2xl p-5 border border-blue-500/20 animate-pulse-border my-2">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-blue-400 animate-spin" />
          <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
          <div className="h-3 w-5/6 bg-white/5 rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="w-full max-w-md rounded-2xl p-5 border border-white/5 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 backdrop-blur-md shadow-xl shadow-black/25 my-2 animate-fade-in-up">
      {/* Search header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
          <Globe className="w-4 h-4" />
        </div>
        <h4 className="text-xs font-bold text-gray-400 tracking-wide truncate max-w-xs">
          Searched: "{result.query}"
        </h4>
      </div>

      {/* Perplexity-style Sources citation grid */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          Sources
        </p>
        <div className="grid grid-cols-3 gap-2">
          {result.sources.map((src: any, i: number) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left min-w-0"
            >
              <img
                src={src.favicon}
                alt=""
                onError={(e) => {
                  // Fallback to Globe icon if favicon fails to load
                  (e.target as HTMLElement).style.display = "none";
                }}
                className="w-3.5 h-3.5 rounded shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-white truncate">
                  {src.name}
                </p>
                <p className="text-[8px] text-gray-500 truncate">
                  {src.url.replace(/https?:\/\/(www\.)?/, "")}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Aggregate brief snippet summary */}
      <div className="space-y-2 border-t border-white/5 pt-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Link2 className="w-3 h-3" />
          Summary Findings
        </p>
        <p className="text-xs text-gray-300 leading-relaxed font-medium">
          {result.summary}
        </p>
      </div>
    </div>
  );
}

// Create and export the web search tool component with custom premium UI
export const SearchTool = makeAssistantTool({
  ...searchTool,
  toolName: "searchWeb",
  render: ({ result, status }) => {
    return <SearchWidget result={result} status={status} />;
  }
});
