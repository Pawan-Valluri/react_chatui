import React from "react";
import { Terminal, Copy, Check } from "lucide-react";

interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!content) return null;

  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-200">
      {parts.map((part, index) => {
        // Code block rendering
        if (part.startsWith("```") && part.endsWith("```")) {
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : "";
          const code = match ? match[2] : part.slice(3, -3);

          return (
            <div
              key={index}
              className="my-3 rounded-xl border border-white/5 bg-zinc-950 overflow-hidden font-mono text-xs animate-fade-in-up"
            >
              <div className="flex justify-between items-center px-4 py-2 bg-zinc-900 border-b border-white/5 text-gray-400">
                <span className="flex items-center gap-1.5 font-sans font-semibold text-[10px] uppercase tracking-wider">
                  <Terminal className="w-3 h-3 text-blue-400" />
                  {lang || "code"}
                </span>
                <button
                  onClick={() => copyToClipboard(code, index)}
                  className="flex items-center gap-1 hover:text-white transition-colors py-0.5 px-1.5 rounded hover:bg-white/5"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-[10px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-gray-300">
                <code>{code.trim()}</code>
              </pre>
            </div>
          );
        }

        // Inline text formatting (bold, italic, list items, headings)
        const lines = part.split("\n");
        return (
          <div key={index} className="space-y-2">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();

              // Bullet points
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <ul key={lIdx} className="list-disc pl-5 space-y-1 my-1">
                    <li className="text-gray-300">
                      {formatInline(trimmed.substring(2))}
                    </li>
                  </ul>
                );
              }

              // Headings
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={lIdx} className="font-display font-bold text-sm text-blue-300 mt-3 mb-1">
                    {formatInline(trimmed.substring(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={lIdx} className="font-display font-bold text-base text-blue-400 mt-4 mb-2">
                    {formatInline(trimmed.substring(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h2 key={lIdx} className="font-display font-extrabold text-lg text-white mt-5 mb-2">
                    {formatInline(trimmed.substring(2))}
                  </h2>
                );
              }

              // Standard line
              if (line === "") return <div key={lIdx} className="h-2" />;

              return (
                <p key={lIdx} className="text-gray-300">
                  {formatInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Helper to replace **bold** and `code` tags inline
function formatInline(text: string) {
  // Regex to split by bold (**bold**) and inline code (`code`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.substring(2, part.length - 2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-xs text-blue-300">
          {part.substring(1, part.length - 1)}
        </code>
      );
    }
    return part;
  });
}
