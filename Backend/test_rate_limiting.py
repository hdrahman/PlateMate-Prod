#!/usr/bin/env python3
"""
Rate Limiting Test Script for PlateMate API
Tests the user-friendly rate limiting system with escalating cooldowns
"""

import asyncio
import aiohttp
import time
import json
from typing import List, Dict

class RateLimitTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def make_request(self, endpoint: str, headers: Dict[str, str] = None) -> Dict:
        """Make a request and return status, headers, and response data"""
        url = f"{self.base_url}{endpoint}"
        try:
            async with self.session.get(url, headers=headers or {}) as response:
                try:
                    data = await response.json()
                except:
                    data = {"text": await response.text()}
                
                return {
                    "status": response.status,
                    "headers": dict(response.headers),
                    "data": data,
                    "timestamp": time.time()
                }
        except Exception as e:
            return {
                "status": 0,
                "headers": {},
                "data": {"error": str(e)},
                "timestamp": time.time()
            }
    
    async def test_health_check(self):
        """Test that rate limiting health check works"""
        print("🔍 Testing rate limiting health check...")
        
        result = await self.make_request("/health/rate-limiting")
        if result["status"] == 200:
            print("✅ Rate limiting system is healthy")
            return True
        else:
            print(f"❌ Rate limiting health check failed: {result}")
            return False
    
    async def test_search_endpoint_rate_limiting(self):
        """Test search endpoint rate limiting (100/minute, burst 25)"""
        print("\n🧪 Testing search endpoint rate limiting...")
        print("   Limit: 100/minute, Burst: 25, Cooldowns: [5, 10, 60, 300]s")
        
        endpoint = "/food/search?query=apple"
        results = []
        
        # Make requests up to burst limit + some extra
        for i in range(30):
            result = await self.make_request(endpoint)
            results.append(result)
            
            status = result["status"]
            remaining = result["headers"].get("x-ratelimit-remaining", "N/A")
            retry_after = result["headers"].get("retry-after", "N/A")
            
            if status == 200:
                print(f"   Request {i+1}: ✅ Success (remaining: {remaining})")
            else:
                violations = result["data"].get("violations", "N/A")
                print(f"   Request {i+1}: ❌ Rate limited (retry_after: {retry_after}s, violations: {violations})")
            
            # Small delay between requests
            await asyncio.sleep(0.1)
        
        # Count successful vs rate-limited requests
        successful = sum(1 for r in results if r["status"] == 200)
        rate_limited = sum(1 for r in results if r["status"] == 429)
        
        print(f"   Results: {successful} successful, {rate_limited} rate-limited")
        return successful <= 25  # Should not exceed burst limit
    
    async def test_ai_endpoint_rate_limiting(self):
        """Test AI endpoint rate limiting (30/hour, burst 5)"""
        print("\n🧪 Testing AI endpoint rate limiting...")
        print("   Limit: 30/hour, Burst: 5, Cooldowns: [30, 60, 300, 1800]s")
        
        endpoint = "/gpt/analyze"
        results = []
        
        # Make requests up to burst limit + some extra
        for i in range(8):
            result = await self.make_request(endpoint, {
                "Content-Type": "application/json"
            })
            results.append(result)
            
            status = result["status"]
            remaining = result["headers"].get("x-ratelimit-remaining", "N/A")
            retry_after = result["headers"].get("retry-after", "N/A")
            
            if status in [200, 422]:  # 422 might be validation error, but not rate limited
                print(f"   Request {i+1}: ✅ Allowed (remaining: {remaining})")
            elif status == 429:
                violations = result["data"].get("violations", "N/A")
                print(f"   Request {i+1}: ❌ Rate limited (retry_after: {retry_after}s, violations: {violations})")
            else:
                print(f"   Request {i+1}: ⚠️ Other error ({status})")
            
            await asyncio.sleep(0.1)
        
        # Count requests that weren't rate limited
        not_rate_limited = sum(1 for r in results if r["status"] != 429)
        rate_limited = sum(1 for r in results if r["status"] == 429)
        
        print(f"   Results: {not_rate_limited} allowed, {rate_limited} rate-limited")
        return not_rate_limited <= 5  # Should not exceed burst limit
    
    async def test_escalating_cooldowns(self):
        """Test that cooldowns escalate with violations"""
        print("\n🧪 Testing escalating cooldowns...")
        
        endpoint = "/food/search?query=test"
        retry_times = []
        
        # Make enough requests to trigger multiple violations
        for i in range(10):
            result = await self.make_request(endpoint)
            
            if result["status"] == 429:
                retry_after = result["headers"].get("retry-after")
                violations = result["data"].get("violations")
                
                if retry_after:
                    retry_times.append(int(retry_after))
                    print(f"   Violation {violations}: retry_after = {retry_after}s")
            
            await asyncio.sleep(0.05)  # Very short delay to trigger rate limiting
        
        # Check if cooldowns are escalating
        if len(retry_times) > 1:
            escalating = all(retry_times[i] >= retry_times[i-1] for i in range(1, len(retry_times)))
            print(f"   Cooldown escalation: {'✅ Working' if escalating else '❌ Not working'}")
            print(f"   Retry times: {retry_times}")
            return escalating
        else:
            print("   Not enough rate limiting events to test escalation")
            return True
    
    async def test_excluded_paths(self):
        """Test that health and docs endpoints are excluded"""
        print("\n🧪 Testing excluded paths...")
        
        excluded_endpoints = [
            "/health",
            "/docs",
            "/",
            "/health/rate-limiting"
        ]
        
        all_excluded = True
        
        for endpoint in excluded_endpoints:
            # Make many requests to excluded endpoints
            for i in range(10):
                result = await self.make_request(endpoint)
                if result["status"] == 429:
                    print(f"   ❌ {endpoint} was rate limited (should be excluded)")
                    all_excluded = False
                    break
                await asyncio.sleep(0.01)
        
        if all_excluded:
            print("   ✅ All excluded paths work correctly")
        
        return all_excluded
    
    async def run_all_tests(self):
        """Run comprehensive rate limiting tests"""
        print("🚀 Starting PlateMate Rate Limiting Tests")
        print("=" * 50)
        
        # Test results
        results = {}
        
        # Health check first
        results["health"] = await self.test_health_check()
        
        if not results["health"]:
            print("\n❌ Rate limiting system is not healthy. Skipping other tests.")
            return results
        
        # Run all tests
        results["search_rate_limiting"] = await self.test_search_endpoint_rate_limiting()
        results["ai_rate_limiting"] = await self.test_ai_endpoint_rate_limiting()
        results["escalating_cooldowns"] = await self.test_escalating_cooldowns()
        results["excluded_paths"] = await self.test_excluded_paths()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 Test Results Summary:")
        
        all_passed = True
        for test_name, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"   {test_name}: {status}")
            if not passed:
                all_passed = False
        
        print(f"\n🎯 Overall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
        
        return results

async def main():
    """Main test function"""
    async with RateLimitTester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    print("PlateMate Rate Limiting Test Suite")
    print("Make sure the backend server is running on http://localhost:8000")
    print("And Redis is available at redis://localhost:6379")
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc() 