import json
import logging
import os
from typing import TypedDict, List, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END

# Telemetry overrides (Offline-safe enterprise compatibility)
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_TELEMETRY_ENABLED"] = "false"
os.environ["LANGCHAIN_TRACING"] = "false"

# Logger Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("LangGraphAgent")

# FastAPI App
app = FastAPI(title="Optimized LangGraph Backend", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    messages: list

# ==================================================================================
# CRUNCHED MOCK DATA PROVIDERS
# ==================================================================================
def get_weather_mock(location: str) -> Dict[str, Any]:
    logger.info(f"Simulating weather for: {location}")
    loc = location.lower()
    forecasts = {
        "london": {"temp": "58°F", "weather": "Light Showers", "humidity": "82%", "wind": "14 mph", "uvIndex": "Low (2)", "icon": "cloud-rain"},
        "tokyo": {"temp": "68°F", "weather": "Sunny & Calm", "humidity": "40%", "wind": "5 mph", "uvIndex": "High (7)", "icon": "sun"},
        "santa clara": {"temp": "74°F", "weather": "Warm & Sunny", "humidity": "45%", "wind": "6 mph", "uvIndex": "High (6)", "icon": "sun"},
        "redmond": {"temp": "55°F", "weather": "Cloudy & Rainy", "humidity": "88%", "wind": "11 mph", "uvIndex": "Low (2)", "icon": "cloud-rain"}
    }
    key = next((k for k in forecasts if k in loc), None)
    data = forecasts[key] if key else {"temp": "72°F", "weather": "Partly Cloudy", "humidity": "48%", "wind": "7 mph", "uvIndex": "Moderate (5)", "icon": "cloud"}
    return {
        "location": location.title(), "temp": data["temp"], "weather": data["weather"],
        "humidity": data["humidity"], "wind": data["wind"], "uvIndex": data["uvIndex"],
        "forecast": [
            {"time": "Now", "temp": data["temp"].replace("°F", ""), "icon": data["icon"]},
            {"time": "2h", "temp": "74°" if "sun" in data["weather"].lower() else "56°", "icon": data["icon"]},
            {"time": "4h", "temp": "70°", "icon": "cloud"},
            {"time": "6h", "temp": "66°", "icon": "cloud"}
        ]
    }

def get_stock_mock(symbol: str) -> Dict[str, Any]:
    logger.info(f"Simulating stock for symbol: {symbol}")
    sym = symbol.upper().strip()
    stocks = {
        "MSFT": ("Microsoft Corporation", 412.30, 8.15, "+2.02%", 415.00, 402.50, "22.8M", "Buy", [85, 80, 82, 75, 70, 72, 60, 55, 48, 44, 40]),
        "TSLA": ("Tesla, Inc.", 184.20, -4.35, "-2.31%", 191.00, 182.10, "98.4M", "Hold", [30, 38, 42, 48, 55, 60, 65, 78, 80, 85, 90]),
        "NVDA": ("NVIDIA Corporation", 875.12, 24.50, "+2.88%", 880.00, 848.00, "41.6M", "Strong Buy", [90, 85, 75, 68, 55, 48, 42, 35, 28, 20, 15]),
    }
    name, price, change, change_percent, high, low, volume, rec, points = stocks.get(sym, ("Apple Inc.", 178.45, 3.52, "+2.01%", 179.12, 174.60, "54.2M", "Strong Buy", [80, 75, 78, 70, 68, 62, 50, 48, 42, 38, 35]))
    return {
        "symbol": sym, "name": name, "price": price, "change": change, "changePercent": change_percent,
        "high": high, "low": low, "volume": volume, "recommendation": rec, "points": points
    }

def get_search_mock(query: str) -> Dict[str, Any]:
    logger.info(f"Simulating search for: {query}")
    q = query.lower()
    summary = "Vite React projects leverage advanced ESM features for blazing fast hot module replacement (HMR)."
    sources = [
        {"name": "Vite Official Guide", "url": "https://vite.dev", "snippet": "Getting started with Vite React templates.", "favicon": "https://vite.dev/logo.svg"},
        {"name": "React Docs", "url": "https://react.dev", "snippet": "Best practices for React components.", "favicon": "https://react.dev/favicon.ico"}
    ]

    if "nvidia" in q:
        summary = "NVIDIA Corporation is headquartered in Santa Clara, California, and is traded under the stock symbol NVDA."
        sources = [{"name": "NVIDIA Investor", "url": "https://nvidia.com", "snippet": "NVIDIA corporate facts and headquarters location details.", "favicon": "https://nvidia.com/favicon.ico"}]
    elif "zustand" in q:
        summary = "Zustand was created by a developer team led by a core maintainer based in Tokyo, Japan."
        sources = [{"name": "Zustand GitHub", "url": "https://github.com/pmndrs/zustand", "snippet": "Small, fast and scalable bearbones state-management solution.", "favicon": "https://github.com/favicon.ico"}]
    elif "microsoft" in q:
        summary = "Microsoft Corporation is headquartered in Redmond, Washington, and is traded under the stock symbol MSFT."
        sources = [{"name": "Microsoft Investor", "url": "https://microsoft.com", "snippet": "Microsoft investor relations and Redmond headquarters information.", "favicon": "https://microsoft.com/favicon.ico"}]
    
    return {"query": query, "summary": summary, "sourceCount": len(sources), "sources": sources}

# ==================================================================================
# LANGGRAPH GRAPH ENGINE
# ==================================================================================
class AgentState(TypedDict):
    messages: List[Dict[str, Any]]
    reasoning: str
    text: str
    tool_calls: List[Dict[str, Any]]

def agent_node(state: AgentState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    last_msg = messages[-1] if messages else {"role": "user", "content": []}
    
    user_text = ""
    if isinstance(last_msg.get("content"), list):
        for part in last_msg["content"]:
            if part.get("type") == "text":
                user_text = part.get("text", "")
                break
    else:
        user_text = str(last_msg.get("content", ""))
    
    norm_text = user_text.lower().strip()
    current_tool_calls = state.get("tool_calls", []) or []
    
    if current_tool_calls:
        if all("result" in tc for tc in current_tool_calls):
            # Dynamic Multi-Stage Logic Evaluation
            search_calls = [tc for tc in current_tool_calls if tc["name"] == "searchWeb"]
            weather_calls = [tc for tc in current_tool_calls if tc["name"] == "getWeather"]
            stock_calls = [tc for tc in current_tool_calls if tc["name"] == "getStockAnalysis"]
            
            # NVIDIA Stage 2
            if search_calls and "nvidia" in search_calls[0]["args"].get("query", "").lower() and not weather_calls and not stock_calls:
                logger.info("Agent: Transitioning to Stage 2: Triggering Stock and Weather checks for Santa Clara & NVDA")
                return {
                    "reasoning": state.get("reasoning", "") + "\n\nThinking Process (Stage 2): Search resolved NVIDIA to Santa Clara & NVDA. Now triggering weather for Santa Clara and stock price for NVDA.",
                    "text": state.get("text", "") + "\n\n**Stage 2:** Querying current stock indices for **NVDA** and weather stats in **Santa Clara, CA**...",
                    "tool_calls": current_tool_calls + [
                        {"name": "getWeather", "id": "call_weather_nvidia", "args": {"location": "Santa Clara"}},
                        {"name": "getStockAnalysis", "id": "call_stock_nvidia", "args": {"symbol": "NVDA"}}
                    ]
                }
            
            # Zustand Stage 2
            if search_calls and "zustand" in search_calls[0]["args"].get("query", "").lower() and not weather_calls:
                logger.info("Agent: Transitioning to Stage 2: Triggering Weather check for Tokyo")
                return {
                    "reasoning": state.get("reasoning", "") + "\n\nThinking Process (Stage 2): Search resolved Zustand to Tokyo. Now triggering weather lookup for Tokyo.",
                    "text": state.get("text", "") + "\n\n**Stage 2:** Fetching local weather metrics in **Tokyo, Japan**...",
                    "tool_calls": current_tool_calls + [
                        {"name": "getWeather", "id": "call_weather_zustand", "args": {"location": "Tokyo"}}
                    ]
                }
            
            # Microsoft Stage 2
            if search_calls and "microsoft" in search_calls[0]["args"].get("query", "").lower() and not weather_calls and not stock_calls:
                logger.info("Agent: Transitioning to Stage 2: Triggering Stock and Weather checks for Redmond & MSFT")
                return {
                    "reasoning": state.get("reasoning", "") + "\n\nThinking Process (Stage 2): Search resolved Microsoft to Redmond & MSFT. Now triggering weather for Redmond and stock price for MSFT.",
                    "text": state.get("text", "") + "\n\n**Stage 2:** Querying current stock indices for **MSFT** and weather stats in **Redmond, WA**...",
                    "tool_calls": current_tool_calls + [
                        {"name": "getWeather", "id": "call_weather_microsoft", "args": {"location": "Redmond"}},
                        {"name": "getStockAnalysis", "id": "call_stock_microsoft", "args": {"symbol": "MSFT"}}
                    ]
                }

            # Final Synthesis Stage
            logger.info("Agent: Finalizing multi-stage briefing synthesis.")
            text = "### 🧠 Dynamic Multi-Stage Agent Investigation Complete!\n\nHere is the synthesized intelligence briefing:\n\n"
            for idx, tc in enumerate(current_tool_calls, start=1):
                name, args, res = tc["name"], tc["args"], tc["result"]
                if name == "searchWeb":
                    text += f"#### {idx}. 🔍 Web Lookup on \"{args.get('query')}\":\n- **Summary:** {res['summary']}\n\n"
                elif name == "getWeather":
                    text += f"#### {idx}. 🌦️ Weather in **{res['location']}**:\n- **Current:** {res['weather']} at {res['temp']} (Humidity: {res['humidity']}, Wind: {res['wind']})\n\n"
                elif name == "getStockAnalysis":
                    text += f"#### {idx}. 📈 Equity Evaluation for **{res['symbol']}** ({res['name']}):\n- **Pricing:** ${res['price']:.2f} ({res['changePercent']}) | Rating: **{res['recommendation']}**\n\n"
            
            return {
                "reasoning": state.get("reasoning", "") + "\n\nThinking Process (Synthesis): Finalizing combined dynamic markdown dashboard payload.",
                "text": text,
                "tool_calls": current_tool_calls
            }
            
    # Initial Chat Intent Mapping
    logger.info(f"Agent: Parsing user query intent: '{norm_text}'")
    is_weather = any(x in norm_text for x in ["weather", "paris", "london", "tokyo"])
    is_stock = any(x in norm_text for x in ["stock", "aapl", "msft", "tsla", "nvda"])
    is_search = any(x in norm_text for x in ["search", "find", "who", "where"])
    
    # Complex Dynamic Flow Intent
    if is_search and any(x in norm_text for x in ["nvidia", "zustand", "microsoft"]):
        query = "NVIDIA corporate headquarters" if "nvidia" in norm_text else "Zustand state manager creator" if "zustand" in norm_text else "Microsoft headquarters"
        return {
            "reasoning": f"Thinking Process (Stage 1): Complex multi-stage inquiry. Triggering Stage 1 lookup for: '{query}'.",
            "text": f"Initiating multi-stage intelligence gathering pipeline...\n\n**Stage 1:** Searching the web for \"{query}\"...",
            "tool_calls": [{"name": "searchWeb", "id": "call_search_stage1", "args": {"query": query}}]
        }
        
    # Single-stage Tool Calls
    if is_search:
        q = user_text.replace("search", "").replace("find", "").strip()
        return {
            "reasoning": "Thinking Process: Triggering single-stage web search lookup.",
            "text": f"Searching the web for \"{q}\"...",
            "tool_calls": [{"name": "searchWeb", "id": "call_search_single", "args": {"query": q or "React trends"}}]
        }
    if is_weather:
        loc = "London" if "london" in norm_text else "Tokyo" if "tokyo" in norm_text else "Paris"
        return {
            "reasoning": f"Thinking Process: Standard weather lookup for {loc}.",
            "text": f"Checking current weather conditions for **{loc}**...",
            "tool_calls": [{"name": "getWeather", "id": "call_weather_single", "args": {"location": loc}}]
        }
    if is_stock:
        sym = "MSFT" if "msft" in norm_text else "TSLA" if "tsla" in norm_text else "NVDA" if "nvda" in norm_text else "AAPL"
        return {
            "reasoning": f"Thinking Process: Standard equity lookup for {sym}.",
            "text": f"Analyzing market metrics for **{sym}**...",
            "tool_calls": [{"name": "getStockAnalysis", "id": "call_stock_single", "args": {"symbol": sym}}]
        }
        
    # Standard conversation
    reply = "Hello! Ask me about weather, stocks, or perform dynamic multi-stage searches like 'Search for Nvidia headquarters and check its stock and weather'!"
    if any(x in norm_text for x in ["hello", "hi", "hey"]):
        reply = "Hello there! How can I help you today? Try typing 'weather in Paris' or ask me to 'search for Nvidia headquarters and check its stock and weather'!"
    elif "help" in norm_text:
        reply = "I support multi-stage dynamic actions! For example, try asking:\n- *'Search for Nvidia headquarters and check its stock and weather'*\n- *'Search for Zustand creator and check weather in their city'*\n- *'Search for Microsoft HQ, analyze Microsoft stock, and get the weather there'*"
        
    return {
        "reasoning": f"Thinking Process: Conversational response generation for: '{user_text}'.",
        "text": reply,
        "tool_calls": []
    }

def tools_node(state: AgentState) -> Dict[str, Any]:
    tool_calls = state.get("tool_calls", []) or []
    updated_tool_calls = []
    for tc in tool_calls:
        if "result" in tc:
            updated_tool_calls.append(tc)
            continue
        name, args = tc["name"], tc["args"]
        logger.info(f"Tools Node: Executing '{name}'")
        result = None
        if name == "getWeather":
            result = get_weather_mock(args.get("location", "Paris"))
        elif name == "getStockAnalysis":
            result = get_stock_mock(args.get("symbol", "AAPL"))
        elif name == "searchWeb":
            result = get_search_mock(args.get("query", ""))
        updated_tool_calls.append({**tc, "result": result})
    return {"tool_calls": updated_tool_calls}

def should_continue(state: AgentState) -> str:
    tool_calls = state.get("tool_calls", []) or []
    if not tool_calls:
        return END
    return "tools" if any("result" not in tc for tc in tool_calls) else END

# Compile Workflow Graph
builder = StateGraph(AgentState)
builder.add_node("agent", agent_node)
builder.add_node("tools", tools_node)
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")
workflow = builder.compile()

# ==================================================================================
# API ROUTES
# ==================================================================================
@app.post("/api/chat")
async def chat(request: ChatRequest):
    logger.info(f"Received API chat request history size: {len(request.messages)}")
    initial_state = {"messages": request.messages, "reasoning": "", "text": "", "tool_calls": []}

    async def ndjson_stream():
        acc_reasoning = ""
        acc_text = ""
        acc_tool_calls = []

        async for chunk in workflow.astream(initial_state):
            for node_name, state_update in chunk.items():
                logger.info(f"Graph completed node: '{node_name}'")
                if not state_update:
                    continue
                if "reasoning" in state_update:
                    acc_reasoning = state_update["reasoning"]
                if "text" in state_update:
                    acc_text = state_update["text"]
                if "tool_calls" in state_update:
                    acc_tool_calls = state_update["tool_calls"]

            parts = []
            if acc_reasoning:
                parts.append({"type": "reasoning", "text": acc_reasoning})
            if acc_text:
                parts.append({"type": "text", "text": acc_text})
            for tc in acc_tool_calls:
                tc_part = {"type": "tool-call", "toolName": tc["name"], "toolCallId": tc["id"], "args": tc["args"], "argsText": json.dumps(tc["args"])}
                if "result" in tc:
                    tc_part["result"] = tc["result"]
                parts.append(tc_part)

            yield json.dumps({"content": parts}) + "\n"

    return StreamingResponse(ndjson_stream(), media_type="application/x-ndjson")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
