"""
VirusTotal Integration for Linscope
Handles IOC lookups with rate limiting, caching, and smart filtering
"""

import sqlite3
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
import httpx
from fastapi import HTTPException
import os
import ipaddress

# ------------------- Configuration -------------------
VT_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
VT_BASE_URL = "https://www.virustotal.com/api/v3"
RATE_LIMIT_PER_MINUTE = 4
CACHE_DURATION_HOURS = 24
DAILY_LIMIT = 500
MONTHLY_LIMIT = 15500

# Database path (same as main linscope.db)
DB_PATH = os.path.join(os.path.dirname(__file__), "linscope.db")


# ------------------- Rate Limiter -------------------
class RateLimiter:
    """Simple token bucket rate limiter: 4 requests per minute"""
    
    def __init__(self):
        self.tokens = RATE_LIMIT_PER_MINUTE
        self.last_refill = time.time()
        self.lock = asyncio.Lock()
    
    async def acquire(self) -> Tuple[bool, Optional[float]]:
        """
        Acquire a rate limit token.
        Returns: (allowed: bool, wait_seconds: float or None)
        """
        async with self.lock:
            await self._refill()
            if self.tokens > 0:
                self.tokens -= 1
                return True, None
            else:
                # Calculate wait time until next token
                wait_time = 60 - (time.time() - self.last_refill)
                return False, max(0, wait_time)
    
    async def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill
        if elapsed >= 60:
            self.tokens = RATE_LIMIT_PER_MINUTE
            self.last_refill = now


# Global rate limiter instance
vt_rate_limiter = RateLimiter()


# ------------------- Cache Management -------------------
def init_cache_db():
    """Create cache table and usage tracking if they don't exist"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Main cache table
    c.execute('''
        CREATE TABLE IF NOT EXISTS virustotal_cache (
            ioc_type TEXT NOT NULL,
            ioc_value TEXT NOT NULL,
            response_json TEXT NOT NULL,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL,
            PRIMARY KEY (ioc_type, ioc_value)
        )
    ''')
    
    # Usage tracking table (for daily/monthly limits)
    c.execute('''
        CREATE TABLE IF NOT EXISTS virustotal_usage (
            query_date DATE NOT NULL,
            query_month TEXT NOT NULL,
            daily_count INTEGER DEFAULT 0,
            monthly_count INTEGER DEFAULT 0,
            PRIMARY KEY (query_date, query_month)
        )
    ''')
    
    # Indices for performance
    c.execute('CREATE INDEX IF NOT EXISTS idx_vt_cache_expires ON virustotal_cache(expires_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_vt_usage_date ON virustotal_usage(query_date)')
    
    conn.commit()
    conn.close()


def get_cached_result(ioc_type: str, ioc_value: str) -> Optional[Dict]:
    """Retrieve cached VirusTotal result if still valid"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        'SELECT response_json FROM virustotal_cache WHERE ioc_type=? AND ioc_value=? AND expires_at > ?',
        (ioc_type, ioc_value, time.time())
    )
    row = c.fetchone()
    conn.close()
    
    if row:
        return json.loads(row[0])
    return None


def cache_result(ioc_type: str, ioc_value: str, response: Dict):
    """Cache VirusTotal response for 24 hours"""
    now = time.time()
    expires_at = now + (CACHE_DURATION_HOURS * 3600)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT OR REPLACE INTO virustotal_cache 
        (ioc_type, ioc_value, response_json, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (ioc_type, ioc_value, json.dumps(response), now, expires_at))
    conn.commit()
    conn.close()


