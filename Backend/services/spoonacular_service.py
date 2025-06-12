import os
import requests
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class SpoonacularService:
    """Service class for handling Spoonacular API interactions"""

    def __init__(self):
        self.api_key = os.getenv('SPOONACULAR_API_KEY')
        self.base_url = 'https://api.spoonacular.com'
        
        if not self.api_key:
            logger.warning("Spoonacular API key not configured")
            self.is_configured = False
        else:
            logger.info("Spoonacular API key loaded successfully")
            self.is_configured = True

    def _map_spoonacular_recipe(self, spoon_recipe: Dict) -> Dict[str, Any]:
        """Map Spoonacular recipe to our Recipe interface"""
        # Get highest resolution image by modifying the image size parameter
        image_url = spoon_recipe.get('image', '')
        if image_url and not image_url.startswith('http'):
            # Use highest resolution: 636x393 for best quality
            image_url = f"https://spoonacular.com/recipeImages/{spoon_recipe.get('id')}-636x393.{spoon_recipe.get('imageType', 'jpg')}"
        elif image_url and '312x231' in image_url:
            # Replace smaller resolution with highest one
            image_url = image_url.replace('312x231', '636x393')
        elif image_url and '240x150' in image_url:
            # Replace smaller resolution with highest one
            image_url = image_url.replace('240x150', '636x393')
        elif image_url and '556x370' in image_url:
            # Replace medium resolution with highest one
            image_url = image_url.replace('556x370', '636x393')

        # Process ingredients
        ingredients = []
        if spoon_recipe.get('extendedIngredients'):
            for ing in spoon_recipe['extendedIngredients']:
                original = ing.get('original', '')
                if ' -or- ' in original:
                    # Split alternatives and return the first option as primary
                    alternatives = original.split(' -or- ')
                    ingredients.append(alternatives[0].strip())
                else:
                    ingredients.append(original)
            ingredients = [ing for ing in ingredients if ing and len(ing) > 0]

        return {
            'id': str(spoon_recipe.get('id', '')),
            'title': spoon_recipe.get('title', ''),
            'image': image_url,
            'readyInMinutes': spoon_recipe.get('readyInMinutes', 0),
            'servings': spoon_recipe.get('servings', 1),
            'sourceUrl': spoon_recipe.get('sourceUrl', ''),
            'summary': spoon_recipe.get('summary', '').replace('<[^>]*>', '') if spoon_recipe.get('summary') else '',
            'healthScore': spoon_recipe.get('healthScore', 0),
            'ingredients': ingredients,
            'instructions': spoon_recipe.get('instructions', '').replace('<[^>]*>', '') if spoon_recipe.get('instructions') else '',
            'diets': spoon_recipe.get('diets', []),
            'cuisines': spoon_recipe.get('cuisines', []),
            'aggregateLikes': spoon_recipe.get('aggregateLikes', 0),
        }

    def search_recipes(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search for recipes using the Spoonacular API"""
        if not self.is_configured:
            logger.warning('Spoonacular API key not configured')
            return []

        try:
            url = f'{self.base_url}/recipes/complexSearch'
            api_params = {
                'apiKey': self.api_key,
                'number': params.get('number', 10),
                'offset': params.get('offset', 0),
                'addRecipeInformation': True,
                'fillIngredients': True,
                'instructionsRequired': True,
            }

            # Add optional parameters
            if params.get('query'):
                api_params['query'] = params['query']
            if params.get('cuisine'):
                api_params['cuisine'] = params['cuisine']
            if params.get('diet'):
                api_params['diet'] = params['diet']
            if params.get('intolerances'):
                api_params['intolerances'] = params['intolerances']
            if params.get('maxReadyTime'):
                api_params['maxReadyTime'] = params['maxReadyTime']
            if params.get('sort'):
                api_params['sort'] = params['sort']
            if params.get('sortDirection'):
                api_params['sortDirection'] = params['sortDirection']
            if params.get('includeIngredients'):
                if isinstance(params['includeIngredients'], list):
                    api_params['includeIngredients'] = ','.join(params['includeIngredients'])
                else:
                    api_params['includeIngredients'] = params['includeIngredients']

            response = requests.get(url, params=api_params, timeout=10)
            response.raise_for_status()

            data = response.json()
            results = data.get('results', [])
            
            logger.info(f"Found {len(results)} recipes for search")
            return [self._map_spoonacular_recipe(recipe) for recipe in results]

        except requests.exceptions.RequestException as e:
            logger.error(f'Error searching recipes: {e}')
            return []
        except Exception as e:
            logger.error(f'Unexpected error searching recipes: {e}')
            return []

    def get_recipe_by_id(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        """Get recipe details by ID"""
        if not self.is_configured:
            logger.warning('Spoonacular API key not configured')
            return None

        try:
            url = f'{self.base_url}/recipes/{recipe_id}/information'
            params = {
                'apiKey': self.api_key,
                'includeNutrition': False
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            return self._map_spoonacular_recipe(data)

        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting recipe by ID: {e}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error getting recipe by ID: {e}')
            return None

    def get_random_recipes(self, count: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get random recipes with optional filters"""
        if not self.is_configured:
            logger.warning('Spoonacular API key not configured')
            return []

        try:
            # Mix of mainstream cuisines that Americans love
            popular_cuisines = ['american', 'mexican', 'italian', 'asian', 'mediterranean']
            popular_keywords = [
                'burger', 'quesadilla', 'enchilada', 'nacho', 'loaded fries', 'pizza', 'taco',
                'sandwich', 'pasta', 'stir fry', 'bowl', 'wrap', 'chicken', 'beef', 'cheese'
            ]

            all_results = []

            # Fetch from different categories to ensure variety
            for i in range(3):
                import random
                random_cuisine = random.choice(popular_cuisines)
                random_keyword = random.choice(popular_keywords)

                try:
                    url = f'{self.base_url}/recipes/complexSearch'
                    api_params = {
                        'apiKey': self.api_key,
                        'number': max(1, count // 2),  # Get fewer per request to mix categories
                        'addRecipeInformation': True,
                        'fillIngredients': True,
                        'minHealthScore': 40,  # Lower threshold for more variety while still being reasonably healthy
                        'sort': 'aggregateLikes',
                        'sortDirection': 'desc',
                        'instructionsRequired': True,
                        'limitLicense': False,
                        'cuisine': random_cuisine,
                        'offset': random.randint(0, 10),
                    }

                    # Sometimes use keyword, sometimes just cuisine
                    if random.random() > 0.5:
                        api_params['query'] = random_keyword

                    # Apply additional filters if provided
                    if filters:
                        api_params.update(filters)

                    response = requests.get(url, params=api_params, timeout=10)
                    response.raise_for_status()

                    data = response.json()
                    results = [self._map_spoonacular_recipe(recipe) for recipe in data.get('results', [])]
                    all_results.extend(results)

                except Exception as e:
                    logger.warning(f"Failed to fetch {random_cuisine} recipes: {e}")
                    continue

            # If we don't have enough results, try a broader search
            if len(all_results) < count:
                try:
                    url = f'{self.base_url}/recipes/complexSearch'
                    api_params = {
                        'apiKey': self.api_key,
                        'number': count,
                        'addRecipeInformation': True,
                        'fillIngredients': True,
                        'minHealthScore': 35,  # Even more flexible for mainstream appeal
                        'sort': 'aggregateLikes',
                        'sortDirection': 'desc',
                        'instructionsRequired': True,
                        'limitLicense': False,
                        'cuisine': 'american,mexican,italian',
                        'type': 'main course',
                        'offset': 0,
                    }

                    if filters:
                        api_params.update(filters)

                    response = requests.get(url, params=api_params, timeout=10)
                    response.raise_for_status()

                    data = response.json()
                    results = [self._map_spoonacular_recipe(recipe) for recipe in data.get('results', [])]
                    all_results.extend(results)

                except Exception as e:
                    logger.warning(f"Fallback search failed: {e}")

            # Remove duplicates and sort by popularity
            unique_results = []
            seen_ids = set()
            for recipe in all_results:
                if recipe['id'] not in seen_ids:
                    unique_results.append(recipe)
                    seen_ids.add(recipe['id'])

            # Sort by popularity
            unique_results.sort(key=lambda x: x.get('aggregateLikes', 0), reverse=True)

            return unique_results[:count]

        except Exception as e:
            logger.error(f'Error getting random recipes: {e}')
            return []

    def get_recipes_by_meal_type(self, meal_type: str, count: int = 3) -> List[Dict[str, Any]]:
        """Get recipes by meal type"""
        if not self.is_configured:
            logger.warning('Spoonacular API key not configured')
            return []

        try:
            url = f'{self.base_url}/recipes/complexSearch'
            api_params = {
                'apiKey': self.api_key,
                'number': count,
                'addRecipeInformation': True,
                'fillIngredients': True,
                'minHealthScore': 45,  # Lower default for more mainstream appeal while still healthy
                'sort': 'aggregateLikes',
                'sortDirection': 'desc',
                'instructionsRequired': True,
                'offset': __import__('random').randint(0, 15),  # Small random offset for meal types
            }

            # Apply meal type-specific filters
            meal_type_lower = meal_type.lower()
            if meal_type_lower == 'breakfast':
                api_params['type'] = 'breakfast'
            elif meal_type_lower == 'lunch':
                api_params['type'] = 'main course'
                api_params['maxReadyTime'] = 30  # Quick lunch
            elif meal_type_lower == 'dinner':
                api_params['type'] = 'main course'
            elif meal_type_lower == 'italian':
                api_params['cuisine'] = 'italian'
                api_params['query'] = 'pizza,pasta,lasagna,risotto,sandwich'
                api_params['minHealthScore'] = 40
            elif meal_type_lower == 'american':
                api_params['cuisine'] = 'american'
                api_params['query'] = 'burger,sandwich,bbq,steak,chicken,fries'
                api_params['minHealthScore'] = 40
            elif meal_type_lower == 'snack':
                api_params['type'] = 'snack'
            elif meal_type_lower == 'vegetarian':
                api_params['diet'] = 'vegetarian'
                api_params['minHealthScore'] = 50  # Maintain higher standard for vegetarian
            elif meal_type_lower == 'healthy':
                api_params['sort'] = 'healthiness'
                api_params['sortDirection'] = 'desc'
                api_params['minHealthScore'] = 70  # Higher standard for healthy category
            elif meal_type_lower == 'quick':
                api_params['maxReadyTime'] = 25
                api_params['type'] = 'main course'

            response = requests.get(url, params=api_params, timeout=10)
            response.raise_for_status()

            data = response.json()
            results = [self._map_spoonacular_recipe(recipe) for recipe in data.get('results', [])]

            logger.info(f"Found {len(results)} recipes for meal type: {meal_type}")
            return results

        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting recipes by meal type: {e}')
            return []
        except Exception as e:
            logger.error(f'Unexpected error getting recipes by meal type: {e}')
            return []

    def generate_meal_plan(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a meal plan using Spoonacular API"""
        if not self.is_configured:
            logger.warning('Spoonacular API key not configured')
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
            url = f'{self.base_url}/mealplanner/generate'
            api_params = {
                'apiKey': self.api_key,
                'timeFrame': params.get('timeFrame', 'day'),
            }

            # Add optional parameters
            if params.get('targetCalories'):
                api_params['targetCalories'] = params['targetCalories']
            if params.get('diet'):
                api_params['diet'] = params['diet']
            if params.get('exclude'):
                if isinstance(params['exclude'], list):
                    api_params['exclude'] = ','.join(params['exclude'])
                else:
                    api_params['exclude'] = params['exclude']
            if params.get('type'):
                api_params['type'] = params['type']
            if params.get('cuisine'):
                api_params['cuisine'] = params['cuisine']
            if params.get('maxReadyTime'):
                api_params['maxReadyTime'] = params['maxReadyTime']
            if params.get('minProtein'):
                api_params['minProtein'] = params['minProtein']
            if params.get('maxCarbs'):
                api_params['maxCarbs'] = params['maxCarbs']

            response = requests.get(url, params=api_params, timeout=10)
            response.raise_for_status()

            data = response.json()
            return data

        except requests.exceptions.RequestException as e:
            logger.error(f'Error generating meal plan: {e}')
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
        """Autocomplete recipe search"""
        if not self.is_configured or not query.strip():
            return []

        try:
            url = f'{self.base_url}/recipes/autocomplete'
            params = {
                'apiKey': self.api_key,
                'query': query.strip(),
                'number': 10
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            return [{'id': item.get('id'), 'title': item.get('title')} for item in data]

        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting recipe autocomplete: {e}')
            return []
        except Exception as e:
            logger.error(f'Unexpected error getting recipe autocomplete: {e}')
            return []

    def autocomplete_ingredients(self, query: str) -> List[Dict[str, Any]]:
        """Autocomplete ingredient search"""
        if not self.is_configured or not query.strip():
            return []

        try:
            url = f'{self.base_url}/food/ingredients/autocomplete'
            params = {
                'apiKey': self.api_key,
                'query': query.strip(),
                'number': 8
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            return [{'id': item.get('id'), 'name': item.get('name')} for item in data]

        except requests.exceptions.RequestException as e:
            logger.error(f'Error getting ingredient autocomplete: {e}')
            return []
        except Exception as e:
            logger.error(f'Unexpected error getting ingredient autocomplete: {e}')
            return []

# Singleton instance
spoonacular_service = SpoonacularService()