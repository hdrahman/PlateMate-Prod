import axios from 'axios';
import { NUTRITIONIX_APP_ID, NUTRITIONIX_API_KEY, SPOONACULAR_API_KEY } from '../utils/config';

// Check if API credentials are configured
const isConfigured = NUTRITIONIX_APP_ID && NUTRITIONIX_API_KEY;
const isSpoonacularConfigured = !!SPOONACULAR_API_KEY;

// Spoonacular API base URL
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

// Types
export interface NutritionixSearchResult {
    food_name: string;
    brand_name?: string;
    serving_qty: number;
    serving_unit: string;
    serving_weight_grams: number;
    nf_calories: number;
    nf_total_fat: number;
    nf_saturated_fat: number;
    nf_cholesterol: number;
    nf_sodium: number;
    nf_total_carbohydrate: number;
    nf_dietary_fiber: number;
    nf_sugars: number;
    nf_protein: number;
    nf_potassium: number;
    photo: {
        thumb: string;
        highres: string;
    };
    full_nutrients?: Array<{
        attr_id: number;
        value: number;
    }>;
}

export interface NutritionixResponse {
    branded: NutritionixSearchResult[];
    common: NutritionixSearchResult[];
}

export interface FoodItem {
    food_name: string;
    brand_name?: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    saturated_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitamin_a: number;
    vitamin_c: number;
    calcium: number;
    iron: number;
    image: string;
    serving_unit: string;
    serving_weight_grams: number;
    serving_qty: number;
    healthiness_rating?: number;
    notes?: string;
}

/**
 * Search for foods using the Nutritionix API
 * @param query - The search query
 * @param minHealthiness - Minimum healthiness rating to include (1-10)
 * @returns An array of food items
 */
export const searchFood = async (query: string, minHealthiness: number = 0): Promise<FoodItem[]> => {
    if (!isConfigured) {
        console.warn('Nutritionix API credentials not configured');
        return mockSearchResults(query, minHealthiness);
    }

    try {
        const response = await axios.get<NutritionixResponse>(
            'https://trackapi.nutritionix.com/v2/search/instant',
            {
                params: { query },
                headers: {
                    'x-app-id': NUTRITIONIX_APP_ID,
                    'x-app-key': NUTRITIONIX_API_KEY,
                },
            }
        );

        const combinedResults = [
            ...response.data.common,
            ...response.data.branded
        ];

        // Map to FoodItem and calculate healthiness rating
        const foodItems = combinedResults.map(item => mapToFoodItem(item));

        // Filter by minimum healthiness if specified
        const filteredResults = minHealthiness > 0
            ? foodItems.filter(item => (item.healthiness_rating || 0) >= minHealthiness)
            : foodItems;

        // Sort by healthiness rating (highest first)
        const sortedResults = filteredResults.sort((a, b) =>
            (b.healthiness_rating || 0) - (a.healthiness_rating || 0)
        );

        return sortedResults.slice(0, 20);
    } catch (error) {
        console.error('Error searching for food:', error);
        return mockSearchResults(query, minHealthiness);
    }
};

/**
 * Get detailed nutrition information for a food
 * @param query - The food name
 * @returns Detailed nutrition information
 */
export const getFoodDetails = async (query: string): Promise<FoodItem | null> => {
    if (!isConfigured) {
        console.warn('Nutritionix API credentials not configured');
        return mockFoodDetails(query);
    }

    try {
        const response = await axios.post(
            'https://trackapi.nutritionix.com/v2/natural/nutrients',
            { query },
            {
                headers: {
                    'x-app-id': NUTRITIONIX_APP_ID,
                    'x-app-key': NUTRITIONIX_API_KEY,
                    'Content-Type': 'application/json'
                },
            }
        );

        if (response.data.foods && response.data.foods.length > 0) {
            return mapToFoodItem(response.data.foods[0]);
        }
        return null;
    } catch (error) {
        console.error('Error getting food details:', error);
        return mockFoodDetails(query);
    }
};

/**
 * Map Nutritionix API response to our FoodItem format
 */
const mapToFoodItem = (food: NutritionixSearchResult): FoodItem => {
    return {
        food_name: food.food_name,
        brand_name: food.brand_name,
        calories: Math.round(food.nf_calories || 0),
        proteins: Math.round(food.nf_protein || 0),
        carbs: Math.round(food.nf_total_carbohydrate || 0),
        fats: Math.round(food.nf_total_fat || 0),
        fiber: Math.round(food.nf_dietary_fiber || 0),
        sugar: Math.round(food.nf_sugars || 0),
        saturated_fat: Math.round(food.nf_saturated_fat || 0),
        polyunsaturated_fat: Math.round(getNutrientValue(food, 646) || 0),
        monounsaturated_fat: Math.round(getNutrientValue(food, 645) || 0),
        trans_fat: Math.round(getNutrientValue(food, 605) || 0),
        cholesterol: Math.round(food.nf_cholesterol || 0),
        sodium: Math.round(food.nf_sodium || 0),
        potassium: Math.round(food.nf_potassium || getNutrientValue(food, 306) || 0),
        vitamin_a: Math.round(getNutrientValue(food, 320) || 0),
        vitamin_c: Math.round(getNutrientValue(food, 401) || 0),
        calcium: Math.round(getNutrientValue(food, 301) || 0),
        iron: Math.round(getNutrientValue(food, 303) || 0),
        image: food.photo?.thumb || '',
        serving_unit: food.serving_unit || 'serving',
        serving_weight_grams: food.serving_weight_grams || 0,
        serving_qty: food.serving_qty || 1,
        healthiness_rating: calculateHealthinessRating(food)
    };
};

