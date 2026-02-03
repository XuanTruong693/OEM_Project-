import { API_SERVER_URL } from '../api/config';

// Helper to get full image URL correctly in production (Cloudflare Pages + separate Backend)
export const getFullImageUrl = (path) => {
    if (!path) return "/icons/UI Image/default-avatar.png";

    // If path is already absolute or data URI, return as is
    if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }

    // If path is relative and starts with /api/, it's a backend resource
    // Prepend the API server URL
    if (path.startsWith("/api/")) {
        return `${API_SERVER_URL}${path}`;
    }

    // Frontend static assets (e.g. /icons/..., /assets/...) or other relative paths
    // should remain relative to be served by the frontend server
    return path;
};
