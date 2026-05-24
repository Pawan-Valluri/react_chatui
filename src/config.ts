/**
 * BACKEND CONFIGURATION
 * 
 * Simple configuration file designed for Python developers.
 * Toggle this file to switch between an offline simulated UI and a live python backend.
 */
export const BACKEND_CONFIG = {
  // Set to TRUE to connect this frontend to your python FastAPI backend!
  USE_BACKEND_API: true,

  // Base API endpoint where your FastAPI chat service runs
  // Use relative path for production (behind proxy) or absolute for local dev
  BASE_URL: import.meta.env.VITE_API_URL || "/api",

  // The local uvicorn server endpoint where your FastAPI chat service runs
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "/api/chat",

};
