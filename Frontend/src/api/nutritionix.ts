import { BACKEND_URL } from '../utils/config';
import axios from 'axios';
import { supabase } from '../utils/supabaseClient';

// Backend API base URL
const BACKEND_BASE_URL = BACKEND_URL;

/**
 * Get authorization headers for backend API calls
 */
const getAuthHeaders = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('User not authenticated');
        }

        return {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        };
    } catch (error) {
        console.error('Error getting auth headers:', error);
        throw error;
    }
};

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

export interface Serving {
    serving_id?: string;
    serving_description: string;
    number_of_units?: number;
    measurement_description?: string;
    metric_serving_amount: number;
    metric_serving_unit: string;
    is_default?: boolean;
    calories: number;
    protein: number;
    carbohydrate: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    saturated_fat?: number;
    polyunsaturated_fat?: number;
    monounsaturated_fat?: number;
    trans_fat?: number;
    cholesterol?: number;
    sodium?: number;
    potassium?: number;
    vitamin_a?: number;
    vitamin_c?: number;
    calcium?: number;
    iron?: number;
    vitamin_d?: number;
    added_sugars?: number;
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
    all_servings?: Serving[];  // Array of all available servings from API
}

/**
 * Create an empty food item with all values set to zero
 */
export const createEmptyFoodItem = (foodName: string = ''): FoodItem => {
    return {
        food_name: foodName,
        calories: 0,
        proteins: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        sugar: 0,
        saturated_fat: 0,
        polyunsaturated_fat: 0,
        monounsaturated_fat: 0,
        trans_fat: 0,
        cholesterol: 0,
        sodium: 0,
        potassium: 0,
        vitamin_a: 0,
        vitamin_c: 0,
        calcium: 0,
        iron: 0,
        image: '',
        serving_unit: 'serving',
        serving_weight_grams: 0,
        serving_qty: 1,
        healthiness_rating: 0
    };
};

/**
 * Search for foods using the backend API
 * @param query - The search query
 * @param minHealthiness - Minimum healthiness rating to include (1-10)
 * @returns An array of food items
 */
export const searchFood = async (query: string, minHealthiness: number = 0): Promise<FoodItem[]> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/food/search`,
            {
                query: query,
                min_healthiness: minHealthiness
            },
            { headers }
        );

        // Extract results from the wrapped response format
        const data = response.data;
        if (data && data.results && Array.isArray(data.results)) {
            console.log(`Found ${data.results.length} food items for query: ${query}`);
            return data.results;
        } else {
            console.log(`No results found in response:`, data);
            return [];
        }
    } catch (error) {
        console.error('Error searching for food:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};

/**
 * Get detailed nutrition information for a food using the backend API
 * @param query - The food name
 * @returns Detailed nutrition information
 */
export const getFoodDetails = async (query: string): Promise<FoodItem | null> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/food/details`,
            {
                food_name: query
            },
            { headers }
        );

        return response.data || null;
    } catch (error) {
        console.error('Error getting food details:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            } else if (error.response?.status === 404) {
                console.log('Food not found');
            }
        }
        return null;
    }
};

/**
 * Enhance a food item with a better image from Spoonacular if available
 * Note: Spoonacular API calls moved to backend for security
 * @param foodItem - The food item to enhance
 * @returns The food item unchanged (image enhancement disabled for security)
 */
export const enhanceFoodImage = async (foodItem: FoodItem): Promise<FoodItem> => {
    // Spoonacular API calls moved to backend for security
    // Image enhancement is disabled in frontend
    return foodItem;
};

/**
 * Search for food by barcode using the backend API
 * @param barcode - The UPC/barcode to search for
 * @returns Food item if found, null otherwise
 */
export const fetchFoodByBarcode = async (barcode: string): Promise<FoodItem | null> => {
    try {
        // Clean the barcode
        const cleanBarcode = barcode.replace(/\D/g, '');
        console.log('Searching for barcode:', cleanBarcode);

        // Get authentication headers
        const headers = await getAuthHeaders();
        console.log('Using headers:', Object.keys(headers));

        // Try POST method first for more reliable handling
        try {
            console.log(`Attempting POST request to ${BACKEND_BASE_URL}/food/barcode`);

            const response = await axios.post(
                `${BACKEND_BASE_URL}/food/barcode`,
                {
                    barcode: cleanBarcode
                },
                { headers }
            );

            console.log('Backend barcode POST response success:', response.status);

            // Extract the food data from the response structure
            if (response.data && response.data.success && response.data.food) {
                return response.data.food;
            }

            return response.data;

        } catch (postError) {
            console.log('POST request failed, falling back to GET endpoint');

            // Check if this is an IP whitelist error
            if (axios.isAxiosError(postError) && postError.response?.status === 403) {
                const errorMsg = postError.response?.data?.detail || '';
                if (errorMsg.includes('not whitelisted in FatSecret API')) {
                    console.error('FatSecret API IP whitelist error:', errorMsg);
                    throw new Error(`IP whitelist error: ${errorMsg}`);
                }
            }

            // Fall back to GET method if POST fails
            const response = await axios.get(
                `${BACKEND_BASE_URL}/food/barcode/${cleanBarcode}`,
                { headers }
            );

            console.log('Backend barcode GET response status:', response.status);

            // Extract the food data from the response structure
            if (response.data && response.data.success && response.data.food) {
                return response.data.food;
            }

            return response.data;
        }
    } catch (error) {
        console.error('Error searching for barcode:', error);

        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                // Special handling for IP whitelist errors
                const errorMsg = error.response?.data?.detail || '';
                if (errorMsg.includes('not whitelisted in FatSecret API')) {
                    console.error('FatSecret API IP whitelist error. Contact administrator to whitelist server IP.');
                    throw new Error('The server\'s IP address is not whitelisted in FatSecret API. Please contact your administrator to add the server\'s IP to the FatSecret whitelist.');
                } else {
                    console.error('Authentication failed - please log in again');
                }
            } else if (error.response?.status === 404) {
                console.log('Barcode not found in database');
            } else if (error.response?.status === 500) {
                console.error('Server error:', error.response?.data);
            } else if (error.code === 'ECONNABORTED') {
                console.error('Request timeout - network may be slow');
            } else if (!error.response) {
                console.error('Network error - please check your connection');
            }
        }
        throw error;  // Rethrow so caller can handle
    }
}; 