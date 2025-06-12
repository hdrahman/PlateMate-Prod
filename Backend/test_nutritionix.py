from services.nutritionix_service import NutritionixService
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

print("Testing Nutritionix Service...")

# Check if credentials are set
print(f"NUTRITIONIX_APP_ID: {os.getenv('NUTRITIONIX_APP_ID')}")
print(f"NUTRITIONIX_API_KEY: {'*' * len(os.getenv('NUTRITIONIX_API_KEY')) if os.getenv('NUTRITIONIX_API_KEY') else 'None'}")

# Create service
service = NutritionixService()

# Test search
results = service.search_food('Core Power')
print(f'\nResults: {len(results)}')

for i, result in enumerate(results[:3]):
    print(f'\n--- Result {i+1} ---')
    print(f'Food: {result.get("food_name")}')
    print(f'Brand: {result.get("brand_name")}')
    print(f'Calories: {result.get("calories")}')
    print(f'Protein: {result.get("proteins")}g')
    print(f'Carbs: {result.get("carbs")}g')
    print(f'Fat: {result.get("fats")}g')
    print(f'Serving: {result.get("serving_qty")} {result.get("serving_unit")}') 