/**
 * Get a specific nutrient value from the full_nutrients array
 */
const getNutrientValue = (food: NutritionixSearchResult, attr_id: number): number => {
    if (!food.full_nutrients) return 0;
    const nutrient = food.full_nutrients.find(n => n.attr_id === attr_id);
    return nutrient ? nutrient.value : 0;
};

/**
 * Calculate a more comprehensive healthiness rating based on nutritional content
 * Uses a stricter scale where only truly healthy foods score above 8.5
 */
const calculateHealthinessRating = (food: NutritionixSearchResult): number => {
    // Extract nutrient values with defaults
    const calories = food.nf_calories || 0;
    const protein = food.nf_protein || 0;
    const carbs = food.nf_total_carbohydrate || 0;
    const fat = food.nf_total_fat || 0;
    const fiber = food.nf_dietary_fiber || 0;
    const sugar = food.nf_sugars || 0;
    const saturatedFat = food.nf_saturated_fat || 0;
    const cholesterol = food.nf_cholesterol || 0;
    const sodium = food.nf_sodium || 0;

    // Start with a lower base score so only truly healthy foods get high ratings
    let score = 4;  // Start lower than neutral

    // Protein is generally good (up to a point)
    if (protein > 0) {
        // Protein quality score: higher is better
        const proteinQuality = protein / calories * 400;  // Scaled to ~0-4 range
        score += Math.min(2, proteinQuality);
    }

    // Fiber is good
    if (fiber > 0) {
        // Fiber quality score: higher is better
        const fiberQuality = fiber / calories * 400;  // Scaled to ~0-2 range
        score += Math.min(1.5, fiberQuality);
    }

    // Micronutrient estimation (limited data, but approximating)
    const hasFullNutrients = !!food.full_nutrients?.length;
    if (hasFullNutrients) {
        score += 0.5;  // Bonus for foods with detailed nutrition data
    }

    // Penalties - more aggressive penalties to ensure only truly healthy foods score highly

    // Sugar penalty (worse at higher percentages of total carbs)
    if (sugar > 0 && carbs > 0) {
        const sugarRatio = sugar / carbs;
        score -= sugarRatio * 3;  // Up to -3 points for pure sugar (increased penalty)
    } else if (sugar > 10) {
        score -= 1.5; // Penalty for high sugar regardless of carb ratio
    }

    // Saturated fat penalty (worse at higher amounts)
    if (saturatedFat > 0) {
        const satFatRatio = saturatedFat / fat;
        score -= satFatRatio * 2;  // Up to -2 points (increased penalty)
    }

    // Calorie density penalty - more aggressive
    if (calories > 250) {
        score -= Math.min(1.5, (calories - 250) / 500);  // Up to -1.5 points (lowered threshold)
    }

    // Sodium penalty - more aggressive
    if (sodium > 400) {
        score -= Math.min(1.5, (sodium - 400) / 1000);  // Up to -1.5 points (lowered threshold)
    }

    // Cholesterol penalty
    if (cholesterol > 50) {
        score -= Math.min(1, (cholesterol - 50) / 150);  // Up to -1 point
    }

    // Adjustments for food types
    const foodName = food.food_name.toLowerCase();

    // Stronger boost for whole foods
    if (/vegetable|fruit|legume|bean|lentil|seed|whole grain|fish|salmon|tuna|cod|organic|lean protein/.test(foodName)) {
        score += 2; // Increased boost
    }

    // Additional boost for superfoods
    if (/spinach|kale|blueberry|quinoa|avocado|broccoli|sweet potato|salmon|chia|flax/.test(foodName)) {
        score += 1;
    }

    // Stronger penalty for processed foods
    if (/processed|fried|candy|cake|soda|chip|cookie|pizza|burger|sweet|dessert|pastry|white bread|snack|fast food/.test(foodName)) {
        score -= 2; // Increased penalty
    }

    // Clamp between 1 and 10
    return Math.max(1, Math.min(10, Math.round(score)));
};

// Mock data for when API is not configured
const mockSearchResults = (query: string, minHealthiness: number = 0): FoodItem[] => {
    const commonFoods = [
        'Apple', 'Banana', 'Chicken Breast', 'Eggs', 'Greek Yogurt',
        'Brown Rice', 'Salmon', 'Avocado', 'Spinach', 'Sweet Potato'
    ];

    // Return foods that match the query
    return commonFoods
        .filter(food => food.toLowerCase().includes(query.toLowerCase()))
        .map(food => mockFoodDetails(food))
        .filter(food => minHealthiness === 0 || (food.healthiness_rating || 0) >= minHealthiness)
        .sort((a, b) => (b.healthiness_rating || 0) - (a.healthiness_rating || 0));
};

