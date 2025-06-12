import os
import requests
import logging
from typing import Dict, List, Optional, Any
from math import floor
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class NutritionixService:
    """Service class for handling Nutritionix API interactions"""
    
    def __init__(self):
        self._load_credentials()
    
    def _load_credentials(self):
        """Load API credentials, with fallback to reload .env if not found"""
        self.app_id = os.getenv('NUTRITIONIX_APP_ID')
        self.api_key = os.getenv('NUTRITIONIX_API_KEY')
        
        # If credentials are not found, try loading .env file
        if not self.app_id or not self.api_key:
            logger.info("Nutritionix credentials not found, attempting to load .env file...")
            load_dotenv()
            self.app_id = os.getenv('NUTRITIONIX_APP_ID')
            self.api_key = os.getenv('NUTRITIONIX_API_KEY')
        
        self.base_url = 'https://trackapi.nutritionix.com/v2'
        
        if not self.app_id or not self.api_key:
            logger.warning("Nutritionix API credentials not configured")
            logger.warning(f"NUTRITIONIX_APP_ID: {self.app_id}")
            logger.warning(f"NUTRITIONIX_API_KEY: {'*' * len(self.api_key) if self.api_key else 'None'}")
            self.is_configured = False
        else:
            logger.info("Nutritionix API credentials loaded successfully")
            logger.info(f"NUTRITIONIX_APP_ID: {self.app_id}")
            logger.info(f"NUTRITIONIX_API_KEY: {'*' * len(self.api_key)}")
            self.is_configured = True

    def _ensure_configured(self):
        """Ensure the service is configured, retry loading credentials if not"""
        if not self.is_configured:
            logger.info("Service not configured, retrying credential loading...")
            self._load_credentials()
        return self.is_configured
    
    def _get_nutrient_value(self, food: Dict, attr_id: int) -> float:
        """Get a specific nutrient value from the full_nutrients array"""
        if not food.get('full_nutrients'):
            return 0
        
        for nutrient in food['full_nutrients']:
            if nutrient.get('attr_id') == attr_id:
                return nutrient.get('value', 0)
        return 0
    
    def _calculate_healthiness_rating(self, food: Dict) -> int:
        """Calculate a comprehensive healthiness rating based on nutritional content"""
        # Extract nutrient values with defaults
        calories = food.get('nf_calories', 0)
        protein = food.get('nf_protein', 0)
        carbs = food.get('nf_total_carbohydrate', 0)
        fat = food.get('nf_total_fat', 0)
        fiber = food.get('nf_dietary_fiber', 0)
        sugar = food.get('nf_sugars', 0)
        saturated_fat = food.get('nf_saturated_fat', 0)
        cholesterol = food.get('nf_cholesterol', 0)
        sodium = food.get('nf_sodium', 0)

        # Start with a lower base score so only truly healthy foods get high ratings
        score = 4.0  # Start lower than neutral

        # Protein is generally good (up to a point)
        if protein > 0:
            # Protein quality score: higher is better
            protein_quality = protein / calories * 400  # Scaled to ~0-4 range
            score += min(2, protein_quality)

        # Fiber is good
        if fiber > 0:
            # Fiber quality score: higher is better
            fiber_quality = fiber / calories * 400  # Scaled to ~0-2 range
            score += min(1.5, fiber_quality)

        # Micronutrient estimation (limited data, but approximating)
        has_full_nutrients = bool(food.get('full_nutrients'))
        if has_full_nutrients:
            score += 0.5  # Bonus for foods with detailed nutrition data

        # Penalties - more aggressive penalties to ensure only truly healthy foods score highly

        # Sugar penalty (worse at higher percentages of total carbs)
        if sugar > 0 and carbs > 0:
            sugar_ratio = sugar / carbs
            score -= sugar_ratio * 3  # Up to -3 points for pure sugar (increased penalty)
        elif sugar > 10:
            score -= 1.5  # Penalty for high sugar regardless of carb ratio

        # Saturated fat penalty (worse at higher amounts)
        if saturated_fat > 0 and fat > 0:
            sat_fat_ratio = saturated_fat / fat
            score -= sat_fat_ratio * 2  # Up to -2 points (increased penalty)

        # Calorie density penalty - more aggressive
        if calories > 250:
            score -= min(1.5, (calories - 250) / 500)  # Up to -1.5 points (lowered threshold)

        # Sodium penalty - more aggressive
        if sodium > 400:
            score -= min(1.5, (sodium - 400) / 1000)  # Up to -1.5 points (lowered threshold)

        # Cholesterol penalty
        if cholesterol > 50:
            score -= min(1, (cholesterol - 50) / 150)  # Up to -1 point

        # Adjustments for food types
        food_name = food.get('food_name', '').lower()

        # Stronger boost for whole foods
        if any(keyword in food_name for keyword in [
            'vegetable', 'fruit', 'legume', 'bean', 'lentil', 'seed', 
            'whole grain', 'fish', 'salmon', 'tuna', 'cod', 'organic', 'lean protein'
        ]):
            score += 2  # Increased boost

        # Additional boost for superfoods
        if any(keyword in food_name for keyword in [
            'spinach', 'kale', 'blueberry', 'quinoa', 'avocado', 'broccoli', 
            'sweet potato', 'salmon', 'chia', 'flax'
        ]):
            score += 1

        # Stronger penalty for processed foods
        if any(keyword in food_name for keyword in [
            'processed', 'fried', 'candy', 'cake', 'soda', 'chip', 'cookie', 
            'pizza', 'burger', 'sweet', 'dessert', 'pastry', 'white bread', 
            'snack', 'fast food'
        ]):
            score -= 2  # Increased penalty

        # Clamp between 1 and 10
        return max(1, min(10, round(score)))
    
    def _map_to_food_item(self, food: Dict) -> Dict[str, Any]:
        """Map Nutritionix API response to our FoodItem format"""
        return {
            'food_name': food.get('food_name', ''),
            'brand_name': food.get('brand_name'),
            'calories': round(food.get('nf_calories', 0) or 0),
            'proteins': round(food.get('nf_protein', 0) or 0),
            'carbs': round(food.get('nf_total_carbohydrate', 0) or 0),
            'fats': round(food.get('nf_total_fat', 0) or 0),
            'fiber': round(food.get('nf_dietary_fiber', 0) or 0),
            'sugar': round(food.get('nf_sugars', 0) or 0),
            'saturated_fat': round(food.get('nf_saturated_fat', 0) or 0),
            'polyunsaturated_fat': round(self._get_nutrient_value(food, 646) or 0),
            'monounsaturated_fat': round(self._get_nutrient_value(food, 645) or 0),
            'trans_fat': round(self._get_nutrient_value(food, 605) or 0),
            'cholesterol': round(food.get('nf_cholesterol', 0) or 0),
            'sodium': round(food.get('nf_sodium', 0) or 0),
            'potassium': round(food.get('nf_potassium', 0) or self._get_nutrient_value(food, 306) or 0),
            'vitamin_a': round(self._get_nutrient_value(food, 320) or 0),
            'vitamin_c': round(self._get_nutrient_value(food, 401) or 0),
            'calcium': round(self._get_nutrient_value(food, 301) or 0),
            'iron': round(self._get_nutrient_value(food, 303) or 0),
            'image': food.get('photo', {}).get('thumb', ''),
            'serving_unit': food.get('serving_unit', 'serving'),
            'serving_weight_grams': food.get('serving_weight_grams', 0) or 0,
            'serving_qty': food.get('serving_qty', 1) or 1,
            'healthiness_rating': self._calculate_healthiness_rating(food)
        }
    
    def search_food(self, query: str, min_healthiness: int = 0) -> List[Dict[str, Any]]:
        """Search for foods using the Nutritionix API"""
        if not self._ensure_configured():
            logger.warning('Nutritionix API credentials not configured')
            return []
        
        try:
            url = f'{self.base_url}/search/instant'
            params = {'query': query}
            headers = {
                'x-app-id': self.app_id,
                'x-app-key': self.api_key
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Instant search returned {len(data.get('branded', []))} branded and {len(data.get('common', []))} common foods")
            
            # Process branded foods with detailed nutrition
            detailed_results = []
            branded_foods = data.get('branded', [])[:5]  # Limit to 5 branded foods
            
            for item in branded_foods:
                nix_item_id = item.get('nix_item_id')
                logger.info(f"Processing branded food: {item.get('food_name')} with nix_item_id: {nix_item_id}")
                logger.info(f"Instant search branded data: nf_calories={item.get('nf_calories')}")
                
                if nix_item_id:
                    detailed_food = self._get_branded_food_details(nix_item_id)
                    if detailed_food:
                        logger.info(f"Got detailed data for {detailed_food.get('food_name')}: calories={detailed_food.get('calories')}, proteins={detailed_food.get('proteins')}, carbs={detailed_food.get('carbs')}, fats={detailed_food.get('fats')}")
                        detailed_results.append(detailed_food)
                    else:
                        logger.warning(f"Failed to get detailed data for branded food: {item.get('food_name')}, using fallback")
                        # Use basic data from instant search as fallback
                        fallback_food = self._create_fallback_food_item(item)
                        detailed_results.append(fallback_food)
                else:
                    logger.warning(f"No nix_item_id for branded food: {item.get('food_name')}")
                    fallback_food = self._create_fallback_food_item(item)
                    detailed_results.append(fallback_food)
            
            # Process common foods (these need natural language processing)
            common_foods = data.get('common', [])[:5]  # Limit to 5 common foods
            for item in common_foods:
                food_name = item.get('food_name', '')
                logger.info(f"Processing common food: {food_name}")
                if food_name:
                    detailed_food = self.get_food_details(food_name)
                    if detailed_food:
                        logger.info(f"Got detailed data for {detailed_food.get('food_name')}: calories={detailed_food.get('calories')}, proteins={detailed_food.get('proteins')}, carbs={detailed_food.get('carbs')}, fats={detailed_food.get('fats')}")
                        detailed_results.append(detailed_food)
                    else:
                        logger.warning(f"Failed to get detailed data for common food: {food_name}, using fallback")
                        fallback_food = self._create_fallback_food_item(item)
                        detailed_results.append(fallback_food)
            
            logger.info(f"Total detailed results: {len(detailed_results)}")
            
            # Filter by minimum healthiness if specified
            if min_healthiness > 0:
                detailed_results = [item for item in detailed_results if item.get('healthiness_rating', 0) >= min_healthiness]
            
            # Sort by healthiness rating (highest first)
            detailed_results.sort(key=lambda x: x.get('healthiness_rating', 0), reverse=True)
            
            return detailed_results[:20]  # Return top 20 results
            
        except requests.exceptions.RequestException as e:
            logger.error(f'Error searching for food: {e}')
            return []
        except Exception as e:
            logger.error(f'Unexpected error searching for food: {e}')
            return []

    def _create_fallback_food_item(self, item: Dict) -> Dict[str, Any]:
        """Create a fallback food item from instant search data"""
        return {
            'food_name': item.get('food_name', ''),
            'brand_name': item.get('brand_name'),
            'calories': round(item.get('nf_calories', 0)),
            'proteins': 0,  # Not available in instant search
            'carbs': 0,     # Not available in instant search
            'fats': 0,      # Not available in instant search
            'fiber': 0,
            'sugar': 0,
            'saturated_fat': 0,
            'polyunsaturated_fat': 0,
            'monounsaturated_fat': 0,
            'trans_fat': 0,
            'cholesterol': 0,
            'sodium': 0,
            'potassium': 0,
            'vitamin_a': 0,
            'vitamin_c': 0,
            'calcium': 0,
            'iron': 0,
            'image': item.get('photo', {}).get('thumb', '') if isinstance(item.get('photo'), dict) else '',
            'serving_unit': item.get('serving_unit', 'serving'),
            'serving_weight_grams': item.get('serving_weight_grams', 0),
            'serving_qty': item.get('serving_qty', 1),
            'healthiness_rating': 5  # Default rating when no nutrition data available
        }

    def _get_branded_food_details(self, nix_item_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed nutrition information for a branded food using nix_item_id"""
        if not self._ensure_configured():
            return None
        
        try:
            url = f'{self.base_url}/search/item'
            params = {'nix_item_id': nix_item_id}
            headers = {
                'x-app-id': self.app_id,
                'x-app-key': self.api_key
            }
            
            logger.info(f"Fetching branded food details for nix_item_id: {nix_item_id}")
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            foods = data.get('foods', [])
            
            if foods:
                food_data = foods[0]
                logger.info(f"Raw API response for {food_data.get('food_name', 'unknown')}: nf_calories={food_data.get('nf_calories')}, nf_protein={food_data.get('nf_protein')}, nf_total_carbohydrate={food_data.get('nf_total_carbohydrate')}, nf_total_fat={food_data.get('nf_total_fat')}")
                mapped_result = self._map_to_food_item(food_data)
                logger.info(f"Mapped result: calories={mapped_result.get('calories')}, proteins={mapped_result.get('proteins')}, carbs={mapped_result.get('carbs')}, fats={mapped_result.get('fats')}")
                return mapped_result
            
            logger.warning(f"No foods found in API response for nix_item_id: {nix_item_id}")
            return None
            
        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting branded food details for {nix_item_id}: {e}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error getting branded food details for {nix_item_id}: {e}')
            return None
    
    def get_food_details(self, food_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed nutrition information for a food"""
        if not self._ensure_configured():
            logger.warning('Nutritionix API credentials not configured')
            return None
        
        try:
            url = f'{self.base_url}/natural/nutrients'
            payload = {'query': food_name}
            headers = {
                'x-app-id': self.app_id,
                'x-app-key': self.api_key,
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Fetching food details for: {food_name}")
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            foods = data.get('foods', [])
            
            if foods:
                food_data = foods[0]
                logger.info(f"Raw API response for {food_data.get('food_name', 'unknown')}: nf_calories={food_data.get('nf_calories')}, nf_protein={food_data.get('nf_protein')}, nf_total_carbohydrate={food_data.get('nf_total_carbohydrate')}, nf_total_fat={food_data.get('nf_total_fat')}")
                mapped_result = self._map_to_food_item(food_data)
                logger.info(f"Mapped result: calories={mapped_result.get('calories')}, proteins={mapped_result.get('proteins')}, carbs={mapped_result.get('carbs')}, fats={mapped_result.get('fats')}")
                return mapped_result
            
            logger.warning(f"No foods found in API response for: {food_name}")
            return None
            
        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting food details: {e}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error getting food details: {e}')
            return None
    
    def search_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Search for food by barcode using Nutritionix API"""
        if not self._ensure_configured():
            logger.warning('Nutritionix API credentials not configured')
            return None
        
        try:
            # Clean the barcode
            clean_barcode = ''.join(filter(str.isdigit, barcode))
            
            logger.info(f'Searching for barcode: {clean_barcode}')
            
            url = f'{self.base_url}/search/item'
            params = {'upc': clean_barcode}
            headers = {
                'x-app-id': self.app_id,
                'x-app-key': self.api_key
            }
            
            logger.info(f'Making request to: {url} with params: {params}')
            logger.info(f'Headers (without sensitive data): x-app-id={self.app_id}, x-app-key=***')
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            logger.info(f'Response status code: {response.status_code}')
            logger.info(f'Response headers: {response.headers}')
            logger.info(f'Response text: {response.text}')
            
            response.raise_for_status()
            
            data = response.json()
            logger.info(f'Nutritionix barcode response: {data}')
            
            foods = data.get('foods', [])
            if foods:
                food = foods[0]
                
                # Map the Nutritionix barcode response to our FoodItem format
                return {
                    'food_name': food.get('food_name', 'Unknown Product'),
                    'brand_name': food.get('brand_name') or food.get('nix_brand_name', ''),
                    'calories': round(food.get('nf_calories', 0)),
                    'proteins': round(food.get('nf_protein', 0)),
                    'carbs': round(food.get('nf_total_carbohydrate', 0)),
                    'fats': round(food.get('nf_total_fat', 0)),
                    'fiber': round(food.get('nf_dietary_fiber', 0)),
                    'sugar': round(food.get('nf_sugars', 0)),
                    'saturated_fat': round(food.get('nf_saturated_fat', 0)),
                    'polyunsaturated_fat': round(self._get_nutrient_value(food, 646)),
                    'monounsaturated_fat': round(self._get_nutrient_value(food, 645)),
                    'trans_fat': round(self._get_nutrient_value(food, 605)),
                    'cholesterol': round(food.get('nf_cholesterol', 0)),
                    'sodium': round(food.get('nf_sodium', 0)),
                    'potassium': round(food.get('nf_potassium', 0) or self._get_nutrient_value(food, 306)),
                    'vitamin_a': round(self._get_nutrient_value(food, 320)),
                    'vitamin_c': round(self._get_nutrient_value(food, 401)),
                    'calcium': round(self._get_nutrient_value(food, 301)),
                    'iron': round(self._get_nutrient_value(food, 303)),
                    'image': food.get('photo', {}).get('thumb') or food.get('photo', {}).get('highres', ''),
                    'serving_unit': food.get('serving_unit', 'serving'),
                    'serving_weight_grams': food.get('serving_weight_grams') or food.get('nf_metric_qty', 0),
                    'serving_qty': food.get('serving_qty', 1),
                    'healthiness_rating': self._calculate_healthiness_rating(food)
                }
            
            logger.info(f'No food found for barcode: {clean_barcode}')
            return None
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                logger.info(f'Barcode not found in Nutritionix database: {clean_barcode}')
                return None
            elif e.response.status_code == 401:
                logger.error('Authentication failed - check API credentials')
                return None
            else:
                logger.error(f'HTTP error searching for barcode: {e}')
                logger.error(f'Response content: {e.response.text if e.response else "No response"}')
                return None
        except requests.exceptions.RequestException as e:
            logger.error(f'Network error searching for barcode: {e}')
            import traceback
            logger.error(f'Traceback: {traceback.format_exc()}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error searching for barcode: {e}')
            import traceback
            logger.error(f'Traceback: {traceback.format_exc()}')
            return None

# Singleton instance
nutritionix_service = NutritionixService() 