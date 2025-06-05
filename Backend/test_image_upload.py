#!/usr/bin/env python3

import requests
import base64
import json
from PIL import Image, ImageDraw
import io
import time

def create_food_like_image():
    """Create a more food-like test image"""
    # Create an image that looks more like food (circular with some details)
    img = Image.new('RGB', (400, 400), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a pizza-like circle
    draw.ellipse([50, 50, 350, 350], fill='orange', outline='brown')
    
    # Add some "toppings" - red circles for pepperoni
    draw.ellipse([100, 100, 130, 130], fill='red')
    draw.ellipse([200, 120, 230, 150], fill='red')
    draw.ellipse([150, 200, 180, 230], fill='red')
    draw.ellipse([250, 250, 280, 280], fill='red')
    
    # Add some green "herbs"
    draw.ellipse([120, 180, 140, 200], fill='green')
    draw.ellipse([220, 180, 240, 200], fill='green')
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    return img_bytes

def test_multiple_images_endpoint():
    """Test the multiple images upload endpoint"""
    print("🧪 Testing multiple images upload endpoint...")
    
    # Create test image that looks like food
    test_image = create_food_like_image()
    
    # Prepare the request
    files = {
        'images': ('pizza_test.jpg', test_image, 'image/jpeg'),
    }
    
    data = {
        'user_id': '1'
    }
    
    try:
        print(f"📤 Sending request to http://172.31.90.70:8000/images/upload-multiple-images")
        print("🍕 Sending a pizza-like test image...")
        
        start_time = time.time()
        response = requests.post(
            'http://172.31.90.70:8000/images/upload-multiple-images',
            files=files,
            data=data,
            timeout=120  # Increased timeout for OpenAI processing
        )
        end_time = time.time()
        
        print(f"⏱️ Request took {end_time - start_time:.2f} seconds")
        print(f"📝 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Request successful!")
            print(f"🍽️ Meal ID: {data.get('meal_id')}")
            print(f"📊 Nutrition data items: {len(data.get('nutrition_data', []))}")
            
            if data.get('nutrition_data'):
                for i, item in enumerate(data['nutrition_data']):
                    food_name = item.get('food_name', 'Unknown')
                    calories = item.get('calories', 0)
                    print(f"  Item {i+1}: {food_name} - {calories} calories")
                    
                    # Print some additional nutrition info
                    proteins = item.get('proteins', 0)
                    carbs = item.get('carbs', 0)
                    fats = item.get('fats', 0)
                    print(f"    Nutrition: P:{proteins}g C:{carbs}g F:{fats}g")
                    
            # Check if the response looks like mock data
            first_item = data.get('nutrition_data', [{}])[0]
            food_name = first_item.get('food_name', '')
            
            if food_name in ['Food Item 1', 'Could not identify food', 'Error analyzing food']:
                print("⚠️ Response appears to contain mock/error data")
                print(f"🔍 Error message: {first_item.get('error_message', 'No error message')}")
            else:
                print("✅ Response appears to contain real AI analysis")
                print(f"🎉 Successfully identified: {food_name}")
                
        else:
            print(f"❌ Request failed: {response.status_code}")
            print(f"📝 Response text: {response.text}")
            
    except Exception as e:
        print(f"❌ Request failed with exception: {e}")

def test_simple_gpt():
    """Test a simple text-only GPT call to ensure the API is working"""
    print("\n🧪 Testing simple GPT call...")
    
    try:
        response = requests.post(
            'http://172.31.90.70:8000/gpt/analyze-food',
            json={
                'image_urls': ['https://example.com/dummy.jpg'],
                'food_name': 'Test Food',
                'meal_type': 'lunch'
            },
            timeout=60
        )
        
        print(f"📝 GPT endpoint status: {response.status_code}")
        if response.status_code == 200:
            print("✅ GPT endpoint is accessible")
        else:
            print(f"❌ GPT endpoint error: {response.text}")
            
    except Exception as e:
        print(f"❌ GPT endpoint test failed: {e}")

if __name__ == "__main__":
    test_multiple_images_endpoint()
    test_simple_gpt() 