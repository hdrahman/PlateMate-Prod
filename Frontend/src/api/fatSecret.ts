import axios from 'axios';
import { BACKEND_URL, FATSECRET_ENABLED } from '../utils/config';
import { FoodItem } from './nutritionix'; // Reuse the FoodItem type from nutritionix

// Base URL for FatSecret API requests (through our backend)
const FATSECRET_API_URL = `${BACKEND_URL}/api/fatsecret`;

/**
 * Search for foods using the FatSecret API (via our backend)
 * @param query Search query string
 * @param maxResults Maximum number of results to return
 * @returns Array of food items matching the search query
 */
export const searchFatSecretFood = async (
    query: string,
    maxResults: number = 10
): Promise<FoodItem[]> => {
    // Check if FatSecret integration is enabled
    if (!FATSECRET_ENABLED) {
        return [];
    }

    try {
        // Make a request to our backend, which forwards to FatSecret
        const response = await axios.get(`${FATSECRET_API_URL}/search`, {
            params: {
                query,
                max_results: maxResults,
            },
            timeout: 10000, // 10 second timeout
        });

        // FatSecret response structure is different from Nutritionix
        const responseData = response.data;

        // If no foods property in the response or it explicitly states no foods found
        if (!responseData.foods || responseData.no_results === true) {
            console.log('No foods found for query:', query);
            return [];
        }

        // FatSecret can return a single object or an array
        const foodsData = Array.isArray(responseData.foods.food)
            ? responseData.foods.food
            : (responseData.foods.food ? [responseData.foods.food] : []);

        // If the array is empty, return empty array
        if (foodsData.length === 0) {
            console.log('Empty foods array for query:', query);
            return [];
        }

        // Transform the FatSecret food data into our app's FoodItem format
        return foodsData.map((food: any) => {
            // Parse nutrition information
            const nutrients = food.food_description ? parseNutritionInfo(food.food_description) : {
                calories: 0,
                protein_g: 0,
                fat_g: 0,
                carbohydrate_g: 0,
                fiber_g: 0,
            };

            return {
                food_name: food.food_name,
                brand_name: 'FatSecret Database',
                calories: nutrients.calories,
                proteins: nutrients.protein_g,
                carbs: nutrients.carbohydrate_g,
                fats: nutrients.fat_g,
                fiber: nutrients.fiber_g,
                sugar: 0, // Not provided directly
                saturated_fat: 0, // Not provided directly
                polyunsaturated_fat: 0, // Not provided directly
                monounsaturated_fat: 0, // Not provided directly
                trans_fat: 0, // Not provided directly
                cholesterol: 0, // Not provided directly
                sodium: 0, // Not provided directly
                potassium: 0, // Not provided directly
                vitamin_a: 0, // Not provided directly
                vitamin_c: 0, // Not provided directly
                calcium: 0, // Not provided directly
                iron: 0, // Not provided directly
                image: '', // FatSecret doesn't provide images
                serving_unit: 'serving',
                serving_weight_grams: 100, // Default
                serving_qty: 1,
                healthiness_rating: 5, // Default middle rating
                notes: `FatSecret ID: ${food.food_id}`,
            };
        });
    } catch (error) {
        console.error('Error searching FatSecret foods:', error);

        // Log details for debugging
        if (axios.isAxiosError(error) && error.response) {
            console.error('Status:', error.response.status);
            console.error('Response data:', error.response.data);
        }

        // Gracefully handle the error and return empty array
        return [];
    }
};

/**
 * Get detailed information about a specific food from FatSecret
 * @param foodId The ID of the food in FatSecret
 * @returns Detailed food item
 */
export const getFatSecretFoodDetails = async (foodId: string): Promise<FoodItem | null> => {
    try {
        const response = await axios.get(`${FATSECRET_API_URL}/food/${foodId}`, {
            timeout: 10000, // 10 second timeout
        });

        const foodData = response.data.food;

        if (!foodData) {
            return null;
        }

        // Parse nutrition information from the serving
        const defaultServing = foodData.servings.serving;
        const servingData = Array.isArray(defaultServing) ? defaultServing[0] : defaultServing;

        return {
            food_name: foodData.food_name,
            brand_name: 'FatSecret Database',
            calories: parseFloat(servingData.calories) || 0,
            proteins: parseFloat(servingData.protein) || 0,
            carbs: parseFloat(servingData.carbohydrate) || 0,
            fats: parseFloat(servingData.fat) || 0,
            fiber: parseFloat(servingData.fiber) || 0,
            sugar: parseFloat(servingData.sugar) || 0,
            saturated_fat: parseFloat(servingData.saturated_fat) || 0,
            polyunsaturated_fat: 0, // Not provided directly
            monounsaturated_fat: 0, // Not provided directly
            trans_fat: 0, // Not provided directly
            cholesterol: parseFloat(servingData.cholesterol) || 0,
            sodium: parseFloat(servingData.sodium) || 0,
            potassium: parseFloat(servingData.potassium) || 0,
            vitamin_a: 0, // Not provided directly
            vitamin_c: 0, // Not provided directly
            calcium: 0, // Not provided directly
            iron: 0, // Not provided directly
            image: '', // FatSecret doesn't provide images
            serving_unit: servingData.serving_description || 'serving',
            serving_weight_grams: parseFloat(servingData.metric_serving_amount) || 100,
            serving_qty: 1,
            healthiness_rating: 5, // Default middle rating
            notes: `FatSecret ID: ${foodData.food_id}`,
        };
    } catch (error) {
        console.error('Error getting FatSecret food details:', error);

        // Log details for debugging
        if (axios.isAxiosError(error) && error.response) {
            console.error('Status:', error.response.status);
            console.error('Response data:', error.response.data);
        }

        return null;
    }
};

/**
 * Helper function to parse nutrition info from FatSecret food description string
 * @param description Food description string containing nutrition info
 * @returns Parsed nutrition values
 */
function parseNutritionInfo(description: string) {
    const nutrients = {
        calories: 0,
        protein_g: 0,
        fat_g: 0,
        carbohydrate_g: 0,
        fiber_g: 0,
    };

    // Example: "Per 100g - Calories: 123kcal | Fat: 5.2g | Carbs: 12.3g | Protein: 8.1g"
    try {
        // Match calories
        const caloriesMatch = description.match(/Calories:\s*(\d+)/i);
        if (caloriesMatch && caloriesMatch[1]) {
            nutrients.calories = parseInt(caloriesMatch[1], 10);
        }

        // Match fat
        const fatMatch = description.match(/Fat:\s*([\d.]+)g/i);
        if (fatMatch && fatMatch[1]) {
            nutrients.fat_g = parseFloat(fatMatch[1]);
        }

        // Match carbs
        const carbsMatch = description.match(/Carbs:\s*([\d.]+)g/i);
        if (carbsMatch && carbsMatch[1]) {
            nutrients.carbohydrate_g = parseFloat(carbsMatch[1]);
        }

        // Match protein
        const proteinMatch = description.match(/Protein:\s*([\d.]+)g/i);
        if (proteinMatch && proteinMatch[1]) {
            nutrients.protein_g = parseFloat(proteinMatch[1]);
        }

        // Match fiber (not always present)
        const fiberMatch = description.match(/Fiber:\s*([\d.]+)g/i);
        if (fiberMatch && fiberMatch[1]) {
            nutrients.fiber_g = parseFloat(fiberMatch[1]);
        }
    } catch (error) {
        console.error('Error parsing nutrition info:', error);
    }

    return nutrients;
} 