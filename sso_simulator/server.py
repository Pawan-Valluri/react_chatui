import hashlib
import time
import uuid
import logging
import jwt
from fastapi import FastAPI, Request, Response, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Logger Configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("AuthBlueSSOSimulator")

app = FastAPI(title="AuthBlue SSO Simulator", version="1.0.0")

# Enable CORS for frontend integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "super-secret-authblue-simulation-key-32bytes"
ALGORITHM = "HS256"

# Pre-configured mock identities for developers to quickly test
MOCK_PROFILES = {
    "cfrost": {
        "uid": "cfrost",
        "firstname": "Charles",
        "lastname": "Frost",
        "fullname": "Charles Frost",
        "employeeid": "8881234",
        "email": "charles.frost@aexp.com",
        "groups": ["SSO_APP_USER", "SSO_APP_ADMIN"]
    },
    "dguest": {
        "uid": "dguest",
        "firstname": "Developer",
        "lastname": "Guest",
        "fullname": "Developer Guest",
        "employeeid": "1234567",
        "email": "developer.guest@aexp.com",
        "groups": ["SSO_APP_USER"]
    },
    "admin": {
        "uid": "admin",
        "firstname": "System",
        "lastname": "Admin",
        "fullname": "System Administrator",
        "employeeid": "0000001",
        "email": "admin.system@aexp.com",
        "groups": ["SSO_APP_USER", "SSO_APP_ADMIN", "SSO_APP_SUPER_ADMIN"]
    }
}

class UserInfoScope(BaseModel):
    attributes: Optional[List[str]] = None
    groups: Optional[List[str]] = None

class UserInfoRequest(BaseModel):
    scope: Optional[UserInfoScope] = None

# Premium Dark HTML + CSS Centurion theme login page
LOGIN_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AuthBlue Identity Gateway</title>
    <style>
        :root {
            --bg-main: #06070a;
            --bg-card: #0c0e14;
            --border-glow: #1e3a8a;
            --accent-glow: #2563eb;
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-main);
            color: var(--text-primary);
            font-family: var(--font-family);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
            position: relative;
        }

        /* Subtle ambient glow in background */
        body::before {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
            top: -100px;
            left: -100px;
            z-index: 0;
        }

        body::after {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, rgba(0, 0, 0, 0) 70%);
            bottom: -150px;
            right: -100px;
            z-index: 0;
        }

        .login-container {
            background: var(--bg-card);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 28px;
            width: 450px;
            padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 
                        0 0 40px rgba(37, 99, 235, 0.05);
            backdrop-filter: blur(10px);
            z-index: 10;
            position: relative;
            animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .logo-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 35px;
            text-align: center;
        }

        .logo-badge {
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
            border: 1px solid rgba(37, 99, 235, 0.3);
            border-radius: 16px;
            padding: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.2);
        }

        .logo-badge svg {
            width: 28px;
            height: 28px;
            fill: #60a5fa;
        }

        .logo-section h2 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, #ffffff, #9ca3af);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .logo-section p {
            font-size: 13px;
            color: var(--text-secondary);
            margin-top: 5px;
            font-weight: 400;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
            color: var(--text-secondary);
        }

        .form-select, .form-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 14px;
            color: var(--text-primary);
            font-family: var(--font-family);
            font-size: 14px;
            outline: none;
            transition: all 0.3s ease;
        }

        .form-select:focus, .form-input:focus {
            border-color: var(--accent-glow);
            box-shadow: 0 0 15px rgba(37, 99, 235, 0.15);
            background: rgba(255, 255, 255, 0.05);
        }

        .form-select option {
            background-color: var(--bg-card);
            color: var(--text-primary);
        }

        .custom-inputs {
            border-top: 1px dashed rgba(255, 255, 255, 0.08);
            padding-top: 20px;
            margin-top: 20px;
            display: none;
        }

        .btn-submit {
            width: 100%;
            background: linear-gradient(135deg, var(--accent-glow) 0%, #1d4ed8 100%);
            border: none;
            border-radius: 14px;
            padding: 14px;
            color: white;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
            margin-top: 10px;
        }

        .btn-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }

        .btn-submit:active {
            transform: translateY(1px);
        }

        .footer-info {
            text-align: center;
            margin-top: 25px;
            font-size: 11px;
            color: var(--text-secondary);
            letter-spacing: 0.5px;
        }
    </style>
    <script>
        function handleProfileChange() {
            const select = document.getElementById("profile_select");
            const customDiv = document.getElementById("custom_inputs");
            if (select.value === "custom") {
                customDiv.style.display = "block";
            } else {
                customDiv.style.display = "none";
            }
        }
    </script>
