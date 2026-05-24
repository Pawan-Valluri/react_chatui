import { makeAssistantTool, tool } from "@assistant-ui/react";
import { z } from "zod";
import { Cloud, Sun, CloudRain, Droplets, Wind, SunDim } from "lucide-react";

// Define the simulated weather tool
const weatherTool = tool({
  description: "Retrieve live meteorological and forecast conditions for any global location.",
  parameters: z.object({
    location: z.string().describe("The city or geographical location to check weather for."),
  }),
  execute: async ({ location }) => {
    // Simulate real network request delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Seed variations based on city names for dynamic metrics
    const locLower = location.toLowerCase();
    let temp = "72°F";
    let weather = "Partly Cloudy";
    let humidity = "48%";
    let wind = "7 mph";
    let uvIndex = "Moderate (5)";
    let forecast = [
      { time: "Now", temp: "72°", icon: "cloud" },
      { time: "2h", temp: "74°", icon: "sun" },
      { time: "4h", temp: "70°", icon: "cloud-rain" },
      { time: "6h", temp: "66°", icon: "cloud" }
    ];

    if (locLower.includes("london") || locLower.includes("uk")) {
      temp = "58°F";
      weather = "Light Showers";
      humidity = "82%";
      wind = "14 mph";
      uvIndex = "Low (2)";
      forecast = [
        { time: "Now", temp: "58°", icon: "cloud-rain" },
        { time: "2h", temp: "56°", icon: "cloud-rain" },
        { time: "4h", temp: "59°", icon: "cloud" },
        { time: "6h", temp: "55°", icon: "cloud" }
      ];
    } else if (locLower.includes("tokyo") || locLower.includes("japan")) {
      temp = "68°F";
      weather = "Sunny & Calm";
      humidity = "40%";
      wind = "5 mph";
      uvIndex = "High (7)";
      forecast = [
        { time: "Now", temp: "68°", icon: "sun" },
        { time: "2h", temp: "72°", icon: "sun" },
        { time: "4h", temp: "73°", icon: "sun" },
        { time: "6h", temp: "65°", icon: "cloud" }
      ];
    } else if (locLower.includes("york") || locLower.includes("us")) {
      temp = "64°F";
      weather = "Overcast";
      humidity = "55%";
      wind = "10 mph";
      uvIndex = "Low (3)";
      forecast = [
        { time: "Now", temp: "64°", icon: "cloud" },
        { time: "2h", temp: "65°", icon: "cloud" },
        { time: "4h", temp: "62°", icon: "cloud-rain" },
        { time: "6h", temp: "58°", icon: "cloud" }
      ];
    }

    return { location, temp, weather, humidity, wind, uvIndex, forecast };
  }
});

interface WeatherWidgetProps {
  result: any;
  status: { type: string };
}

export function WeatherWidget({ result, status }: WeatherWidgetProps) {
  const isRunning = status.type === "running";

  if (isRunning) {
    return (
      <div className="w-full max-w-sm bg-[#111318] border-white/10 rounded-2xl p-5 border border-blue-500/20 animate-pulse-border my-2">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-white/5 rounded-md animate-pulse" />
            <div className="h-4 w-20 bg-white/5 rounded-md animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
        </div>
        <div className="h-12 w-24 bg-white/5 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-2.5">
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Select color scheme based on weather
  const isSunny = result.weather.toLowerCase().includes("sun");
  const isRainy = result.weather.toLowerCase().includes("rain") || result.weather.toLowerCase().includes("shower");

  const bgGradient = isSunny
    ? "from-amber-500/10 to-orange-500/5 border-orange-500/20"
    : isRainy
    ? "from-blue-600/10 to-blue-950/5 border-blue-500/20"
    : "from-slate-500/10 to-zinc-950/5 border-slate-500/20";

  const IconComponent = ({ name, className }: { name: string; className?: string }) => {
    if (name === "sun") return <Sun className={className} />;
    if (name === "cloud-rain") return <CloudRain className={className} />;
    return <Cloud className={className} />;
  };

  return (
    <div className={`w-full max-w-sm rounded-2xl p-5 border bg-gradient-to-br ${bgGradient} backdrop-blur-md shadow-xl shadow-black/20 my-2 animate-fade-in-up`}>
      {/* City and Condition */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-display font-bold text-lg text-white tracking-wide">
            {result.location}
          </h3>
          <p className="text-xs font-semibold text-gray-400 capitalize mt-0.5">
            {result.weather}
          </p>
        </div>
        <div className="p-2 rounded-xl bg-white/5 border border-white/5">
          {isSunny ? (
            <Sun className="w-6 h-6 text-amber-400 animate-spin-slow" />
          ) : isRainy ? (
            <CloudRain className="w-6 h-6 text-blue-400 animate-bounce" />
          ) : (
            <Cloud className="w-6 h-6 text-blue-300" />
          )}
        </div>
      </div>

      {/* Temperature & Main Display */}
      <div className="my-5 flex items-baseline gap-2">
        <span className="font-display font-extrabold text-4xl text-white tracking-tighter">
          {result.temp}
        </span>
        <span className="text-xs font-medium text-gray-400">Current Temp</span>
      </div>

      {/* Sub-Metrics grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col items-center justify-center">
          <Droplets className="w-4 h-4 text-blue-400 mb-1" />
          <span className="text-xs font-semibold text-white">{result.humidity}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">Humidity</span>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col items-center justify-center">
          <Wind className="w-4 h-4 text-teal-400 mb-1" />
          <span className="text-xs font-semibold text-white">{result.wind}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">Wind</span>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col items-center justify-center">
          <SunDim className="w-4 h-4 text-amber-400 mb-1" />
          <span className="text-xs font-semibold text-white truncate max-w-full text-center">
            {result.uvIndex.split(" ")[0]}
          </span>
          <span className="text-[10px] text-gray-500 mt-0.5">UV Index</span>
        </div>
      </div>

      {/* Hourly Forecast */}
      <div className="pt-4.5 border-t border-white/5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Hourly Forecast
        </p>
        <div className="grid grid-cols-4 gap-1 text-center">
          {result.forecast.map((fc: any, i: number) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-[10px] text-gray-500 font-medium">{fc.time}</span>
              <IconComponent
                name={fc.icon}
                className={`w-4 h-4 my-1.5 ${
                  fc.icon === "sun" ? "text-amber-400" : fc.icon === "cloud-rain" ? "text-blue-400" : "text-gray-400"
                }`}
              />
              <span className="text-xs font-bold text-white">{fc.temp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Create and export the weather tool component with custom premium UI
export const WeatherTool = makeAssistantTool({
  ...weatherTool,
  toolName: "getWeather",
  render: ({ result, status }) => {
    return <WeatherWidget result={result} status={status} />;
  }
});
