import axios from 'axios';
import { NUTRITIONIX_APP_ID, NUTRITIONIX_API_KEY } from '../utils/config';

// Check if API credentials are configured
const isConfigured = NUTRITIONIX_APP_ID && NUTRITIONIX_API_KEY;

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
 * @returns An array of food items
 */
export const searchFood = async (query: string): Promise<FoodItem[]> => {
    if (!isConfigured) {
        console.warn('Nutritionix API credentials not configured');
        return mockSearchResults(query);
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

        return combinedResults.map(item => mapToFoodItem(item)).slice(0, 20);
    } catch (error) {
        console.error('Error searching for food:', error);
        return mockSearchResults(query);
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
 * Calculate a simple healthiness rating based on macronutrients
 */
const calculateHealthinessRating = (food: NutritionixSearchResult): number => {
    // Simple algorithm that considers protein content and fiber versus sugar and saturated fat
    const proteinScore = (food.nf_protein || 0) * 0.5;
    const fiberScore = (food.nf_dietary_fiber || 0) * 0.3;
    const sugarPenalty = (food.nf_sugars || 0) * 0.2;
    const satFatPenalty = (food.nf_saturated_fat || 0) * 0.3;

    let score = 5 + proteinScore + fiberScore - sugarPenalty - satFatPenalty;

    // Clamp between 1 and 10
    return Math.max(1, Math.min(10, Math.round(score)));
};

// Mock data for when API is not configured
const mockSearchResults = (query: string): FoodItem[] => {
    const commonFoods = [
        'Apple', 'Banana', 'Chicken Breast', 'Eggs', 'Greek Yogurt',
        'Brown Rice', 'Salmon', 'Avocado', 'Spinach', 'Sweet Potato'
    ];

    // Return foods that match the query
    return commonFoods
        .filter(food => food.toLowerCase().includes(query.toLowerCase()))
        .map(food => mockFoodDetails(food));
};

const mockFoodDetails = (foodName: string): FoodItem => {
    // Sample data for common foods
    const mockData: Record<string, Partial<FoodItem>> = {
        'Apple': {
            calories: 95, proteins: 0, carbs: 25, fats: 0,
            fiber: 4, sugar: 19, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 8
        },
        'Banana': {
            calories: 105, proteins: 1, carbs: 27, fats: 0,
            fiber: 3, sugar: 14, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 7
        },
        'Chicken Breast': {
            calories: 165, proteins: 31, carbs: 0, fats: 3,
            fiber: 0, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 9
        },
        'Eggs': {
            calories: 78, proteins: 6, carbs: 1, fats: 5,
            fiber: 0, sugar: 0, serving_qty: 1, serving_unit: 'large',
            healthiness_rating: 8
        },
        'Greek Yogurt': {
            calories: 100, proteins: 17, carbs: 6, fats: 0,
            fiber: 0, sugar: 6, serving_qty: 170, serving_unit: 'g',
            healthiness_rating: 8
        },
        'Brown Rice': {
            calories: 216, proteins: 5, carbs: 45, fats: 2,
            fiber: 4, sugar: 0, serving_qty: 1, serving_unit: 'cup',
            healthiness_rating: 7
        },
        'Salmon': {
            calories: 206, proteins: 22, carbs: 0, fats: 13,
            fiber: 0, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 9
        },
        'Avocado': {
            calories: 240, proteins: 3, carbs: 12, fats: 22,
            fiber: 10, sugar: 1, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 8
        },
        'Spinach': {
            calories: 23, proteins: 3, carbs: 4, fats: 0,
            fiber: 2, sugar: 0, serving_qty: 100, serving_unit: 'g',
            healthiness_rating: 10
        },
        'Sweet Potato': {
            calories: 112, proteins: 2, carbs: 26, fats: 0,
            fiber: 4, sugar: 5, serving_qty: 1, serving_unit: 'medium',
            healthiness_rating: 9
        }
    };

    // Default values
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
        healthiness_rating: 5
    };

    // Find the food in our mock data, or use default
    const foodData = mockData[foodName] || {};
    return { ...defaultFood, ...foodData, food_name: foodName };
}; 