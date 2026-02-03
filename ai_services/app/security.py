"""
Security middleware for AI service
Handles IP filtering, request logging, and threat detection
"""
import logging
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
from collections import defaultdict
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

WHITELIST = {
    "127.0.0.1",
    "::1",
    "localhost",
    "103.252.136.61"
}
BLACKLIST = set()

BLOCKED_METHODS = {"CONNECT", "TRACE", "TRACK"}

SUSPICIOUS_PATTERNS = [
    "/login", "/admin", "/wp-admin", "/phpMyAdmin",
    "/phpmyadmin", "/.env", "/.git", "/config",
    "/backup", "/database", "/sql"
]

request_counts = defaultdict(list)
RATE_LIMIT = 1000  # Max requests per minute (high capacity for 200+ students)
RATE_WINDOW = 60  # seconds

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # 1. Check whitelist (allow immediately)
        if client_ip in WHITELIST:
            return await call_next(request)
        
        # 2. Check blacklist (block immediately)
        if client_ip in BLACKLIST:
            logger.warning(f"[BLOCKED] Blacklisted IP: {client_ip} - {request.method} {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Access forbidden"}
            )
        
        # 3. Block dangerous methods
        if request.method in BLOCKED_METHODS:
            self._log_suspicious(client_ip, request, "Dangerous HTTP method")
            self._add_to_blacklist(client_ip, f"Used {request.method} method")
            return JSONResponse(
                status_code=405,
                content={"detail": "Method not allowed"}
            )
        
        # 4. Check suspicious URL patterns
        path = request.url.path.lower()
        if any(pattern in path for pattern in SUSPICIOUS_PATTERNS):
            self._log_suspicious(client_ip, request, "Suspicious URL pattern")
            self._add_to_blacklist(client_ip, f"Accessed suspicious path: {path}")
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"}
            )
        
        # 5. Rate limiting (NOT blacklisting - allow retry)
        if self._is_rate_limited(client_ip):
            logger.warning(f"[RATE_LIMITED] {client_ip} - {request.method} {request.url.path}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please retry after a moment."}
            )
        
        # 6. Log valid request
        logger.info(f"[ALLOWED] {client_ip} - {request.method} {request.url.path}")
        
        # Process request
        response = await call_next(request)
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP from request headers"""
        # Check common proxy headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _log_suspicious(self, ip: str, request: Request, reason: str):
        """Log detailed information about suspicious request"""
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "ip": ip,
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query),
            "headers": dict(request.headers),
            "reason": reason,
        }
        logger.warning(f"[SUSPICIOUS] {json.dumps(log_data, indent=2)}")
    
    def _add_to_blacklist(self, ip: str, reason: str):
        """Add IP to blacklist and log the action"""
        if ip not in BLACKLIST and ip not in WHITELIST:
            BLACKLIST.add(ip)
            logger.error(f"[BLACKLIST] IP added: {ip} - Reason: {reason}")
            # Write to file for persistence
            with open("blacklist.txt", "a") as f:
                f.write(f"{datetime.now().isoformat()} - {ip} - {reason}\n")
    
    def _is_rate_limited(self, ip: str) -> bool:
        """Check if IP has exceeded rate limit"""
        now = datetime.now()
        cutoff = now - timedelta(seconds=RATE_WINDOW)
        
        # Clean old requests
        request_counts[ip] = [
            req_time for req_time in request_counts[ip]
            if req_time > cutoff
        ]
        
        # Add current request
        request_counts[ip].append(now)
        
        # Check limit
        return len(request_counts[ip]) > RATE_LIMIT


def load_blacklist():
    """Load blacklist from file on startup"""
    try:
        with open("blacklist.txt", "r") as f:
            for line in f:
                if " - " in line:
                    parts = line.strip().split(" - ")
                    if len(parts) >= 2:
                        ip = parts[1]
                        BLACKLIST.add(ip)
        logger.info(f"[Security] Loaded {len(BLACKLIST)} IPs from blacklist")
    except FileNotFoundError:
        logger.info("[Security] No existing blacklist file found, starting fresh")