</head>
<body>

<div class="login-container">
    <div class="logo-section">
        <div class="logo-badge">
            <!-- Shield icon representing protected app gateway -->
            <svg viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <h2>AuthBlue SSO Simulator</h2>
        <p>Local Mock Identity Provider Gateway</p>
    </div>

    <form action="/login" method="POST">
        <input type="hidden" name="redirect_uri" value="{redirect_uri}">

        <div class="form-group">
            <label for="profile_select">Choose Simulated Identity</label>
            <select id="profile_select" name="profile" class="form-select" onchange="handleProfileChange()">
                <option value="cfrost">Charles Frost (Charles.Frost@aexp.com - Admin)</option>
                <option value="dguest">Developer Guest (Developer.Guest@aexp.com - User)</option>
                <option value="admin">System Admin (Admin.System@aexp.com - Super Admin)</option>
                <option value="custom">Custom Identity Profile...</option>
            </select>
        </div>

        <div id="custom_inputs" class="custom-inputs">
            <div class="form-group">
                <label for="ad_id">Active Directory ID</label>
                <input type="text" id="ad_id" name="ad_id" class="form-input" placeholder="e.g., jsmith">
            </div>
            <div class="form-group">
                <label for="first_name">First Name</label>
                <input type="text" id="first_name" name="first_name" class="form-input" placeholder="e.g., John">
            </div>
            <div class="form-group">
                <label for="last_name">Last Name</label>
                <input type="text" id="last_name" name="last_name" class="form-input" placeholder="e.g., Smith">
            </div>
            <div class="form-group">
                <label for="email">Corporate Email</label>
                <input type="email" id="email" name="email" class="form-input" placeholder="e.g., john.smith@aexp.com">
            </div>
        </div>

        <button type="submit" class="btn-submit">Authenticate Securely</button>
    </form>

    <div class="footer-info">
        🛡️ AuthBlue Shield Protocol Active (MOCKED LOCAL)
    </div>
</div>

