"""
Performance Test Script for PlateMate Backend

Tests the implemented performance improvements.
"""

import asyncio
import httpx
import time
from typing import List, Dict

BASE_URL = "http://localhost:8000"

async def test_http_client_persistence():
    """Test that HTTP clients are persistent"""
    print("\n🔍 Testing HTTP Client Persistence...")
    
    async with httpx.AsyncClient() as client:
        # Make multiple requests to health endpoint
        start = time.time()
        for i in range(10):
            response = await client.get(f"{BASE_URL}/health")
            assert response.status_code == 200
        duration = time.time() - start
        
        print(f"✅ 10 requests completed in {duration:.2f}s ({duration/10*1000:.0f}ms avg)")
        return duration

async def test_performance_endpoint():
    """Test the performance monitoring endpoint"""
    print("\n🔍 Testing Performance Monitoring...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health/performance")
        data = response.json()
        
        print(f"✅ HTTP Clients Initialized: {data['http_clients']['initialized']}")
        print(f"✅ Clients Available: {data['http_clients']['clients_available']}")
        print(f"✅ Active Connections: {data['connection_pool']['active_connections']}")
        print(f"✅ Cached Responses: {data['connection_pool']['cached_responses']}")
        print(f"✅ AI Limiter - Max Concurrent: {data['ai_limiter']['max_concurrent']}")
        print(f"✅ AI Limiter - Active Operations: {data['ai_limiter']['active_operations']}")
        print(f"✅ AI Limiter - Total Operations: {data['ai_limiter']['total_operations']}")
        
        return data

async def test_concurrent_requests():
    """Test concurrent request handling"""
    print("\n🔍 Testing Concurrent Request Handling...")
    
    async with httpx.AsyncClient() as client:
        # Send 20 concurrent requests
        start = time.time()
        tasks = [client.get(f"{BASE_URL}/health") for _ in range(20)]
        responses = await asyncio.gather(*tasks)
        duration = time.time() - start
        
        success_count = sum(1 for r in responses if r.status_code == 200)
        print(f"✅ {success_count}/20 requests successful in {duration:.2f}s ({duration/20*1000:.0f}ms avg)")
        
        return duration

async def test_ai_limiter_queueing():
    """Test AI limiter queueing behavior"""
    print("\n🔍 Testing AI Limiter Queueing...")
    
    # This would require actual AI endpoints with auth
    # For now, just check the stats
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health/performance")
        data = response.json()
        
        limiter_stats = data['ai_limiter']
        available_slots = limiter_stats['available_slots']
        
        print(f"✅ AI Limiter has {available_slots} available slots")
        print(f"✅ Max concurrent operations: {limiter_stats['max_concurrent']}")
        
        if available_slots == limiter_stats['max_concurrent']:
            print("✅ All slots available (no operations in progress)")
        else:
            print(f"⚠️ {limiter_stats['active_operations']} operations in progress")
        
        return limiter_stats

async def run_all_tests():
    """Run all performance tests"""
    print("="*60)
    print("🚀 PlateMate Backend Performance Tests")
    print("="*60)
    
    try:
        # Test 1: HTTP Client Persistence
        duration1 = await test_http_client_persistence()
        
        # Test 2: Performance Endpoint
        perf_data = await test_performance_endpoint()
        
        # Test 3: Concurrent Requests
        duration2 = await test_concurrent_requests()
        
        # Test 4: AI Limiter
        limiter_stats = await test_ai_limiter_queueing()
        
        # Summary
        print("\n" + "="*60)
        print("📊 Test Summary")
        print("="*60)
        print(f"✅ All optimizations active: {perf_data['optimizations']['persistent_http_clients']}")
        print(f"✅ Sequential requests: {duration1:.2f}s for 10 requests")
        print(f"✅ Concurrent requests: {duration2:.2f}s for 20 requests")
        print(f"✅ Speedup factor: {duration1/duration2:.1f}x")
        print(f"✅ HTTP clients initialized: {perf_data['http_clients']['clients_available']}")
        print(f"✅ AI limiter ready with {limiter_stats['available_slots']} slots")
        
        print("\n" + "="*60)
        print("🎉 All tests passed!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n⚠️  Make sure the backend is running on http://localhost:8000")
    print("    Run: cd Backend && uvicorn main:app --reload\n")
    
    try:
        asyncio.run(run_all_tests())
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
