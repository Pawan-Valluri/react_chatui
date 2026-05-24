import json
import logging
import os
import datetime
import time
import uuid
import jwt
from typing import TypedDict, List, Dict, Any, Annotated, Optional

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import AnyMessage, AIMessage, HumanMessage, ToolMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode, tools_condition

from sqlalchemy import create_engine, Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base

# Telemetry overrides (Offline-safe enterprise compatibility)
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGCHAIN_TELEMETRY_ENABLED"] = "false"
os.environ["LANGCHAIN_TRACING"] = "false"

VERBOSE_LEVEL = int(os.getenv("VERBOSE_LEVEL", "2"))

# Logger Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("LangGraphAgent")

# ==================================================================================
# DATABASE LAYER (PostgreSQL with SQLite local fallback)
# ==================================================================================
Base = declarative_base()

class DBThread(Base):
    __tablename__ = "threads"
    id = Column(String(255), primary_key=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    head_id = Column(String(255), nullable=True)
    user_id = Column(String(255), nullable=False)

    messages = relationship("DBMessage", back_populates="thread", cascade="all, delete-orphan")

class DBMessage(Base):
    __tablename__ = "messages"
    id = Column(String(255), primary_key=True)
    thread_id = Column(String(255), ForeignKey("threads.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False)
    content = Column(JSON, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    thread = relationship("DBThread", back_populates="messages")

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    from pathlib import Path
    db_path = Path(__file__).resolve().parent / "chat.db"
    DATABASE_URL = f"sqlite:///{db_path}"
    logger.info(f"DATABASE_URL env var not set. Falling back to local SQLite database at {db_path}.")

# SQLite compatibility arguments
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables if they do not exist
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper to reconstruct active path using in-memory pointer traversal (robust and cross-db safe)
def get_active_branch_messages(db, thread_id: str, start_message_id: Optional[str]) -> List[DBMessage]:
    db_messages = db.query(DBMessage).filter(DBMessage.thread_id == thread_id).all()
    msg_map = {m.id: m for m in db_messages}
    
    active_path = []
    current_id = start_message_id
    visited = set()
    
    while current_id and current_id not in visited:
        visited.add(current_id)
        msg = msg_map.get(current_id)
        if not msg:
            break
        active_path.append(msg)
        current_id = msg.parent_id
        
    active_path.reverse()
    return active_path

# ==================================================================================
# SECURITY & AUTHENTICATION LAYER
# ==================================================================================
SSO_SIMULATOR_SECRET = "super-secret-authblue-simulation-key-32bytes"

async def get_current_user(request: Request):
    env = os.getenv("env", "local").lower()
    
    if env == "local":
        # 1. Read bluetoken cookie
        token = request.cookies.get("bluetoken")
        if token:
            try:
                payload = jwt.decode(token, SSO_SIMULATOR_SECRET, algorithms=["HS256"], options={"verify_aud": False})
                return payload
            except Exception as e:
                logger.warning(f"Failed to decode simulated SSO token: {e}")
                
        # 2. Return out-of-the-box fallback profile for local ease of use
        return {
            "uid": "cfrost",
            "firstname": "Charles",
            "lastname": "Frost",
            "fullname": "Charles Frost",
            "email": "charles.frost@aexp.com",
            "employeeid": "8881234",
            "groups": ["SSO_APP_USER", "SSO_APP_ADMIN"]
        }
    else:
        # Non-local/Cloud SSO Auth Gateway Integration (e1, e2, e3xxxxx)
        # 1. Inspect AuthBlue Reverse Proxy Injected Headers
        ads_id = request.headers.get("adsid") or request.headers.get("adsId")
        if ads_id:
            return {
                "uid": ads_id,
                "firstname": request.headers.get("firstname", "Cloud"),
                "lastname": request.headers.get("lastname", "User"),
                "fullname": request.headers.get("fullname", "Cloud User"),
                "email": request.headers.get("email", ""),
                "employeeid": request.headers.get("employeeid", ""),
                "groups": ["SSO_APP_USER"]
            }
            
        # 2. Inspect bluetoken cookie and fetch details from production AuthBlue API
        token = request.cookies.get("bluetoken")
        if token:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    headers = {"Cookie": f"bluetoken={token}"}
                    response = await client.get(
                        "https://authbluetokens-dev.aexp.com/v1/user/userinfo", 
                        headers=headers,
                        timeout=5.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("status") == "success":
                            return data
            except Exception as e:
                logger.error(f"Error querying production AuthBlue gateway: {e}")
                
        raise HTTPException(status_code=401, detail="Unauthorized: AuthBlue SSO authentication failed")

# ==================================================================================
# FASTAPI CONFIG & MIDDLEWARE
# ==================================================================================
app = FastAPI(title="Optimized LangGraph Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    messages: list
    threadId: str
    parentId: Optional[str] = None

class ThreadCreate(BaseModel):
    id: str
    title: str
    createdAt: Optional[int] = None

class ThreadUpdate(BaseModel):
    title: Optional[str] = None
    headId: Optional[str] = None
    messages: Optional[list] = None

# ==================================================================================
# ACTUAL TOOLS (Mock Data Providers)
# ==================================================================================
@tool
def get_weather(location: str) -> str:
    """Get the current weather and forecast for a location."""
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
    return json.dumps({
        "location": location.title(), "temp": data["temp"], "weather": data["weather"],
        "humidity": data["humidity"], "wind": data["wind"], "uvIndex": data["uvIndex"],
        "forecast": [
            {"time": "Now", "temp": data["temp"].replace("°F", ""), "icon": data["icon"]},
            {"time": "2h", "temp": "74°" if "sun" in data["weather"].lower() else "56°", "icon": data["icon"]},
            {"time": "4h", "temp": "70°", "icon": "cloud"},
            {"time": "6h", "temp": "66°", "icon": "cloud"}
        ]
    })

@tool
def get_stock_analysis(symbol: str) -> str:
    """Get stock market analysis for a given symbol."""
    logger.info(f"Simulating stock for symbol: {symbol}")
    sym = symbol.upper().strip()
    stocks = {
        "MSFT": ("Microsoft Corporation", 412.30, 8.15, "+2.02%", 415.00, 402.50, "22.8M", "Buy", [85, 80, 82, 75, 70, 72, 60, 55, 48, 44, 40]),
        "TSLA": ("Tesla, Inc.", 184.20, -4.35, "-2.31%", 191.00, 182.10, "98.4M", "Hold", [30, 38, 42, 48, 55, 60, 65, 78, 80, 85, 90]),
        "NVDA": ("NVIDIA Corporation", 875.12, 24.50, "+2.88%", 880.00, 848.00, "41.6M", "Strong Buy", [90, 85, 75, 68, 55, 48, 42, 35, 28, 20, 15]),
    }
    name, price, change, change_percent, high, low, volume, rec, points = stocks.get(sym, ("Apple Inc.", 178.45, 3.52, "+2.01%", 179.12, 174.60, "54.2M", "Strong Buy", [80, 75, 78, 70, 68, 62, 50, 48, 42, 38, 35]))
    return json.dumps({
        "symbol": sym, "name": name, "price": price, "change": change, "changePercent": change_percent,
        "high": high, "low": low, "volume": volume, "recommendation": rec, "points": points
    })

@tool
def search_web(query: str) -> str:
    """Search the web for a given query."""
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
    
    return json.dumps({"query": query, "summary": summary, "sourceCount": len(sources), "sources": sources})

tools = [get_weather, get_stock_analysis, search_web]
tool_node = ToolNode(tools)

# ==================================================================================
# LANGGRAPH GRAPH ENGINE
# ==================================================================================
class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

def dummy_llm_node(state: AgentState) -> Dict[str, Any]:
    messages = state["messages"]
    
    user_text = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            user_text = msg.content if isinstance(msg.content, str) else str(msg.content)
            break
            
    norm_text = user_text.lower().strip()
    
    last_human_idx = -1
    for i in range(len(messages)-1, -1, -1):
        if isinstance(messages[i], HumanMessage):
            last_human_idx = i
            break
            
    recent_messages = messages[last_human_idx+1:] if last_human_idx != -1 else messages
    
    ai_messages = [m for m in recent_messages if isinstance(m, AIMessage) and m.tool_calls]
    tool_messages = [m for m in recent_messages if isinstance(m, ToolMessage)]
    
    if ai_messages:
        all_tool_call_ids = set(tc["id"] for m in ai_messages for tc in m.tool_calls)
        completed_tool_call_ids = set(m.tool_call_id for m in tool_messages)
        
        if all_tool_call_ids and all_tool_call_ids.issubset(completed_tool_call_ids):
            last_ai_message = ai_messages[-1]
            
            search_calls = [tc for tc in last_ai_message.tool_calls if tc["name"] == "search_web"]
            weather_calls = [tc for tc in last_ai_message.tool_calls if tc["name"] == "get_weather"]
            stock_calls = [tc for tc in last_ai_message.tool_calls if tc["name"] == "get_stock_analysis"]
            
            if search_calls and "nvidia" in search_calls[0]["args"].get("query", "").lower() and not weather_calls and not stock_calls:
                logger.info("Agent: Transitioning to Stage 2: Triggering Stock and Weather checks for Santa Clara & NVDA")
                return {
                    "messages": [
                        AIMessage(
                            content="\n\n**Stage 2:** Querying current stock indices for **NVDA** and weather stats in **Santa Clara, CA**...",
                            additional_kwargs={"reasoning": "\n\nThinking Process (Stage 2): Search resolved NVIDIA to Santa Clara & NVDA. Now triggering weather for Santa Clara and stock price for NVDA."},
                            tool_calls=[
                                {"name": "get_weather", "id": "call_weather_nvidia", "args": {"location": "Santa Clara"}},
                                {"name": "get_stock_analysis", "id": "call_stock_nvidia", "args": {"symbol": "NVDA"}}
                            ]
                        )
                    ]
                }
            
            if search_calls and "zustand" in search_calls[0]["args"].get("query", "").lower() and not weather_calls:
                logger.info("Agent: Transitioning to Stage 2: Triggering Weather check for Tokyo")
                return {
                    "messages": [
                        AIMessage(
                            content="\n\n**Stage 2:** Fetching local weather metrics in **Tokyo, Japan**...",
                            additional_kwargs={"reasoning": "\n\nThinking Process (Stage 2): Search resolved Zustand to Tokyo. Now triggering weather lookup for Tokyo."},
                            tool_calls=[
                                {"name": "get_weather", "id": "call_weather_zustand", "args": {"location": "Tokyo"}}
                            ]
                        )
                    ]
                }
            
            if search_calls and "microsoft" in search_calls[0]["args"].get("query", "").lower() and not weather_calls and not stock_calls:
                logger.info("Agent: Transitioning to Stage 2: Triggering Stock and Weather checks for Redmond & MSFT")
                return {
                    "messages": [
                        AIMessage(
                            content="\n\n**Stage 2:** Querying current stock indices for **MSFT** and weather stats in **Redmond, WA**...",
                            additional_kwargs={"reasoning": "\n\nThinking Process (Stage 2): Search resolved Microsoft to Redmond & MSFT. Now triggering weather for Redmond and stock price for MSFT."},
                            tool_calls=[
                                {"name": "get_weather", "id": "call_weather_microsoft", "args": {"location": "Redmond"}},
                                {"name": "get_stock_analysis", "id": "call_stock_microsoft", "args": {"symbol": "MSFT"}}
                            ]
                        )
                    ]
                }

            logger.info("Agent: Finalizing multi-stage briefing synthesis.")
            text = "### 🧠 Dynamic Multi-Stage Agent Investigation Complete!\n\nHere is the synthesized intelligence briefing:\n\n"
            
            idx = 1
            for msg in tool_messages:
                try:
                    res = json.loads(msg.content)
                except:
                    res = {"content": msg.content}
                    
                name = msg.name
                if name == "search_web":
                    text += f"#### {idx}. 🔍 Web Lookup on \"{res.get('query', '')}\":\n- **Summary:** {res.get('summary', '')}\n\n"
                elif name == "get_weather":
                    text += f"#### {idx}. 🌦️ Weather in **{res.get('location', '')}**:\n- **Current:** {res.get('weather', '')} at {res.get('temp', '')} (Humidity: {res.get('humidity', '')}, Wind: {res.get('wind', '')})\n\n"
                elif name == "get_stock_analysis":
                    text += f"#### {idx}. 📈 Equity Evaluation for **{res.get('symbol', '')}** ({res.get('name', '')}):\n- **Pricing:** ${res.get('price', 0):.2f} ({res.get('changePercent', '')}) | Rating: **{res.get('recommendation', '')}**\n\n"
                idx += 1
                    
            return {
                "messages": [
                    AIMessage(
                        content=text,
                        additional_kwargs={"reasoning": "\n\nThinking Process (Synthesis): Finalizing combined dynamic markdown dashboard payload."}
                    )
                ]
            }
            
    logger.info(f"Agent: Parsing user query intent: '{norm_text}'")
    is_weather = any(x in norm_text for x in ["weather", "paris", "london", "tokyo"])
    is_stock = any(x in norm_text for x in ["stock", "aapl", "msft", "tsla", "nvda"])
    is_search = any(x in norm_text for x in ["search", "find", "who", "where"])
    
    if is_search and any(x in norm_text for x in ["nvidia", "zustand", "microsoft"]):
        query = "NVIDIA corporate headquarters" if "nvidia" in norm_text else "Zustand state manager creator" if "zustand" in norm_text else "Microsoft headquarters"
        return {
            "messages": [
                AIMessage(
                    content=f"Initiating multi-stage intelligence gathering pipeline...\n\n**Stage 1:** Searching the web for \"{query}\"...",
                    additional_kwargs={"reasoning": f"Thinking Process (Stage 1): Complex multi-stage inquiry. Triggering Stage 1 lookup for: '{query}'."},
                    tool_calls=[{"name": "search_web", "id": "call_search_stage1", "args": {"query": query}}]
                )
            ]
        }
        
    if is_search:
        q = user_text.replace("search", "").replace("find", "").strip()
        return {
            "messages": [
                AIMessage(
                    content=f"Searching the web for \"{q}\"...",
                    additional_kwargs={"reasoning": "Thinking Process: Triggering single-stage web search lookup."},
                    tool_calls=[{"name": "search_web", "id": "call_search_single", "args": {"query": q or "React trends"}}]
                )
            ]
        }
    if is_weather:
        loc = "London" if "london" in norm_text else "Tokyo" if "tokyo" in norm_text else "Paris"
        return {
            "messages": [
                AIMessage(
                    content=f"Checking current weather conditions for **{loc}**...",
                    additional_kwargs={"reasoning": f"Thinking Process: Standard weather lookup for {loc}."},
                    tool_calls=[{"name": "get_weather", "id": "call_weather_single", "args": {"location": loc}}]
                )
            ]
        }
    if is_stock:
        sym = "MSFT" if "msft" in norm_text else "TSLA" if "tsla" in norm_text else "NVDA" if "nvda" in norm_text else "AAPL"
        return {
            "messages": [
                AIMessage(
                    content=f"Analyzing market metrics for **{sym}**...",
                    additional_kwargs={"reasoning": f"Thinking Process: Standard equity lookup for {sym}."},
                    tool_calls=[{"name": "get_stock_analysis", "id": "call_stock_single", "args": {"symbol": sym}}]
                )
            ]
        }
        
    reply = "Hello! Ask me about weather, stocks, or perform dynamic multi-stage searches like 'Search for Nvidia headquarters and check its stock and weather'!"
    if any(x in norm_text for x in ["hello", "hi", "hey"]):
        reply = "Hello there! How can I help you today? Try typing 'weather in Paris' or ask me to 'search for Nvidia headquarters and check its stock and weather'!"
    elif "help" in norm_text:
        reply = "I support multi-stage dynamic actions! For example, try asking:\n- *'Search for Nvidia headquarters and check its stock and weather'*\n- *'Search for Zustand creator and check weather in their city'*\n- *'Search for Microsoft HQ, analyze Microsoft stock, and get the weather there'*"
        
    return {
        "messages": [
            AIMessage(
                content=reply,
                additional_kwargs={"reasoning": f"Thinking Process: Conversational response generation for: '{user_text}'."}
            )
        ]
    }

# Compile Workflow Graph
builder = StateGraph(AgentState)
builder.add_node("agent", dummy_llm_node)
builder.add_node("tools", tool_node)

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", tools_condition, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")
workflow = builder.compile()

# ==================================================================================
# API ROUTING & REST SERVICES
# ==================================================================================

def convert_to_langchain_messages(messages_data: list) -> list:
    langchain_msgs = []
    for m in messages_data:
        # DBMessage objects have attributes instead of dict keys
        role = m.role if hasattr(m, "role") else m.get("role")
        content = m.content if hasattr(m, "content") else m.get("content")
        
        if role == "user":
            text = ""
            if isinstance(content, list):
                for part in content:
                    if part.get("type") == "text":
                        text = part.get("text", "")
                        break
            else:
                text = str(content)
            langchain_msgs.append(HumanMessage(content=text))
            
        elif role == "assistant":
            text = ""
            reasoning = ""
            tool_calls = []
            tool_messages = []
            
            if isinstance(content, list):
                for part in content:
                    ptype = part.get("type")
                    if ptype == "text":
                        text += part.get("text", "")
                    elif ptype == "reasoning":
                        reasoning += part.get("text", "")
                    elif ptype == "tool-call":
                        # Map frontend name to python name if needed
                        name_map = {
                            "getWeather": "get_weather",
                            "getStockAnalysis": "get_stock_analysis",
                            "searchWeb": "search_web"
                        }
                        raw_name = part.get("toolName", "")
                        mapped_name = name_map.get(raw_name, raw_name)
                        
                        tc = {
                            "name": mapped_name,
                            "id": part.get("toolCallId", ""),
                            "args": part.get("args", {})
                        }
                        tool_calls.append(tc)
                        
                        # Reconstruct ToolMessage if a result exists
                        if "result" in part:
                            tool_result = part["result"]
                            if not isinstance(tool_result, str):
                                res_str = json.dumps(tool_result)
                            else:
                                res_str = tool_result
                            tool_messages.append(
                                ToolMessage(
                                    content=res_str,
                                    name=mapped_name,
                                    tool_call_id=part.get("toolCallId", "")
                                )
                            )
            else:
                text = str(content)
                
            additional_kwargs = {}
            if reasoning:
                additional_kwargs["reasoning"] = reasoning
                
            ai_msg = AIMessage(
                content=text,
                additional_kwargs=additional_kwargs,
                tool_calls=tool_calls
            )
            langchain_msgs.append(ai_msg)
            
            # Immediately append any associated ToolMessages chronologically
            langchain_msgs.extend(tool_messages)
            
        elif role == "system":
            text = str(content)
            langchain_msgs.append(SystemMessage(content=text))
            
    return langchain_msgs

@app.get("/api/user/me")
def get_user_me(current_user = Depends(get_current_user)):
    return current_user

@app.get("/api/threads")
def get_threads(current_user = Depends(get_current_user), db = Depends(get_db)):
    threads = db.query(DBThread).filter(DBThread.user_id == current_user["uid"]).order_by(DBThread.created_at.desc()).all()
    return [{"id": t.id, "title": t.title, "createdAt": int(t.created_at.timestamp() * 1000)} for t in threads]

@app.post("/api/threads")
def create_thread(thread: ThreadCreate, current_user = Depends(get_current_user), db = Depends(get_db)):
    # Check if thread already exists
    existing = db.query(DBThread).filter(DBThread.id == thread.id, DBThread.user_id == current_user["uid"]).first()
    if existing:
        return {"status": "success", "id": thread.id, "message": "Thread already exists"}
        
    db_thread = DBThread(
        id=thread.id,
        title=thread.title,
        created_at=datetime.datetime.fromtimestamp(thread.createdAt / 1000) if thread.createdAt else datetime.datetime.utcnow(),
        user_id=current_user["uid"]
    )
    db.add(db_thread)
    db.commit()
    return {"status": "success", "id": thread.id}

@app.get("/api/threads/{thread_id}")
def get_thread_by_id(thread_id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    db_thread = db.query(DBThread).filter(DBThread.id == thread_id, DBThread.user_id == current_user["uid"]).first()
    if not db_thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    db_messages = db.query(DBMessage).filter(DBMessage.thread_id == thread_id).all()
    
    messages = []
    for m in db_messages:
        msg_obj = {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "metadata": m.metadata_ or {},
            "createdAt": int(m.created_at.timestamp() * 1000)
        }
        if m.role == "assistant":
            msg_obj["status"] = {"type": "complete", "reason": "stop"}
            
        messages.append({
            "parentId": m.parent_id,
            "message": msg_obj
        })
        
    return {
        "id": db_thread.id,
        "title": db_thread.title,
        "createdAt": int(db_thread.created_at.timestamp() * 1000),
        "headId": db_thread.head_id,
        "messages": messages
    }

@app.patch("/api/threads/{thread_id}")
def update_thread_by_id(thread_id: str, data: ThreadUpdate, current_user = Depends(get_current_user), db = Depends(get_db)):
    db_thread = db.query(DBThread).filter(DBThread.id == thread_id, DBThread.user_id == current_user["uid"]).first()
    if not db_thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    if data.title is not None:
        db_thread.title = data.title
    if data.headId is not None:
        db_thread.head_id = data.headId
        
    if data.messages is not None:
        # Overwrite all messages to sync frontend local state with Postgres perfectly
        db.query(DBMessage).filter(DBMessage.thread_id == thread_id).delete()
        for item in data.messages:
            msg = item.get("message")
            p_id = item.get("parentId")
            
            # Format content properly
            content = msg.get("content")
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
                
            created_at_val = msg.get("createdAt")
            if created_at_val:
                if isinstance(created_at_val, (int, float)):
                    created_at_dt = datetime.datetime.fromtimestamp(created_at_val / 1000)
                elif isinstance(created_at_val, str):
                    if created_at_val.isdigit():
                        created_at_dt = datetime.datetime.fromtimestamp(float(created_at_val) / 1000)
                    else:
                        try:
                            created_at_dt = datetime.datetime.fromisoformat(created_at_val.replace("Z", "+00:00"))
                        except Exception:
                            created_at_dt = datetime.datetime.utcnow()
                else:
                    created_at_dt = datetime.datetime.utcnow()
            else:
                created_at_dt = datetime.datetime.utcnow()
                
            db_msg = DBMessage(
                id=msg.get("id"),
                thread_id=thread_id,
                parent_id=p_id,
                role=msg.get("role"),
                content=content,
                metadata_=msg.get("metadata", {}),
                created_at=created_at_dt
            )
            db.add(db_msg)
            
    db_thread.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "success"}

@app.delete("/api/threads/{thread_id}")
def delete_thread_by_id(thread_id: str, current_user = Depends(get_current_user), db = Depends(get_db)):
    db_thread = db.query(DBThread).filter(DBThread.id == thread_id, DBThread.user_id == current_user["uid"]).first()
    if not db_thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    db.delete(db_thread)
    db.commit()
    return {"status": "success"}

@app.post("/api/chat")
async def chat(request: ChatRequest, current_user = Depends(get_current_user), db = Depends(get_db)):
    logger.info(f"Received API chat request for thread {request.threadId}")
    
    # 1. Ensure the thread exists and is assigned to this user
    db_thread = db.query(DBThread).filter(DBThread.id == request.threadId, DBThread.user_id == current_user["uid"]).first()
    if not db_thread:
        db_thread = DBThread(
            id=request.threadId,
            title="New Chat",
            user_id=current_user["uid"]
        )
        db.add(db_thread)
        db.commit()
        
    # 2. Extract and save the new user message
    user_msg = request.messages[-1]
    user_msg_id = user_msg.get("id") or str(uuid.uuid4())
    user_content = user_msg.get("content", [])
    
    # Check if user message already saved to avoid duplicates
    existing_user_msg = db.query(DBMessage).filter(DBMessage.id == user_msg_id).first()
    if not existing_user_msg:
        db_user_msg = DBMessage(
            id=user_msg_id,
            thread_id=request.threadId,
            parent_id=request.parentId,
            role="user",
            content=user_content,
            metadata_={},
            created_at=datetime.datetime.utcnow()
        )
        db.add(db_user_msg)
        
        # Auto rename thread if title is still default "New Chat"
        if db_thread.title == "New Chat" and len(user_content) > 0:
            text_part = next((p.get("text") for p in user_content if p.get("type") == "text"), "")
            if text_part:
                db_thread.title = text_part[:30] + ("..." if len(text_part) > 30 else "")
                
        db.commit()
    else:
        db_user_msg = existing_user_msg

    # 3. Retrieve active branch history using recursive parent pointer lookup
    history = get_active_branch_messages(db, request.threadId, request.parentId)
    history.append(db_user_msg)
    
    # 4. Convert branch to LangChain messages for state graph run
    langchain_messages = convert_to_langchain_messages(history)

    # 5. Conditional verbose logging based on VERBOSE_LEVEL
    logger.info(f"--- Resolved Chronological Tree Path (Total messages: {len(langchain_messages)}, VERBOSE_LEVEL={VERBOSE_LEVEL}) ---")
    
    if VERBOSE_LEVEL >= 2:
        # Log all previous messages, CoT, tool calls, tool messages, etc.
        for idx, msg in enumerate(langchain_messages):
            cot_info = ""
            if hasattr(msg, "additional_kwargs") and msg.additional_kwargs.get("reasoning"):
                cot_info = f" | CoT: '{msg.additional_kwargs['reasoning'].strip()}'"
                
            tc_info = ""
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                tc_info = f" | Tool Calls: {json.dumps(msg.tool_calls)}"
                
            tc_id_info = ""
            if hasattr(msg, "tool_call_id") and msg.tool_call_id:
                tc_id_info = f" | Tool Call ID: '{msg.tool_call_id}'"
                
            logger.info(f"  [Msg {idx}/{len(langchain_messages)}] {msg.__class__.__name__}: '{msg.content.strip()}'{cot_info}{tc_info}{tc_id_info}")
    elif VERBOSE_LEVEL == 1:
        # Log last 5 messages (user and ai / other)
        start_idx = max(0, len(langchain_messages) - 5)
        logger.info(f"  Showing last {len(langchain_messages) - start_idx} messages:")
        for idx in range(start_idx, len(langchain_messages)):
            msg = langchain_messages[idx]
            logger.info(f"  [Msg {idx}] {msg.__class__.__name__}: '{msg.content[:100].strip()}...'")
            
    initial_state = {"messages": langchain_messages}

    async def ndjson_stream():
        acc_tool_calls_dict = {}
        parts = []
        assistant_msg_id = str(uuid.uuid4())

        async for chunk in workflow.astream(initial_state, stream_mode="updates"):
            acc_reasoning = ""
            acc_text = ""
            
            for node_name, state_update in chunk.items():
                logger.info(f"Graph completed node: '{node_name}'")
                if not state_update:
                    continue
                
                if "messages" in state_update:
                    messages = state_update["messages"]
                    if not isinstance(messages, list):
                        messages = [messages]
                    
                    for msg in messages:
                        if isinstance(msg, AIMessage):
                            if msg.content:
                                acc_text += str(msg.content)
                            if hasattr(msg, "additional_kwargs") and "reasoning" in msg.additional_kwargs:
                                acc_reasoning += msg.additional_kwargs["reasoning"]
                            for tc in msg.tool_calls:
                                name_map = {
                                    "get_weather": "getWeather",
                                    "get_stock_analysis": "getStockAnalysis",
                                    "search_web": "searchWeb"
                                }
                                mapped_name = name_map.get(tc["name"], tc["name"])
                                
                                tc_data = {
                                    "name": mapped_name,
                                    "id": tc["id"],
                                    "args": tc["args"]
                                }
                                acc_tool_calls_dict[tc["id"]] = tc_data
                        elif isinstance(msg, ToolMessage):
                            if msg.tool_call_id in acc_tool_calls_dict:
                                try:
                                    acc_tool_calls_dict[msg.tool_call_id]["result"] = json.loads(msg.content)
                                except:
                                    acc_tool_calls_dict[msg.tool_call_id]["result"] = msg.content

            parts = []
            if acc_reasoning:
                parts.append({"type": "reasoning", "text": acc_reasoning})
            if acc_text:
                parts.append({"type": "text", "text": acc_text})
            for tc in acc_tool_calls_dict.values():
                tc_part = {
                    "type": "tool-call", 
                    "toolName": tc["name"], 
                    "toolCallId": tc["id"], 
                    "args": tc["args"], 
                    "argsText": json.dumps(tc["args"])
                }
                if "result" in tc:
                    tc_part["result"] = tc["result"]
                parts.append(tc_part)

            if parts:
                yield json.dumps({"content": parts}) + "\n"

        # 5. Save the compiled assistant message to the database and update head pointer
        if parts:
            db_save = SessionLocal()
            try:
                db_assistant_msg = DBMessage(
                    id=assistant_msg_id,
                    thread_id=request.threadId,
                    parent_id=user_msg_id,
                    role="assistant",
                    content=parts,
                    metadata_={},
                    created_at=datetime.datetime.utcnow()
                )
                db_save.add(db_assistant_msg)
                
                # Sync thread head pointer
                thread_obj = db_save.query(DBThread).filter(DBThread.id == request.threadId).first()
                if thread_obj:
                    thread_obj.head_id = assistant_msg_id
                    
                db_save.commit()
                logger.info(f"Saved generated assistant message {assistant_msg_id} to database.")
            except Exception as ex:
                logger.error(f"Error saving assistant message to database: {ex}")
                db_save.rollback()
            finally:
                db_save.close()

    return StreamingResponse(ndjson_stream(), media_type="application/x-ndjson")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=8080,
        reload=True,
        reload_dirs=["backend"],
        reload_excludes=["*.db", "*.db-journal", "*.db-wal", "*.db-shm"]
    )
