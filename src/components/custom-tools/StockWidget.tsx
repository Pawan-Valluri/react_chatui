import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from "zod";
import { TrendingUp, TrendingDown, Award } from "lucide-react";

// Define the simulated stock market tool
const stockTool = tool({
  description: "Retrieve comprehensive equity metrics and draw market trend indicators for a stock ticker symbol.",
  parameters: z.object({
    symbol: z.string().describe("The asset ticker symbol (e.g., AAPL, MSFT, TSLA, NVDA)."),
  }),
  execute: async ({ symbol }) => {
    // Simulate API request latency
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const symUpper = symbol.toUpperCase().trim();
    let name = "Apple Inc.";
    let price = 178.45;
    let change = 3.52;
    let changePercent = "+2.01%";
    let high = 179.12;
    let low = 174.60;
    let volume = "54.2M";
    let recommendation = "Strong Buy";
    // Simulated chart points: y-coords (scaled for visual representation)
    let points = [80, 75, 78, 70, 68, 62, 50, 48, 42, 38, 35];

    if (symUpper.includes("MSFT")) {
      name = "Microsoft Corporation";
      price = 412.30;
      change = 8.15;
      changePercent = "+2.02%";
      high = 415.00;
      low = 402.50;
      volume = "22.8M";
      recommendation = "Buy";
      points = [85, 80, 82, 75, 70, 72, 60, 55, 48, 44, 40];
    } else if (symUpper.includes("TSLA")) {
      name = "Tesla, Inc.";
      price = 184.20;
      change = -4.35;
      changePercent = "-2.31%";
      high = 191.00;
      low = 182.10;
      volume = "98.4M";
      recommendation = "Hold";
      points = [30, 38, 42, 48, 55, 60, 65, 78, 80, 85, 90]; // Downward trend scaled
    } else if (symUpper.includes("NVDA")) {
      name = "NVIDIA Corporation";
      price = 875.12;
      change = 24.50;
      changePercent = "+2.88%";
      high = 880.00;
      low = 848.00;
      volume = "41.6M";
      recommendation = "Strong Buy";
      points = [90, 85, 75, 68, 55, 48, 42, 35, 28, 20, 15]; // Rapid upward trend scaled
    }

    return { symbol: symUpper, name, price, change, changePercent, high, low, volume, recommendation, points };
  }
});

interface StockWidgetProps {
  result: any;
  status: { type: string };
}

export function StockWidget({ result, status }: StockWidgetProps) {
  const isRunning = status.type === "running";

  if (isRunning) {
    return (
      <div className="w-full max-w-sm glass-card rounded-2xl p-5 border border-indigo-500/20 animate-pulse-border my-2">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2">
            <div className="h-6 w-24 bg-white/5 rounded-md animate-pulse" />
            <div className="h-4 w-36 bg-white/5 rounded-md animate-pulse" />
          </div>
          <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-white/5 rounded-lg mb-6 animate-pulse" />
        <div className="h-28 bg-white/5 rounded-xl mb-4 animate-pulse" />
        <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!result) return null;

  const isPositive = result.change >= 0;
  const themeColor = isPositive ? "text-emerald-400" : "text-rose-400";

  // Generate SVG path coordinate string from points
  // Points array values represent height coordinates (smaller values are higher in SVG Y axis)
  const svgWidth = 320;
  const svgHeight = 90;
  const step = svgWidth / (result.points.length - 1);
  const pathD = result.points
    .map((y: number, index: number) => {
      const x = index * step;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // For the area fill path below the trendline
  const areaD = `${pathD} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return (
    <div className="w-full max-w-sm rounded-2xl p-5 border border-white/5 bg-gradient-to-br from-zinc-900 to-black backdrop-blur-md shadow-xl shadow-black/30 my-2 animate-fade-in-up">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-xl text-white tracking-wide">
              {result.symbol}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 uppercase">
              NASDAQ
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5 truncate max-w-[200px]">
            {result.name}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border bg-white/[0.02] ${
          isPositive ? "border-emerald-500/20 text-emerald-400" : "border-rose-500/20 text-rose-400"
        }`}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{result.changePercent}</span>
        </div>
      </div>

      {/* Current Price */}
      <div className="my-5 flex items-baseline gap-1.5">
        <span className="font-display font-black text-3xl text-white tracking-tighter">
          ${result.price.toFixed(2)}
        </span>
        <span className={`text-xs font-semibold ${themeColor}`}>
          {isPositive ? "+" : ""}
          {result.change.toFixed(2)}
        </span>
      </div>

      {/* SVG Mini Chart */}
      <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/5 bg-white/[0.01]">
        {/* Subtle gridline grid */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-[0.03]">
          <div className="border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-b border-white" />
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
          <defs>
            <linearGradient id={`grad-${result.symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.2" />
              <stop offset="100%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area under curve */}
          <path d={areaD} fill={`url(#grad-${result.symbol})`} />

          {/* Trendline */}
          <path
            d={pathD}
            fill="none"
            stroke={isPositive ? "#10b981" : "#f43f5e"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Financial metrics list */}
      <div className="mt-4.5 grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-gray-500 font-medium">
            <span>Day High</span>
            <span className="text-white font-bold">${result.high.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-gray-500 font-medium">
            <span>Day Low</span>
            <span className="text-white font-bold">${result.low.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-gray-500 font-medium">
            <span>Volume</span>
            <span className="text-white font-bold">{result.volume}</span>
          </div>
          <div className="flex justify-between items-center text-gray-500 font-medium">
            <span>Rating</span>
            <span className={`font-bold flex items-center gap-1 ${
              result.recommendation.includes("Buy") ? "text-indigo-400" : "text-gray-400"
            }`}>
              <Award className="w-3.5 h-3.5" />
              {result.recommendation}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create and export the stock tool component with custom premium UI
export const StockTool = makeAssistantTool({
  ...stockTool,
  toolName: "getStockAnalysis",
  render: ({ result, status }) => {
    return <StockWidget result={result} status={status} />;
  }
});