</body>
</html>
"""

def generate_bluetoken(user_data: dict) -> str:
    iat = int(time.time())
    exp = iat + 86400  # Token valid for 24h
    
    # Generate unique GUID and employee id based on identity
    guid = hashlib.md5(user_data["uid"].encode("utf-8")).hexdigest()
    
    payload = {
        "GUID": guid,
        "employeeid": user_data.get("employeeid", "8881234"),
        "firstname": user_data["firstname"],
        "lastname": user_data["lastname"],
        "fullname": user_data["fullname"],
        "email": user_data["email"],
        "udn": f"CN={user_data['fullname']},OU=FIMPortal,OU=AMEX,DC=ADS-SSO-1,DC=AEXP,DC=COM",
        "sub": str(hash(user_data["uid"]) % 10000000),
        "amr": ["pwd"],
        "iss": "https://aexp.com",
        "aud": "*-dev.aexp.com",
        "uid": user_data["uid"],
        "groups": user_data.get("groups", ["SSO_APP_USER"]),
        "exp": exp,
        "iat": iat,
        "jti": str(uuid.uuid4())
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, redirect_uri: str = "http://localhost:5173"):
    logger.info(f"SSO Gateway [GET /]: Rendering corporate portal. redirect_uri={redirect_uri}")
    return LOGIN_HTML.replace("{redirect_uri}", redirect_uri)

@app.post("/login")
async def login(
    response: Response,
    profile: str = Form(...),
    ad_id: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    redirect_uri: str = Form("http://localhost:5173")
):
    if profile == "custom":
        uid = (ad_id or "custom_user").strip().lower()
        fname = (first_name or "Custom").strip()
        lname = (last_name or "User").strip()
        fullname = f"{fname} {lname}"
        mail = (email or f"{uid}@aexp.com").strip()
        
        user_data = {
            "uid": uid,
            "firstname": fname,
            "lastname": lname,
            "fullname": fullname,
            "employeeid": "9999999",
            "email": mail,
            "groups": ["SSO_APP_USER"]
        }
    else:
        user_data = MOCK_PROFILES.get(profile, MOCK_PROFILES["dguest"])
        
    token = generate_bluetoken(user_data)
    logger.info(f"SSO Gateway [/login]: Profile '{profile}' authenticated successfully. AD ID: '{user_data['uid']}'. Issuing cookie and redirecting.")
    
    # Issue cookie just like actual AuthBlue!
    # In local, we set samesite=Lax and domain=None so it works locally across ports
    response = RedirectResponse(url=redirect_uri, status_code=303)
    response.set_cookie(
        key="bluetoken",
        value=token,
        max_age=86400,
        httponly=True,
        samesite="lax",
        secure=False
    )
    return response

@app.get("/logout")
async def logout(response: Response, redirect_uri: str = "http://localhost:5173"):
    logger.info(f"SSO Gateway [/logout]: Active user session logged out. Clearing bluetoken cookie and redirecting to {redirect_uri}.")
    response = RedirectResponse(url=redirect_uri, status_code=303)
    response.delete_cookie(key="bluetoken")
    return response

# Standard AuthBlue userinfo endpoints
@app.get("/v1/user/userinfo")
async def get_userinfo(request: Request):
    token = request.cookies.get("bluetoken")
    if not token:
        # Fallback to authorization header if any
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        logger.warning("SSO Gateway [GET /v1/user/userinfo]: Unauthorized access attempt. No bluetoken found.")
        return {"status": "error", "message": "No valid bluetoken cookie or bearer token found"}
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.info(f"SSO Gateway [GET /v1/user/userinfo]: Valid token parsed for UID '{payload['uid']}'.")
        return {
            "status": "success",
            "message": "success",
            "uid": payload["uid"],
            "firstname": payload["firstname"],
            "lastname": payload["lastname"],
            "fullname": payload["fullname"],
            "employeeid": payload["employeeid"],
            "email": payload["email"],
            "GUID": payload["GUID"],
            "udn": payload["udn"]
        }
    except Exception as e:
        logger.error(f"SSO Gateway [GET /v1/user/userinfo]: Token decoding failed: {e}")
        return {"status": "error", "message": f"Token decoding failed: {str(e)}"}

@app.post("/v1/user/userinfo")
async def post_userinfo(request: Request, body: UserInfoRequest):
    token = request.cookies.get("bluetoken")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        logger.warning("SSO Gateway [POST /v1/user/userinfo]: Unauthorized access attempt. No bluetoken found.")
        return {"status": "error", "message": "No valid bluetoken cookie or bearer token found"}
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Filter requested groups
        requested_groups = body.scope.groups if body.scope and body.scope.groups else []
        user_groups = payload.get("groups", [])
        
        matched_groups = [g for g in requested_groups if g in user_groups]
        logger.info(f"SSO Gateway [POST /v1/user/userinfo]: Validated entitlements for UID '{payload['uid']}'. Groups matched: {matched_groups}")
        
        return {
            "status": "success",
            "message": "success",
            "uid": payload["uid"],
            "fullname": payload["fullname"],
            "email": payload["email"],
            "groups": matched_groups
        }
    except Exception as e:
        logger.error(f"SSO Gateway [POST /v1/user/userinfo]: Token decoding failed: {e}")
        return {"status": "error", "message": f"Token decoding failed: {str(e)}"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=8085,
        reload=True,
        reload_dirs=["sso_simulator"],
        reload_excludes=["*.db", "*.db-journal", "*.db-wal", "*.db-shm"]
    )
