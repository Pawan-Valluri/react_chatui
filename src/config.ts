/**
 * BACKEND CONFIGURATION
 * 
 * Simple configuration file designed for Python developers.
 * Toggle this file to switch between an offline simulated UI and a live python backend.
 */
export const BACKEND_CONFIG = {
  // Set to TRUE to connect this frontend to your python FastAPI backend!
  // Set to FALSE to run standalone in offline mock simulation mode.
  USE_BACKEND_API: true,

  // The local uvicorn server endpoint where your FastAPI chat service runs
  BACKEND_URL: "http://localhost:8000/api/chat",
};
