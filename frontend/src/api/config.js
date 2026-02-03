// API configuration for production and development
// Automatically detect production environment by hostname

const isProduction = typeof window !== 'undefined' &&
    (window.location.hostname === 'www.oem.io.vn' || window.location.hostname === 'oem.io.vn');

// Production URLs (via Cloudflare Tunnel)
const PROD_API_URL = 'https://api.oem.io.vn/api';
const PROD_SERVER_URL = 'https://api.oem.io.vn';
const PROD_SOCKET_URL = 'https://api.oem.io.vn';
const PROD_AI_URL = 'https://ai.oem.io.vn';

// Development URLs (fallback)
const DEV_API_URL = 'http://localhost:5000/api';
const DEV_SERVER_URL = 'http://localhost:5000';
const DEV_SOCKET_URL = 'http://localhost:5000';
const DEV_AI_URL = 'http://localhost:8000';

export const API_BASE_URL = isProduction ? PROD_API_URL : DEV_API_URL;
export const API_SERVER_URL = isProduction ? PROD_SERVER_URL : DEV_SERVER_URL;
export const SOCKET_URL = isProduction ? PROD_SOCKET_URL : DEV_SOCKET_URL;
export const AI_SERVICE_URL = isProduction ? PROD_AI_URL : DEV_AI_URL;