def cleanup_expired_cache():
    """Remove expired cache entries"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM virustotal_cache WHERE expires_at < ?', (time.time(),))
    deleted = c.rowcount
    conn.commit()
    conn.close()
    if deleted > 0:
        print(f"[VT] Cleaned up {deleted} expired cache entries")


def check_daily_limit() -> Tuple[bool, int, int]:
    """
    Check if daily limit (500) is exceeded
    Returns: (allowed: bool, used: int, remaining: int)
    """
    today = datetime.now().strftime("%Y-%m-%d")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) FROM virustotal_cache WHERE DATE(created_at, "unixepoch") = ?', (today,))
    count = c.fetchone()[0]
    conn.close()
    
    remaining = max(0, DAILY_LIMIT - count)
    return count < DAILY_LIMIT, count, remaining


def check_monthly_limit() -> Tuple[bool, int, int]:
    """
    Check if monthly limit (15,500) is exceeded
    Returns: (allowed: bool, used: int, remaining: int)
    """
    month = datetime.now().strftime("%Y-%m")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) FROM virustotal_cache WHERE strftime("%Y-%m", created_at, "unixepoch") = ?', (month,))
    count = c.fetchone()[0]
    conn.close()
    
    remaining = max(0, MONTHLY_LIMIT - count)
    return count < MONTHLY_LIMIT, count, remaining


# ------------------- Smart IOC Filtering -------------------
def is_private_ip(ip: str) -> bool:
    """Check if IP is in private ranges (RFC1918)"""
    try:
        ip_obj = ipaddress.ip_address(ip)
        # Check private ranges
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            return True
        return False
    except Exception:
        return False


def is_internal_domain(domain: str) -> bool:
    """Check if domain is internal/system domain"""
    internal_tlds = {'.local', '.internal', '.localhost', '.example'}
    domain_lower = domain.lower()
    
    # Check internal TLDs
    for tld in internal_tlds:
        if domain_lower.endswith(tld):
            return True
    
    # Check for localhost variants
    if domain_lower in ('localhost', '127.0.0.1', '::1'):
        return True
    
    return False


def should_skip_ioc(ioc_type: str, ioc_value: str, alert_severity: str = None) -> Tuple[bool, str]:
    """
    Determine if an IOC should be skipped based on filtering rules
    Returns: (should_skip: bool, reason: str)
    """
    # Skip if already checked recently (cache handled separately)
    # This function is for static rules
    
    if ioc_type == 'ip':
        if is_private_ip(ioc_value):
            return True, f'Private IP address: {ioc_value}'
    
    elif ioc_type == 'domain':
        if is_internal_domain(ioc_value):
            return True, f'Internal domain: {ioc_value}'
    
    elif ioc_type == 'hash':
        # Skip if hash looks like placeholder or empty
        if not ioc_value or len(ioc_value) < 32:
            return True, 'Invalid hash format'
    
    return False, ''


def calculate_priority(ioc_type: str, ioc_value: str, alert_count: int = 1, severity: str = None) -> int:
    """
    Calculate priority score (0-100) for IOC checking order
    Higher score = higher priority
    """
    score = 0
    
    # Base score by alert severity
    if severity == 'critical':
        score += 40
    elif severity == 'high':
        score += 30
    elif severity == 'medium':
        score += 20
    elif severity == 'low':
        score += 10
    
    # Boost for multiple occurrences
    if alert_count > 5:
        score += 30
    elif alert_count > 2:
        score += 20
    elif alert_count > 1:
        score += 10
    
    # Type-based scoring
    if ioc_type == 'hash':
        score += 25  # File hashes are high value
    elif ioc_type == 'ip':
        score += 15
    elif ioc_type == 'domain':
        score += 10
    
    return min(score, 100)


# ------------------- VirusTotal API Client -------------------
async def query_virustotal(ioc_type: str, ioc_value: str) -> Dict[str, Any]:
    """
    Query VirusTotal API for a single IOC
    Rate limited to 4 requests per minute
    """
    # Wait for rate limit token
    allowed, wait_seconds = await vt_rate_limiter.acquire()
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {int(wait_seconds)} seconds"
        )
    
    # Map IOC type to VT endpoint
    endpoint_map = {
        'ip': f'/ip_addresses/{ioc_value}',
        'domain': f'/domains/{ioc_value}',
        'hash': f'/files/{ioc_value}'
    }
    
    endpoint = endpoint_map.get(ioc_type)
    if not endpoint:
        raise HTTPException(status_code=400, detail=f"Invalid IOC type: {ioc_type}")
    
    url = f"{VT_BASE_URL}{endpoint}"
    headers = {
        "x-apikey": VT_API_KEY,
        "accept": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return {"error": "Not found in VirusTotal", "malicious": 0, "status": "unknown"}
            elif response.status_code == 403:
                return {"error": "Invalid VirusTotal API key"}
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="VirusTotal rate limit exceeded")
            else:
                return {"error": f"API error: {response.status_code}"}
                
        except httpx.TimeoutException:
            return {"error": "Request timeout"}
        except Exception as e:
            return {"error": str(e)}


def parse_vt_response(ioc_type: str, ioc_value: str, vt_data: Dict) -> Dict[str, Any]:
    """
    Extract useful information from VirusTotal response
    Returns: { malicious_count, suspicious_count, untrusted_count, last_analysis_date, link }
    """
    result = {
        "malicious": 0,
        "suspicious": 0,
        "untrusted": 0,
        "total": 0,
        "last_analysis": None,
        "categories": [],
        "link": None
    }
    
    if "data" in vt_data and "attributes" in vt_data["data"]:
        attrs = vt_data["data"]["attributes"]
        
        # Get last analysis stats
        if "last_analysis_stats" in attrs:
            stats = attrs["last_analysis_stats"]
            result["malicious"] = stats.get("malicious", 0)
            result["suspicious"] = stats.get("suspicious", 0)
            result["untrusted"] = stats.get("untrusted", 0)
            result["total"] = sum(stats.values())
        
        # Get last analysis date
        if "last_analysis_date" in attrs:
            result["last_analysis"] = datetime.utcfromtimestamp(
                attrs["last_analysis_date"]
            ).isoformat()
        
        # Get categories
        if "categories" in attrs:
            result["categories"] = list(attrs["categories"].values())[:3]  # Top 3
    
    # Build VT link
    if ioc_type == 'ip':
        result["link"] = f"https://www.virustotal.com/gui/ip_address/{ioc_value}"
    elif ioc_type == 'domain':
        result["link"] = f"https://www.virustotal.com/gui/domain/{ioc_value}"
    elif ioc_type == 'hash':
        result["link"] = f"https://www.virustotal.com/gui/file/{ioc_value}"
    
    return result


# ------------------- FastAPI Endpoints -------------------
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import asyncio

router = APIRouter()


class SingleIOCRequest(BaseModel):
    type: str  # "ip", "domain", "hash"
    value: str


class BatchIOCRequest(BaseModel):
    iocs: List[SingleIOCRequest]


@router.post("/api/check-ioc")
async def check_ioc(req: SingleIOCRequest):
    """
    Check a single IOC against VirusTotal with caching and rate limiting
    """
    if not VT_API_KEY:
        raise HTTPException(status_code=500, detail="VirusTotal API key not configured")
    
    ioc_type = req.type.lower()
    ioc_value = req.value.strip()
    
    # Validate IOC type
    if ioc_type not in ('ip', 'domain', 'hash'):
        raise HTTPException(status_code=400, detail="Invalid IOC type. Use 'ip', 'domain', or 'hash'")
    
    # Check cache first
    cached = get_cached_result(ioc_type, ioc_value)
    if cached:
        return {"cached": True, "result": cached}
    
    # Check daily and monthly limits
    daily_ok, daily_used, daily_remaining = check_daily_limit()
    monthly_ok, monthly_used, monthly_remaining = check_monthly_limit()
    
    if not daily_ok:
        return {
            "cached": False,
            "skipped": True,
            "reason": f"Daily quota exceeded ({DAILY_LIMIT})",
            "result": {"malicious": 0, "suspicious": 0, "status": "quota_exceeded"}
        }
    
    if not monthly_ok:
        return {
            "cached": False,
            "skipped": True,
            "reason": f"Monthly quota exceeded ({MONTHLY_LIMIT})",
            "result": {"malicious": 0, "suspicious": 0, "status": "quota_exceeded"}
        }
    
    # Check if IOC should be filtered
    should_skip, reason = should_skip_ioc(ioc_type, ioc_value)
    if should_skip:
        return {
            "cached": False,
            "skipped": True,
            "reason": reason,
            "result": {"malicious": 0, "suspicious": 0, "status": "filtered"}
        }
    
    # Query VirusTotal
    try:
        vt_response = await query_virustotal(ioc_type, ioc_value)
        
        # Parse response
        parsed = parse_vt_response(ioc_type, ioc_value, vt_response)
        
        # Add error info if present
        if "error" in vt_response:
            parsed["error"] = vt_response["error"]
        
        # Cache result
        cache_result(ioc_type, ioc_value, parsed)
        
        return {
            "cached": False,
            "skipped": False,
            "result": parsed
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking IOC: {str(e)}")


@router.post("/api/batch-check-ioc")
async def batch_check_ioc(req: BatchIOCRequest):
    """
    Process multiple IOCs with smart filtering, rate limiting, and priority ordering
    """
    if not VT_API_KEY:
        raise HTTPException(status_code=500, detail="VirusTotal API key not configured")
    
    # Clean old cache entries on batch request (runs occasionally)
    if time.time() % 100 < 1:  # ~1% chance on each request
        cleanup_expired_cache()
    
    # Check limits upfront
    daily_ok, daily_used, daily_remaining = check_daily_limit()
    monthly_ok, monthly_used, monthly_remaining = check_monthly_limit()
    
    if not daily_ok or not monthly_ok:
        return {
            "total": len(req.iocs),
            "processed": 0,
            "skipped_or_cached": len(req.iocs),
            "reason": "Quota exceeded",
            "results": [
                {
                    "type": ioc.type,
                    "value": ioc.value,
                    "skipped": True,
                    "reason": "Quota exceeded",
                    "result": {"error": "Quota exceeded"}
                }
                for ioc in req.iocs
            ]
        }
    
    # Separate IOCs by priority
    high_priority = []
    normal_priority = []
    skipped = []
    
    for ioc in req.iocs:
        ioc_type = ioc.type.lower()
        ioc_value = ioc.value.strip()
        
        # Validate
        if ioc_type not in ('ip', 'domain', 'hash'):
            continue
        
        # Check cache
        cached = get_cached_result(ioc_type, ioc_value)
        if cached:
            skipped.append({
                "type": ioc_type,
                "value": ioc_value,
                "skipped": True,
                "reason": "cached",
                "result": cached
            })
            continue
        
        # Apply filtering
        should_skip, reason = should_skip_ioc(ioc_type, ioc_value)
        if should_skip:
            skipped.append({
                "type": ioc_type,
                "value": ioc_value,
                "skipped": True,
                "reason": reason,
                "result": {"malicious": 0, "status": "filtered"}
            })
            continue
        
        # Calculate priority
        priority = calculate_priority(ioc_type, ioc_value, alert_count=1, severity='medium')
        
        if priority >= 50:
            high_priority.append((ioc_type, ioc_value, priority))
        else:
            normal_priority.append((ioc_type, ioc_value, priority))
    
    # Sort by priority (high to low)
    high_priority.sort(key=lambda x: x[2], reverse=True)
    normal_priority.sort(key=lambda x: x[2], reverse=True)
    
    # Process in order, respecting rate limits
    results = []
    
    for ioc_type, ioc_value, _ in high_priority + normal_priority:
        try:
            # Rate limit check
            allowed, wait_seconds = await vt_rate_limiter.acquire()
            if not allowed:
                # Rate limited - add error and skip remaining
                results.append({
                    "type": ioc_type,
                    "value": ioc_value,
                    "skipped": True,
                    "reason": f"rate_limited: wait {int(wait_seconds)}s",
                    "result": {"error": "Rate limited"}
                })
                continue
            
            # Query VT
            vt_response = await query_virustotal(ioc_type, ioc_value)
            parsed = parse_vt_response(ioc_type, ioc_value, vt_response)
            
            if "error" in vt_response:
                parsed["error"] = vt_response["error"]
            
            # Cache
            cache_result(ioc_type, ioc_value, parsed)
            
            results.append({
                "type": ioc_type,
                "value": ioc_value,
                "skipped": False,
                "result": parsed
            })
            
            # Small delay between requests to smooth rate limit
            await asyncio.sleep(0.2)
            
        except HTTPException as e:
            results.append({
                "type": ioc_type,
                "value": ioc_value,
                "skipped": True,
                "reason": str(e.detail),
                "result": {"error": str(e.detail)}
            })
        except Exception as e:
            results.append({
                "type": ioc_type,
                "value": ioc_value,
                "skipped": True,
                "reason": "exception",
                "result": {"error": str(e)}
            })
    
    # Combine all results
    all_results = skipped + results
    
    return {
        "total": len(req.iocs),
        "processed": len(results),
        "skipped_or_cached": len(skipped),
        "results": all_results
    }


@router.get("/api/virustotal/stats")
async def get_virustotal_stats():
    """Get daily/monthly request statistics from cache (approximate)"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Count today's requests
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    c.execute('SELECT COUNT(*) FROM virustotal_cache WHERE created_at >= ?', (today_start,))
    daily_count = c.fetchone()[0]
    
    # Count this month's requests
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp()
    c.execute('SELECT COUNT(*) FROM virustotal_cache WHERE created_at >= ?', (month_start,))
    monthly_count = c.fetchone()[0]
    
    conn.close()
    
    return {
        "daily_used": daily_count,
        "daily_limit": 500,
        "monthly_used": monthly_count,
        "monthly_limit": 15500,
        "remaining_daily": max(0, 500 - daily_count),
        "remaining_monthly": max(0, 15500 - monthly_count)
    }


# Initialize cache on startup
init_cache_db()

print("[VT] VirusTotal module loaded. API key:", "configured" if VT_API_KEY else "NOT CONFIGURED")
