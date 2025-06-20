"""
Connection Pool Service for PlateMate Backend

This module provides connection pooling for external API services to improve
performance and reduce connection overhead.
"""

import time
import asyncio
import httpx
from typing import Dict, Any, Optional, Callable, Awaitable
import logging
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MAX_CONNECTIONS = 20
POOL_TIMEOUT = 60  # seconds
REQUEST_TIMEOUT = 30.0  # seconds
RETRY_COUNT = 3
RETRY_DELAY = 1  # seconds

# Global client pools
http_clients: Dict[str, httpx.AsyncClient] = {}
client_last_used: Dict[str, float] = {}
client_creation_time: Dict[str, float] = {}

# Cache for responses
response_cache: Dict[str, Dict[str, Any]] = {
    "data": {},
    "expiry": {}
}

async def get_http_client(service_name: str, base_url: Optional[str] = None, headers: Optional[Dict[str, str]] = None) -> httpx.AsyncClient:
    """
    Get or create an HTTP client for a specific service
    
    Args:
        service_name: Identifier for the service (e.g., "openai", "fatsecret")
        base_url: Base URL for the service API
        headers: Default headers to include with requests
        
    Returns:
        An AsyncClient instance from the pool or a new one
    """
    current_time = time.time()
    client_key = f"{service_name}:{base_url or ''}"
    
    # Check if we have an existing client that's not too old
    if client_key in http_clients:
        # If client is older than POOL_TIMEOUT, close it and create a new one
        if current_time - client_creation_time.get(client_key, 0) > POOL_TIMEOUT:
            logger.info(f"Closing aged connection for {service_name}")
            await http_clients[client_key].aclose()
            del http_clients[client_key]
        else:
            # Update last used time
            client_last_used[client_key] = current_time
            return http_clients[client_key]
    
    # Create a new client
    logger.info(f"Creating new connection for {service_name}")
    client = httpx.AsyncClient(
        base_url=base_url,
        headers=headers,
        timeout=REQUEST_TIMEOUT,
        limits=httpx.Limits(max_connections=MAX_CONNECTIONS)
    )
    
    # Store the client
    http_clients[client_key] = client
    client_last_used[client_key] = current_time
    client_creation_time[client_key] = current_time
    
    return client

async def close_idle_connections():
    """Close connections that haven't been used recently"""
    current_time = time.time()
    keys_to_remove = []
    
    for client_key, last_used in client_last_used.items():
        # If client hasn't been used for POOL_TIMEOUT seconds, close it
        if current_time - last_used > POOL_TIMEOUT:
            logger.info(f"Closing idle connection: {client_key}")
            await http_clients[client_key].aclose()
            keys_to_remove.append(client_key)
    
    # Remove closed clients
    for key in keys_to_remove:
        del http_clients[key]
        del client_last_used[key]
        del client_creation_time[key]

async def close_all_connections():
    """Close all connections in the pool"""
    logger.info("Closing all connections")
    for client_key, client in http_clients.items():
        await client.aclose()
    
    http_clients.clear()
    client_last_used.clear()
    client_creation_time.clear()

def cache_response(ttl_seconds: int = 300):
    """
    Decorator to cache API responses
    
    Args:
        ttl_seconds: Time-to-live for cached responses in seconds
    """
    def decorator(func: Callable[..., Awaitable[Any]]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate a cache key based on function name and arguments
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            current_time = time.time()
            
            # Check if we have a valid cached response
            if cache_key in response_cache["data"] and current_time < response_cache["expiry"].get(cache_key, 0):
                logger.info(f"Cache hit for {func.__name__}")
                return response_cache["data"][cache_key]
            
            # Call the original function
            result = await func(*args, **kwargs)
            
            # Cache the result
            response_cache["data"][cache_key] = result
            response_cache["expiry"][cache_key] = current_time + ttl_seconds
            
            return result
        return wrapper
    return decorator

async def request_with_retry(
    method: str,
    url: str,
    client: httpx.AsyncClient,
    retry_count: int = RETRY_COUNT,
    **kwargs
) -> httpx.Response:
    """
    Make an HTTP request with automatic retry on failure
    
    Args:
        method: HTTP method (GET, POST, etc.)
        url: URL to request
        client: HTTP client to use
        retry_count: Number of retries on failure
        **kwargs: Additional arguments to pass to the request
        
    Returns:
        HTTP response
    """
    last_exception = None
    
    # Enhanced URL validation with detailed logging
    if url is None:
        error_msg = "URL cannot be None"
        logger.error(f"URL validation failed: {error_msg}")
        raise ValueError(error_msg)
    
    if not isinstance(url, (str, httpx.URL)):
        error_msg = f"Invalid URL type: {type(url)}. Expected str or httpx.URL."
        logger.error(error_msg)
        raise ValueError(error_msg)
        
    if isinstance(url, str) and not url.strip():
        error_msg = "URL string cannot be empty"
        logger.error(f"URL validation failed: {error_msg}")
        raise ValueError(error_msg)
    
    logger.info(f"Making {method} request to {url}")
    
    for attempt in range(retry_count + 1):
        try:
            logger.debug(f"Request attempt {attempt + 1}/{retry_count + 1} to {url}")
            response = await client.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            last_exception = e
            
            # Don't retry on client errors (4xx)
            if isinstance(e, httpx.HTTPStatusError) and 400 <= e.response.status_code < 500:
                logger.error(f"Client error in request to {url}: {str(e)}")
                raise
            
            if attempt < retry_count:
                wait_time = RETRY_DELAY * (2 ** attempt)  # Exponential backoff
                logger.warning(f"Request to {url} failed, retrying in {wait_time}s: {str(e)}")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Request to {url} failed after {retry_count} retries: {str(e)}")
                raise last_exception

# Cleanup task
async def run_connection_pool_maintenance():
    """Background task to clean up idle connections"""
    while True:
        await asyncio.sleep(POOL_TIMEOUT // 2)
        await close_idle_connections()

# Start the maintenance task
maintenance_task = None

def start_connection_pool():
    """Start the connection pool maintenance task"""
    global maintenance_task
    if maintenance_task is None:
        loop = asyncio.get_event_loop()
        maintenance_task = loop.create_task(run_connection_pool_maintenance())
        logger.info("Connection pool maintenance started")

def stop_connection_pool():
    """Stop the connection pool maintenance task"""
    global maintenance_task
    if maintenance_task:
        maintenance_task.cancel()
        maintenance_task = None
        logger.info("Connection pool maintenance stopped") 