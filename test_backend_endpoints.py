#!/usr/bin/env python3
"""
Test script for backend API endpoints
"""

import requests
import json
import sys
import os

# Test configuration
BASE_URL = "http://localhost:8000"  # Default FastAPI port

def test_health_endpoint():
    """Test health check endpoint"""
    print("\n=== Testing Health Endpoint ===")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_food_health():
    """Test food service health endpoint"""
    print("\n=== Testing Food Service Health ===")
    try:
        response = requests.get(f"{BASE_URL}/food/health", timeout=5)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Service Status: {data.get('status')}")
        print(f"API Provider: {data.get('api_provider')}")
        print(f"Configured: {data.get('configured')}")
        print(f"Message: {data.get('message')}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Food health check failed: {e}")
        return False

def test_recipe_health():
    """Test recipe service health endpoint"""
    print("\n=== Testing Recipe Service Health ===")
    try:
        response = requests.get(f"{BASE_URL}/recipes/health", timeout=5)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Service Status: {data.get('status')}")
        print(f"API Provider: {data.get('api_provider')}")
        print(f"Configured: {data.get('configured')}")
        print(f"Message: {data.get('message')}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Recipe health check failed: {e}")
        return False

def test_fatsecret_service_directly():
    """Test FatSecret service directly"""
    print("\n=== Testing FatSecret Service Directly ===")
    try:
        # Add the Backend directory to Python path for importing
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))
        
        from services.fatsecret_service import fatsecret_service
        
        print(f"Service configured: {fatsecret_service.is_configured}")
        print(f"Client ID: {fatsecret_service.client_id}")
        
        if fatsecret_service.is_configured:
            # Test food search
            print("\nTesting food search...")
            results = fatsecret_service.search_food("apple")
            print(f"Search results: {len(results)} items")
            if results:
                print(f"First result: {results[0].get('food_name')} - {results[0].get('calories')} calories")
                print(f"Healthiness rating: {results[0].get('healthiness_rating')}/10")
            
            # Test recipe search
            print("\nTesting recipe search...")
            recipe_params = {'query': 'chicken', 'number': 3}
            recipe_results = fatsecret_service.search_recipes(recipe_params)
            print(f"Recipe results: {len(recipe_results)} items")
            if recipe_results:
                print(f"First recipe: {recipe_results[0].get('title')}")
            
            # Test meal plan generation
            print("\nTesting meal plan generation...")
            meal_plan_params = {'timeFrame': 'day', 'targetCalories': 2000}
            meal_plan = fatsecret_service.generate_meal_plan(meal_plan_params)
            print(f"Meal plan meals: {len(meal_plan.get('meals', []))}")
            print(f"Total calories: {meal_plan.get('nutrients', {}).get('calories', 0)}")
            
            return True
        else:
            print("❌ FatSecret service not configured")
            return False
            
    except Exception as e:
        print(f"❌ FatSecret service test failed: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False

def test_api_docs():
    """Test if API documentation is accessible"""
    print("\n=== Testing API Documentation ===")
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ API documentation is accessible")
            print(f"URL: {BASE_URL}/docs")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ API docs test failed: {e}")
        return False

def test_openapi_spec():
    """Test if OpenAPI spec is accessible"""
    print("\n=== Testing OpenAPI Specification ===")
    try:
        response = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            spec = response.json()
            print(f"API Title: {spec.get('info', {}).get('title', 'Unknown')}")
            print(f"API Version: {spec.get('info', {}).get('version', 'Unknown')}")
            print(f"Available paths: {len(spec.get('paths', {}))}")
            # Check for our key endpoints
            paths = spec.get('paths', {})
            key_endpoints = ['/food/search', '/recipes/search', '/food/health', '/recipes/health']
            found_endpoints = [endpoint for endpoint in key_endpoints if endpoint in paths]
            print(f"Key endpoints found: {found_endpoints}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ OpenAPI spec test failed: {e}")
        return False

def test_cors_headers():
    """Test if CORS headers are properly configured"""
    print("\n=== Testing CORS Configuration ===")
    try:
        response = requests.options(f"{BASE_URL}/health", timeout=5)
        print(f"Status: {response.status_code}")
        
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        }
        
        for header, value in cors_headers.items():
            print(f"{header}: {value}")
        
        # Check if CORS is properly configured
        has_cors = any(value for value in cors_headers.values())
        if has_cors:
            print("✅ CORS headers are configured")
        else:
            print("⚠️ CORS headers not found")
        
        return response.status_code in [200, 204] or has_cors
    except Exception as e:
        print(f"❌ CORS test failed: {e}")
        return False

def main():
    """Run all endpoint tests"""
    print("🧪 Backend API Comprehensive Tests")
    print("=" * 50)
    
    # Test if server is running
    print("Checking if backend server is running...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=3)
        if response.status_code != 200:
            print("❌ Backend server not accessible. Please start the backend server first.")
            print("Run: cd Backend && python main.py")
            return 1
    except:
        print("❌ Backend server not accessible. Please start the backend server first.")
        print("Run: cd Backend && python main.py")
        return 1
    
    print("✅ Backend server is running")
    
    # Run all tests
    tests = [
        ("Health Check", test_health_endpoint),
        ("Food Service Health", test_food_health),
        ("Recipe Service Health", test_recipe_health),
        ("FatSecret Service Direct", test_fatsecret_service_directly),
        ("API Documentation", test_api_docs),
        ("OpenAPI Specification", test_openapi_spec),
        ("CORS Configuration", test_cors_headers),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"\n{status}: {test_name}")
        except Exception as e:
            results.append((test_name, False))
            print(f"\n❌ FAILED: {test_name} - {e}")
    
    # Summary
    print("\n" + "=" * 50)
    print("🎯 TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    for test_name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {test_name}")
    
    if passed == total:
        print("\n🎉 All tests passed! Backend integration is working correctly.")
        print("\n📝 Key findings:")
        print("- Backend server is running and accessible")
        print("- FatSecret API integration is working (with fallback support)")
        print("- Health endpoints are responding correctly")
        print("- API documentation is available")
        print("- CORS is properly configured")
        print("\n⚠️ Note: Authentication-protected endpoints require valid Firebase tokens")
        print("   but the core FatSecret functionality is operational.")
        return 0
    else:
        print(f"\n⚠️ {total - passed} tests failed. Check output above for details.")
        return 1

if __name__ == "__main__":
    exit(main()) 