const mockFoodDetails = (foodName: string): FoodItem => {
    // Sample data for common foods with updated healthiness ratings
    const mockData: Record<string, Partial<FoodItem>> = {
        'Apple': {
            calories: 95, proteins: 0, carbs: 25, fats: 0,
            fiber: 4, sugar: 19, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 8.5 // Updated rating
        },
        'Banana': {
            calories: 105, proteins: 1, carbs: 27, fats: 0,
            fiber: 3, sugar: 14, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 7.5 // Updated rating 
        },
        'Chicken Breast': {
            calories: 165, proteins: 31, carbs: 0, fats: 3,
            fiber: 0, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 9 // High protein, low fat
        },
        'Eggs': {
            calories: 78, proteins: 6, carbs: 1, fats: 5,
            fiber: 0, sugar: 0, serving_qty: 1, serving_unit: 'large',
            healthiness_rating: 8 // Updated rating
        },
        'Greek Yogurt': {
            calories: 100, proteins: 17, carbs: 6, fats: 0,
            fiber: 0, sugar: 6, serving_qty: 170, serving_unit: 'g',
            healthiness_rating: 8.5 // High protein, moderate sugar
        },
        'Brown Rice': {
            calories: 216, proteins: 5, carbs: 45, fats: 2,
            fiber: 4, sugar: 0, serving_qty: 1, serving_unit: 'cup',
            healthiness_rating: 8 // Whole grain, good fiber
        },
        'Salmon': {
            calories: 206, proteins: 22, carbs: 0, fats: 13,
            fiber: 0, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 9.5 // Superfood with omega-3
        },
        'Avocado': {
            calories: 240, proteins: 3, carbs: 12, fats: 22,
            fiber: 10, sugar: 1, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 9 // High healthy fats and fiber
        },
        'Spinach': {
            calories: 23, proteins: 3, carbs: 4, fats: 0,
            fiber: 2, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 10 // Perfect superfood
        },
        'Sweet Potato': {
            calories: 112, proteins: 2, carbs: 26, fats: 0,
            fiber: 4, sugar: 5, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 9 // Superfood with good nutrients
        },
        'Kale': {
            calories: 33, proteins: 3, carbs: 6, fats: 0,
            fiber: 2, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 10 // Perfect superfood
        },
        'Blueberries': {
            calories: 84, proteins: 1, carbs: 21, fats: 0,
            fiber: 4, sugar: 15, serving_qty: 1, serving_unit: 'cup',
            healthiness_rating: 9 // Antioxidant-rich superfood
        },
        'Quinoa': {
            calories: 222, proteins: 8, carbs: 39, fats: 4,
            fiber: 5, sugar: 0, serving_qty: 1, serving_unit: 'cup',
            healthiness_rating: 9 // Complete protein grain
        },
        'Broccoli': {
            calories: 55, proteins: 4, carbs: 11, fats: 0,
            fiber: 5, sugar: 2, serving_qty: 1, serving_unit: 'cup',
            healthiness_rating: 10 // Perfect cruciferous vegetable
        }
    };

    // Default values with lower healthiness rating
    const defaultFood: FoodItem = {
        food_name: foodName,
        calories: 100,
        proteins: 5,
        carbs: 15,
        fats: 3,
        fiber: 2,
        sugar: 5,
        saturated_fat: 1,
        polyunsaturated_fat: 0,
        monounsaturated_fat: 0,
        trans_fat: 0,
        cholesterol: 0,
        sodium: 50,
        potassium: 100,
        vitamin_a: 0,
        vitamin_c: 0,
        calcium: 0,
        iron: 0,
        image: '',
        serving_unit: 'serving',
        serving_weight_grams: 100,
        serving_qty: 1,
        healthiness_rating: 4 // Default rating lowered to reflect stricter scale
    };

    // Find the food in our mock data, or use default
    const foodData = mockData[foodName] || {};
    return { ...defaultFood, ...foodData, food_name: foodName };
};

/**
 * Enhance a food item with a better image from Spoonacular if available
 * @param foodItem - The food item to enhance
 * @returns The food item with an enhanced image if available
 */
export const enhanceFoodImage = async (foodItem: FoodItem): Promise<FoodItem> => {
    if (!isSpoonacularConfigured || !foodItem.food_name) {
        return foodItem;
    }

    try {
        const response = await axios.get(`${SPOONACULAR_BASE_URL}/food/ingredients/search`, {
            params: {
                query: foodItem.food_name,
                number: 1,
                apiKey: SPOONACULAR_API_KEY
            }
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
            const ingredientId = response.data.results[0].id;
            const imageUrl = `${SPOONACULAR_BASE_URL}/cdn/ingredients_250x250/${ingredientId}.jpg`;

            // Only update if we actually get a valid image URL
            return {
                ...foodItem,
                image: imageUrl
            };
        }

        return foodItem;
    } catch (error) {
        console.error('Error enhancing food image:', error);
        return foodItem;
    }
}; 