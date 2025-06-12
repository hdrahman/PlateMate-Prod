import requests
import json

# Test the actual API endpoint
url = "http://localhost:8000/food/search"
headers = {
    "Content-Type": "application/json"
}
data = {
    "query": "Core Power"
}

try:
    print("Testing API endpoint...")
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        results = response.json()
        print(f"Number of results: {len(results)}")
        
        for i, result in enumerate(results[:3]):
            print(f"\n--- API Result {i+1} ---")
            print(f"Food: {result.get('food_name')}")
            print(f"Brand: {result.get('brand_name')}")
            print(f"Calories: {result.get('calories')}")
            print(f"Proteins: {result.get('proteins')}g")
            print(f"Carbs: {result.get('carbs')}g")
            print(f"Fats: {result.get('fats')}g")
    else:
        print(f"Error: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("Could not connect to backend server. Make sure it's running on port 8000.")
except Exception as e:
    print(f"Error: {e}") 