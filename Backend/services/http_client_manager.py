"""
HTTP Client Manager for PlateMate Backend

Provides persistent HTTP client instances that are reused across requests
to avoid connection overhead and improve performance.
"""

import httpx
import logging
from typing import Optional, Dict
import asyncio

logger = logging.getLogger(__name__)

class HTTPClientManager:
    """Manages persistent HTTP clients for external API services"""
    
    def __init__(self):
        self._clients: Dict[str, httpx.AsyncClient] = {}
        self._initialized = False
        self._lock = asyncio.Lock()
        
        # Configuration for different services
        self._client_configs = {
            "openai": {
                "base_url": "https://api.openai.com/v1",
                "timeout": 60.0,
                "limits": httpx.Limits(max_keepalive_connections=10, max_connections=20)
            },
            "deepseek": {
                "base_url": "https://api.deepseek.com",
                "timeout": 60.0,
                "limits": httpx.Limits(max_keepalive_connections=5, max_connections=15)
            },
            "fatsecret_api": {
                "base_url": "https://platform.fatsecret.com/rest",
                "timeout": 30.0,
                "limits": httpx.Limits(max_keepalive_connections=5, max_connections=15)
            },
            "fatsecret_auth": {
                "base_url": "https://oauth.fatsecret.com",
                "timeout": 30.0,
                "limits": httpx.Limits(max_keepalive_connections=3, max_connections=8)
            },
            "general": {
                "timeout": 30.0,
                "limits": httpx.Limits(max_keepalive_connections=10, max_connections=20)
            }
        }
    
    async def initialize(self):
        """Initialize all HTTP clients at startup"""
        async with self._lock:
            if self._initialized:
                return
            
            logger.info("Initializing HTTP clients...")
            
            for service_name, config in self._client_configs.items():
                try:
                    client = httpx.AsyncClient(**config)
                    self._clients[service_name] = client
                    logger.info(f"✅ Initialized HTTP client for {service_name}")
                except Exception as e:
                    logger.error(f"❌ Failed to initialize HTTP client for {service_name}: {e}")
            
            self._initialized = True
            logger.info(f"✅ HTTP client manager initialized with {len(self._clients)} clients")
    
    async def close_all(self):
        """Close all HTTP clients"""
        async with self._lock:
            logger.info("Closing all HTTP clients...")
            
            for service_name, client in self._clients.items():
                try:
                    await client.aclose()
                    logger.info(f"✅ Closed HTTP client for {service_name}")
                except Exception as e:
                    logger.error(f"❌ Error closing HTTP client for {service_name}: {e}")
            
            self._clients.clear()
            self._initialized = False
            logger.info("✅ All HTTP clients closed")
    
    def get_client(self, service_name: str) -> Optional[httpx.AsyncClient]:
        """
        Get a persistent HTTP client for a service
        
        Args:
            service_name: Name of the service (openai, deepseek, fatsecret_api, etc.)
            
        Returns:
            AsyncClient instance or None if not initialized
        """
        if not self._initialized:
            logger.warning(f"HTTP client manager not initialized, cannot get client for {service_name}")
            return None
        
        client = self._clients.get(service_name)
        if not client:
            logger.warning(f"No HTTP client found for service: {service_name}")
            # Return general client as fallback
            return self._clients.get("general")
        
        return client
    
    def is_initialized(self) -> bool:
        """Check if the manager is initialized"""
        return self._initialized

# Global HTTP client manager instance
http_client_manager = HTTPClientManager()

async def get_http_client(service_name: str) -> httpx.AsyncClient:
    """
    Get a persistent HTTP client for a service
    
    Args:
        service_name: Name of the service (openai, deepseek, fatsecret_api, etc.)
        
    Returns:
        AsyncClient instance
        
    Raises:
        RuntimeError: If client manager is not initialized
    """
    if not http_client_manager.is_initialized():
        # Auto-initialize if not done yet (fallback for edge cases)
        await http_client_manager.initialize()
    
    client = http_client_manager.get_client(service_name)
    if client is None:
        raise RuntimeError(f"HTTP client for {service_name} not available")
    
    return client
