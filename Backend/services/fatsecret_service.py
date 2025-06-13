import os
import requests
import logging
import json
import time
from typing import Dict, List, Optional, Any
from math import floor
from dotenv import load_dotenv
import base64
import random

logger = logging.getLogger(__name__)

class FatSecretService:
    """Service class for handling FatSecret API interactions for both food and recipes"""
    
    def __init__(self):
        self._load_credentials()
        self._access_token = None
        self._token_expires_at = 0
        self._api_available = True  # Track API availability
    
    def _load_credentials(self):
        """Load API credentials, with fallback to reload .env if not found"""
        self.client_id = os.getenv('FATSECRET_CLIENT_ID')
        self.client_secret = os.getenv('FATSECRET_CLIENT_SECRET')
        
        # If credentials are not found, try loading .env file
        if not self.client_id or not self.client_secret:
            logger.info("FatSecret credentials not found, attempting to load .env file...")
            load_dotenv()
            self.client_id = os.getenv('FATSECRET_CLIENT_ID')
            self.client_secret = os.getenv('FATSECRET_CLIENT_SECRET')
        
        self.base_url = 'https://platform.fatsecret.com/rest'
        self.oauth_url = 'https://oauth.fatsecret.com/connect/token'
        
        if not self.client_id or not self.client_secret:
            logger.warning("FatSecret API credentials not configured")
            logger.warning(f"FATSECRET_CLIENT_ID: {self.client_id}")
            logger.warning(f"FATSECRET_CLIENT_SECRET: {'*' * len(self.client_secret) if self.client_secret else 'None'}")
            self.is_configured = False
        else:
            logger.info("FatSecret API credentials loaded successfully")
            logger.info(f"FATSECRET_CLIENT_ID: {self.client_id}")
            logger.info(f"FATSECRET_CLIENT_SECRET: {'*' * len(self.client_secret)}")
            self.is_configured = True

    def _ensure_configured(self):
        """Ensure the service is configured, retry loading credentials if not"""
        if not self.is_configured:
            logger.info("Service not configured, retrying credential loading...")
            self._load_credentials()
        return self.is_configured
    
    def _get_access_token(self) -> Optional[str]:
        """Get a valid access token, refreshing if necessary"""
        if not self._ensure_configured():
            return None
            
        # Check if current token is still valid (with 5 minute buffer)
        if self._access_token and time.time() < (self._token_expires_at - 300):
            return self._access_token
        
        try:
            # Prepare Basic Auth header
            credentials = f"{self.client_id}:{self.client_secret}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            
            headers = {
                'Authorization': f'Basic {encoded_credentials}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            data = {
                'grant_type': 'client_credentials',
                'scope': 'basic'  # Only basic scope is available
            }
            
            logger.info(f"Requesting OAuth token with client_id: {self.client_id}")
            response = requests.post(self.oauth_url, headers=headers, data=data, timeout=15)
            
            if response.status_code != 200:
                logger.error(f"OAuth token request failed: {response.status_code} - {response.text}")
                return None
                
            token_data = response.json()
            self._access_token = token_data['access_token']
            expires_in = token_data.get('expires_in', 86400)  # Default 24 hours
            self._token_expires_at = time.time() + expires_in
            
            logger.info(f"Successfully obtained FatSecret access token, expires in {expires_in} seconds")
            return self._access_token
            
        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting FatSecret access token: {e}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error getting FatSecret access token: {e}')
            return None
    
    def _make_request(self, method: str, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make an authenticated request to FatSecret API"""
        access_token = self._get_access_token()
        if not access_token:
            logger.error("Could not obtain access token")
            return None
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, params=params, headers=headers, timeout=15)
            elif method.upper() == 'POST':
                response = requests.post(url, json=params, headers=headers, timeout=15)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            logger.info(f"API request to {endpoint}: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"API request failed: {response.status_code} - {response.text}")
                return None
                
            response_data = response.json()
            
            # Check for FatSecret API errors
            if 'error' in response_data:
                error_code = response_data['error'].get('code')
                error_message = response_data['error'].get('message')
                logger.error(f"FatSecret API error {error_code}: {error_message}")
                
                # Handle specific error cases
                if error_code == 21:  # IP address error
                    logger.error("IP address not whitelisted. Using fallback data.")
                    self._api_available = False
                    return None
                    
                return None
            
            # API is working
            self._api_available = True
            return response_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f'Error making FatSecret API request to {endpoint}: {e}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error making FatSecret API request: {e}')
            return None
    
    def _get_mock_food_data(self, query: str) -> List[Dict[str, Any]]:
        """Generate mock food data when API is unavailable"""
        mock_foods = {
            'apple': {
                'food_name': 'Apple',
                'brand_name': '',
                'calories': 52,
                'proteins': 0,
                'carbs': 14,
                'fats': 0,
                'fiber': 2,
                'sugar': 10,
                'saturated_fat': 0,
                'polyunsaturated_fat': 0,
                'monounsaturated_fat': 0,
                'trans_fat': 0,
                'cholesterol': 0,
                'sodium': 1,
                'potassium': 107,
                'vitamin_a': 3,
                'vitamin_c': 5,
                'calcium': 6,
                'iron': 0,
                'image': '',
                'serving_unit': '1 medium',
                'serving_weight_grams': 182,
                'serving_qty': 1,
                'healthiness_rating': 8
            },
            'chicken': {
                'food_name': 'Chicken Breast',
                'brand_name': '',
                'calories': 165,
                'proteins': 31,
                'carbs': 0,
                'fats': 4,
                'fiber': 0,
                'sugar': 0,
                'saturated_fat': 1,
                'polyunsaturated_fat': 1,
                'monounsaturated_fat': 1,
                'trans_fat': 0,
                'cholesterol': 85,
                'sodium': 74,
                'potassium': 256,
                'vitamin_a': 0,
                'vitamin_c': 0,
                'calcium': 15,
                'iron': 1,
                'image': '',
                'serving_unit': '100g',
                'serving_weight_grams': 100,
                'serving_qty': 1,
                'healthiness_rating': 9
            },
            'bread': {
                'food_name': 'Whole Wheat Bread',
                'brand_name': '',
                'calories': 69,
                'proteins': 4,
                'carbs': 12,
                'fats': 1,
                'fiber': 2,
                'sugar': 1,
                'saturated_fat': 0,
                'polyunsaturated_fat': 0,
                'monounsaturated_fat': 0,
                'trans_fat': 0,
                'cholesterol': 0,
                'sodium': 133,
                'potassium': 69,
                'vitamin_a': 0,
                'vitamin_c': 0,
                'calcium': 24,
                'iron': 1,
                'image': '',
                'serving_unit': '1 slice',
                'serving_weight_grams': 25,
                'serving_qty': 1,
                'healthiness_rating': 6
            }
        }
        
        # Find best match or return generic item
        query_lower = query.lower()
        for key, food_data in mock_foods.items():
            if key in query_lower or query_lower in key:
                logger.info(f"Using mock data for: {food_data['food_name']}")
                return [food_data]
        
        # Generic fallback
        generic_food = {
            'food_name': f"Generic {query.title()}",
            'brand_name': '',
            'calories': 100,
            'proteins': 5,
            'carbs': 15,
            'fats': 3,
            'fiber': 2,
            'sugar': 5,
            'saturated_fat': 1,
            'polyunsaturated_fat': 1,
            'monounsaturated_fat': 1,
            'trans_fat': 0,
            'cholesterol': 0,
            'sodium': 50,
            'potassium': 100,
            'vitamin_a': 5,
            'vitamin_c': 10,
            'calcium': 20,
            'iron': 1,
            'image': '',
            'serving_unit': '100g',
            'serving_weight_grams': 100,
            'serving_qty': 1,
            'healthiness_rating': 5
        }
        
        logger.info(f"Using generic mock data for: {query}")
        return [generic_food]
    
    def _get_mock_recipe_data(self, query: str) -> List[Dict[str, Any]]:
        """Generate mock recipe data when API is unavailable"""
        mock_recipes = [
            {
                'id': '1001',
                'title': f'{query.title()} Recipe',
                'image': 'https://via.placeholder.com/312x231.png?text=Recipe',
                'readyInMinutes': 30,
                'servings': 4,
                'sourceUrl': 'https://example.com/recipe',
                'summary': f'A delicious {query} recipe that\'s easy to make and nutritious.',
                'healthScore': 75,
                'ingredients': [f'{query}', 'Salt', 'Pepper', 'Oil'],
                'instructions': f'1. Prepare the {query}. 2. Season with salt and pepper. 3. Cook until done.',
                'diets': ['healthy'],
                'cuisines': ['American'],
                'aggregateLikes': 100
            },
            {
                'id': '1002',
                'title': f'Easy {query.title()} Dish',
                'image': 'https://via.placeholder.com/312x231.png?text=Recipe',
                'readyInMinutes': 20,
                'servings': 2,
                'sourceUrl': 'https://example.com/recipe2',
                'summary': f'Quick and easy {query} dish perfect for busy weekdays.',
                'healthScore': 65,
                'ingredients': [f'{query}', 'Herbs', 'Spices'],
                'instructions': f'1. Clean the {query}. 2. Add seasonings. 3. Serve immediately.',
                'diets': ['quick'],
                'cuisines': ['International'],
                'aggregateLikes': 85
            }
        ]
        
        logger.info(f"Using mock recipe data for: {query}")
        return mock_recipes
    
    def _calculate_healthiness_rating(self, food: Dict) -> int:
        """Calculate a comprehensive healthiness rating based on nutritional content"""
        # Extract nutrient values with defaults (ensure no None values)
        calories = food.get('calories') or 0
        protein = food.get('protein') or 0
        carbs = food.get('carbohydrate') or 0
        fat = food.get('fat') or 0
        fiber = food.get('fiber') or 0
        sugar = food.get('sugar') or 0
        saturated_fat = food.get('saturated_fat') or 0
        cholesterol = food.get('cholesterol') or 0
        sodium = food.get('sodium') or 0

        # Start with a lower base score so only truly healthy foods get high ratings
        score = 4.0  # Start lower than neutral

        # Protein is generally good (up to a point)
        if protein > 0 and calories > 0:
            # Protein quality score: higher is better
            protein_quality = protein / calories * 400  # Scaled to ~0-4 range
            score += min(2, protein_quality)

        # Fiber is good
        if fiber > 0 and calories > 0:
            # Fiber quality score: higher is better
            fiber_quality = fiber / calories * 400  # Scaled to ~0-2 range
            score += min(1.5, fiber_quality)

        # Penalties - more aggressive penalties to ensure only truly healthy foods score highly

        # Sugar penalty (worse at higher percentages of total carbs)
        if sugar > 0 and carbs > 0:
            sugar_ratio = sugar / carbs
            score -= sugar_ratio * 3  # Up to -3 points for pure sugar (increased penalty)
        elif sugar > 10:
            score -= 1.5  # Penalty for high sugar regardless of carb ratio

        # Saturated fat penalty
        if saturated_fat > 0 and calories > 0:
            saturated_fat_ratio = (saturated_fat * 9) / calories  # 9 calories per gram of fat
            score -= saturated_fat_ratio * 4  # Up to -4 points for high saturated fat

        # Sodium penalty (more aggressive)
        if sodium > 500:  # Lowered threshold
            score -= min(2.5, (sodium - 500) / 1000)  # Up to -2.5 points for very high sodium

        # Cholesterol penalty
        if cholesterol > 100:  # Reasonable daily limit consideration
            score -= min(1.5, (cholesterol - 100) / 200)  # Up to -1.5 points

        # Calorie density penalty (for very high-calorie foods)
        if calories > 400:  # Per serving
            score -= min(1.5, (calories - 400) / 200)  # Penalty for very high calorie foods

        # Ensure score is between 1 and 10
        final_score = max(1, min(10, round(score)))
        
        return final_score
    
    def _map_fatsecret_food_to_food_item(self, food_data: Dict) -> Dict[str, Any]:
        """Map FatSecret API food response to our FoodItem format"""
        # Handle different response formats from different endpoints
        if 'food' in food_data:
            food = food_data['food']
        else:
            food = food_data
            
        # Extract basic food information
        food_name = food.get('food_name', '')
        brand_name = food.get('brand_name', '')
        
        # Get nutrition data - FatSecret returns servings array
        servings = food.get('servings', {})
        if isinstance(servings, dict) and 'serving' in servings:
            serving_list = servings['serving']
            # Handle both single serving and multiple servings
            if isinstance(serving_list, list):
                # Use the first serving (usually per 100g or default serving)
                serving = serving_list[0]
            else:
                serving = serving_list
        else:
            serving = {}
        
        # Extract nutritional values
        calories = float(serving.get('calories', 0) or 0)
        protein = float(serving.get('protein', 0) or 0)
        carbs = float(serving.get('carbohydrate', 0) or 0)
        fat = float(serving.get('fat', 0) or 0)
        fiber = float(serving.get('fiber', 0) or 0)
        sugar = float(serving.get('sugar', 0) or 0)
        saturated_fat = float(serving.get('saturated_fat', 0) or 0)
        polyunsaturated_fat = float(serving.get('polyunsaturated_fat', 0) or 0)
        monounsaturated_fat = float(serving.get('monounsaturated_fat', 0) or 0)
        trans_fat = float(serving.get('trans_fat', 0) or 0)
        cholesterol = float(serving.get('cholesterol', 0) or 0)
        sodium = float(serving.get('sodium', 0) or 0)
        potassium = float(serving.get('potassium', 0) or 0)
        vitamin_a = float(serving.get('vitamin_a', 0) or 0)
        vitamin_c = float(serving.get('vitamin_c', 0) or 0)
        calcium = float(serving.get('calcium', 0) or 0)
        iron = float(serving.get('iron', 0) or 0)
        
        # Get serving information
        serving_description = serving.get('serving_description', 'serving')
        metric_serving_amount = float(serving.get('metric_serving_amount', 1) or 1)
        metric_serving_unit = serving.get('metric_serving_unit', 'g')
        serving_id = serving.get('serving_id', '0')
        
        # Create the mapped food item
        mapped_item = {
            'food_name': food_name,
            'brand_name': brand_name,
            'calories': round(calories),
            'proteins': round(protein),
            'carbs': round(carbs),
            'fats': round(fat),
            'fiber': round(fiber),
            'sugar': round(sugar),
            'saturated_fat': round(saturated_fat),
            'polyunsaturated_fat': round(polyunsaturated_fat),
            'monounsaturated_fat': round(monounsaturated_fat),
            'trans_fat': round(trans_fat),
            'cholesterol': round(cholesterol),
            'sodium': round(sodium),
            'potassium': round(potassium),
            'vitamin_a': round(vitamin_a),
            'vitamin_c': round(vitamin_c),
            'calcium': round(calcium),
            'iron': round(iron),
            'image': '',  # FatSecret provides food images in a different way
            'serving_unit': serving_description,
            'serving_weight_grams': metric_serving_amount if metric_serving_unit == 'g' else 0,
            'serving_qty': 1,
            'healthiness_rating': self._calculate_healthiness_rating({
                'calories': calories,
                'protein': protein,
                'carbohydrate': carbs,
                'fat': fat,
                'fiber': fiber,
                'sugar': sugar,
                'saturated_fat': saturated_fat,
                'cholesterol': cholesterol,
                'sodium': sodium
            })
        }
        
        return mapped_item
    
    def search_food(self, query: str, min_healthiness: int = 0) -> List[Dict[str, Any]]:
        """Search for foods using the FatSecret API or fallback data"""
        if not self._ensure_configured():
            logger.warning('FatSecret API credentials not configured')
            return []
        
        try:
            params = {
                'search_expression': query,
                'max_results': 20,
                'format': 'json'
            }
            
            # Try FatSecret API first
            response = self._make_request('GET', 'foods/search/v1', params)
            
            if response:
                foods_data = response.get('foods', {})
                if isinstance(foods_data, dict) and 'food' in foods_data:
                    foods_list = foods_data['food']
                    # Handle both single food and multiple foods
                    if not isinstance(foods_list, list):
                        foods_list = [foods_list]
                else:
                    foods_list = []
                
                logger.info(f"FatSecret search returned {len(foods_list)} foods for query: {query}")
                
                # Get detailed nutrition for each food
                detailed_results = []
                for food_item in foods_list[:10]:  # Limit to top 10 for performance
                    food_id = food_item.get('food_id')
                    if food_id:
                        detailed_food = self.get_food_details_by_id(food_id)
                        if detailed_food:
                            # Apply minimum healthiness filter
                            if detailed_food.get('healthiness_rating', 0) >= min_healthiness:
                                detailed_results.append(detailed_food)
                
                # Sort by healthiness rating (highest first)
                detailed_results.sort(key=lambda x: x.get('healthiness_rating', 0), reverse=True)
                
                return detailed_results
            else:
                # API unavailable, use fallback data
                logger.info(f"Using fallback data for food search: {query}")
                mock_results = self._get_mock_food_data(query)
                # Apply minimum healthiness filter
                filtered_results = [item for item in mock_results if item.get('healthiness_rating', 0) >= min_healthiness]
                return filtered_results
            
        except Exception as e:
            logger.error(f'Unexpected error searching for food: {e}')
            # Return fallback data on error
            return self._get_mock_food_data(query)
    
    def get_food_details_by_id(self, food_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed nutrition information for a food by ID"""
        if not self._ensure_configured():
            return None
        
        try:
            params = {
                'food_id': food_id,
                'format': 'json'
            }
            
            response = self._make_request('GET', 'food/v4', params)
            
            if response:
                mapped_result = self._map_fatsecret_food_to_food_item(response)
                return mapped_result
            
            return None
            
        except Exception as e:
            logger.error(f'Unexpected error getting food details for ID {food_id}: {e}')
            return None
    
    def get_food_details(self, food_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed nutrition information for a food by name"""
        # First search for the food, then get details of the best match
        search_results = self.search_food(food_name)
        if search_results:
            return search_results[0]  # Return the best match
        return None
    
    def search_by_barcode(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Search for food by barcode - not available with basic scope"""
        logger.info(f'Barcode scanning not available with basic scope - barcode: {barcode}')
        return None
    
    def _map_fatsecret_recipe_to_recipe(self, recipe_data: Dict) -> Dict[str, Any]:
        """Map FatSecret recipe response to our Recipe format"""
        if 'recipe' in recipe_data:
            recipe = recipe_data['recipe']
        else:
            recipe = recipe_data
        
        # Extract basic recipe information
        recipe_id = str(recipe.get('recipe_id', ''))
        recipe_name = recipe.get('recipe_name', '')
        recipe_description = recipe.get('recipe_description', '')
        recipe_image = recipe.get('recipe_image', '')
        
        # Extract nutrition information
        nutrition = recipe.get('recipe_nutrition', {})
        calories = float(nutrition.get('calories', 0) or 0)
        protein = float(nutrition.get('protein', 0) or 0)
        carbs = float(nutrition.get('carbohydrate', 0) or 0)
        fat = float(nutrition.get('fat', 0) or 0)
        
        # Extract ingredients
        ingredients_data = recipe.get('recipe_ingredients', {})
        if isinstance(ingredients_data, dict) and 'ingredient' in ingredients_data:
            ingredients_list = ingredients_data['ingredient']
            if not isinstance(ingredients_list, list):
                ingredients_list = [ingredients_list]
        else:
            ingredients_list = []
        
        # Extract recipe types
        types_data = recipe.get('recipe_types', {})
        if isinstance(types_data, dict) and 'recipe_type' in types_data:
            types_list = types_data['recipe_type']
            if not isinstance(types_list, list):
                types_list = [types_list]
        else:
            types_list = []
        
        return {
            'id': recipe_id,
            'title': recipe_name,
            'image': recipe_image,
            'readyInMinutes': 30,  # Default value as FatSecret doesn't provide this
            'servings': 4,  # Default value
            'sourceUrl': f'https://www.fatsecret.com/recipes/{recipe_id}',
            'summary': recipe_description,
            'healthScore': min(100, max(0, int(calories / 10))),  # Rough health score calculation
            'ingredients': ingredients_list,
            'instructions': '',  # FatSecret doesn't provide detailed instructions in search
            'diets': [],  # Would need to be determined from ingredients
            'cuisines': [],  # FatSecret doesn't provide cuisine classification in basic search
            'aggregateLikes': 0  # Not available in FatSecret
        }
    
    def search_recipes(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search for recipes using the FatSecret API or fallback data"""
        if not self._ensure_configured():
            logger.warning('FatSecret API key not configured')
            return []
        
        query = params.get('query', 'recipe')
        
        try:
            # Build FatSecret API parameters
            api_params = {
                'max_results': params.get('number', 10),
                'page_number': params.get('offset', 0) // params.get('number', 10),
                'format': 'json'
            }
            
            if params.get('query'):
                api_params['search_expression'] = params['query']
            
            # Try FatSecret API first
            response = self._make_request('GET', 'recipes/search/v3', api_params)
            
            if response:
                recipes_data = response.get('recipes', {})
                if isinstance(recipes_data, dict) and 'recipe' in recipes_data:
                    recipes_list = recipes_data['recipe']
                    if not isinstance(recipes_list, list):
                        recipes_list = [recipes_list]
                else:
                    recipes_list = []
                
                logger.info(f"Found {len(recipes_list)} recipes for search")
                return [self._map_fatsecret_recipe_to_recipe(recipe) for recipe in recipes_list]
            else:
                # API unavailable, use fallback data
                logger.info(f"Using fallback data for recipe search: {query}")
                return self._get_mock_recipe_data(query)
            
        except Exception as e:
            logger.error(f'Unexpected error searching recipes: {e}')
            return self._get_mock_recipe_data(query)
    
    def get_recipe_by_id(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        """Get recipe details by ID"""
        if not self._ensure_configured():
            logger.warning('FatSecret API key not configured')
            return None
        
        try:
            params = {
                'recipe_id': recipe_id,
                'format': 'json'
            }
            
            response = self._make_request('GET', 'recipe/v2', params)
            
            if response:
                return self._map_fatsecret_recipe_to_recipe(response)
            
            # Fallback for mock data
            mock_recipes = self._get_mock_recipe_data('recipe')
            for recipe in mock_recipes:
                if recipe['id'] == recipe_id:
                    return recipe
            
            return None
            
        except Exception as e:
            logger.error(f'Unexpected error getting recipe by ID: {e}')
            return None
    
    def get_random_recipes(self, count: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get random recipes"""
        if not self._ensure_configured():
            logger.warning('FatSecret API key not configured')
            return []
        
        try:
            # Try different search terms for variety
            popular_terms = ['chicken', 'beef', 'pasta', 'salad', 'soup', 'dessert', 'breakfast', 'lunch', 'dinner']
            random_term = random.choice(popular_terms)
            
            params = {
                'query': random_term,
                'number': count * 2,  # Get more to randomize
                'offset': random.randint(0, 20)
            }
            
            if filters:
                params.update(filters)
            
            results = self.search_recipes(params)
            
            # Randomize and return requested count
            random.shuffle(results)
            return results[:count]
            
        except Exception as e:
            logger.error(f'Error getting random recipes: {e}')
            # Return multiple different mock recipes
            all_mock_recipes = []
            for term in ['chicken', 'pasta', 'salad'][:count]:
                all_mock_recipes.extend(self._get_mock_recipe_data(term))
            random.shuffle(all_mock_recipes)
            return all_mock_recipes[:count]
    
    def get_recipes_by_meal_type(self, meal_type: str, count: int = 3) -> List[Dict[str, Any]]:
        """Get recipes filtered by meal type"""
        if not self._ensure_configured():
            logger.warning('FatSecret API key not configured')
            return []
        
        try:
            # Map meal types to search terms
            meal_type_queries = {
                'breakfast': 'breakfast pancakes eggs oatmeal',
                'lunch': 'sandwich salad soup',
                'dinner': 'chicken beef pasta rice',
                'snack': 'snack bars nuts fruit',
                'dessert': 'dessert cake cookies',
                'italian': 'pasta pizza italian',
                'american': 'burger chicken american',
                'healthy': 'healthy salad vegetables',
                'vegetarian': 'vegetarian vegetables',
                'quick': 'quick easy fast'
            }
            
            query = meal_type_queries.get(meal_type.lower(), meal_type)
            
            params = {
                'query': query,
                'number': count,
                'offset': 0
            }
            
            results = self.search_recipes(params)
            logger.info(f"Found {len(results)} recipes for meal type: {meal_type}")
            return results
            
        except Exception as e:
            logger.error(f'Unexpected error getting recipes by meal type: {e}')
            return self._get_mock_recipe_data(meal_type)
    
    def generate_meal_plan(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a meal plan using FatSecret recipes or fallback data"""
        if not self._ensure_configured():
            logger.warning('FatSecret API key not configured')
            return {
                'meals': [],
                'nutrients': {
                    'calories': 0,
                    'protein': 0,
                    'fat': 0,
                    'carbohydrates': 0
                }
            }
        
        try:
            # Generate meal plan regardless of API availability
            time_frame = params.get('timeFrame', 'day')
            target_calories = params.get('targetCalories', 2000)
            
            if time_frame == 'day':
                # Generate a day's worth of meals
                breakfast_recipes = self.get_recipes_by_meal_type('breakfast', 1)
                lunch_recipes = self.get_recipes_by_meal_type('lunch', 1)
                dinner_recipes = self.get_recipes_by_meal_type('dinner', 1)
                
                meals = []
                total_nutrients = {'calories': 0, 'protein': 0, 'fat': 0, 'carbohydrates': 0}
                
                for meal_type, recipes in [('breakfast', breakfast_recipes), ('lunch', lunch_recipes), ('dinner', dinner_recipes)]:
                    if recipes:
                        recipe = recipes[0]
                        meal = {
                            'id': recipe['id'],
                            'slot': 1,
                            'position': 0,
                            'type': meal_type,
                            'value': recipe
                        }
                        meals.append(meal)
                        
                        # Add to total nutrients (rough estimation)
                        total_nutrients['calories'] += target_calories // 3
                        total_nutrients['protein'] += 20
                        total_nutrients['fat'] += 15
                        total_nutrients['carbohydrates'] += 50
                
                return {
                    'meals': meals,
                    'nutrients': total_nutrients
                }
            
            return {
                'meals': [],
                'nutrients': {
                    'calories': 0,
                    'protein': 0,
                    'fat': 0,
                    'carbohydrates': 0
                }
            }
            
        except Exception as e:
            logger.error(f'Unexpected error generating meal plan: {e}')
            return {
                'meals': [],
                'nutrients': {
                    'calories': 0,
                    'protein': 0,
                    'fat': 0,
                    'carbohydrates': 0
                }
            }
    
    def autocomplete_recipes(self, query: str) -> List[Dict[str, Any]]:
        """Autocomplete recipe search - simplified implementation"""
        if not self._ensure_configured() or not query.strip():
            return []
        
        try:
            # Use regular recipe search with limited results for autocomplete
            params = {
                'query': query.strip(),
                'number': 10
            }
            
            results = self.search_recipes(params)
            return [{'id': int(recipe['id']) if recipe['id'].isdigit() else hash(recipe['id']) % 10000, 'title': recipe['title']} for recipe in results]
            
        except Exception as e:
            logger.error(f'Error getting recipe autocomplete: {e}')
            return []
    
    def autocomplete_ingredients(self, query: str) -> List[Dict[str, Any]]:
        """Autocomplete ingredient search - using food search"""
        if not self._ensure_configured() or not query.strip():
            return []
        
        try:
            # Use food search for ingredient autocomplete
            food_results = self.search_food(query.strip())
            return [{'id': i, 'name': food['food_name']} for i, food in enumerate(food_results[:8])]
            
        except Exception as e:
            logger.error(f'Error getting ingredient autocomplete: {e}')
            return []

# Singleton instance
fatsecret_service = FatSecretService() 