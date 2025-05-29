import axios from 'axios';
import { Buffer } from 'buffer';
import {
    FATSECRET_CLIENT_ID,
    FATSECRET_CLIENT_SECRET,
    FATSECRET_BASE_URL,
    FATSECRET_TOKEN_URL,
    FATSECRET_ENABLED
} from '../utils/config';
import { FoodItem } from './nutritionix';

// Types for FatSecret API responses
export interface FatSecretFood {
    food_id: string;
    food_name: string;
    food_type: string;
    food_url: string;
    brand_name?: string;
    servings: {
        serving: FatSecretServing | FatSecretServing[];
    };
}

export interface FatSecretServing {
    serving_id: string;
    serving_description: string;
    metric_serving_amount: string;
    metric_serving_unit: string;
    calories: string;
    carbohydrate: string;
    protein: string;
    fat: string;
    saturated_fat?: string;
    polyunsaturated_fat?: string;
    monounsaturated_fat?: string;
    trans_fat?: string;
    cholesterol?: string;
    sodium?: string;
    potassium?: string;
    fiber?: string;
    sugar?: string;
    vitamin_a?: string;
    vitamin_c?: string;
    calcium?: string;
    iron?: string;
}

// OAuth2 token storage
interface AccessToken {
    token: string;
    expires_at: number;
}

let cachedToken: AccessToken | null = null;

/**
 * Get OAuth2 access token for FatSecret API
 */
async function getAccessToken(): Promise<string> {
    // Check if we have credentials
    if (!FATSECRET_CLIENT_ID || !FATSECRET_CLIENT_SECRET || FATSECRET_CLIENT_ID.includes('YOUR_FATSECRET')) {
        throw new Error('FatSecret API credentials not configured');
    }

    // Check if we have a valid cached token
    if (cachedToken && cachedToken.expires_at > Date.now()) {
        return cachedToken.token;
    }

    try {
        // Use React Native's built-in btoa or Buffer fallback
        let credentials: string;
        if (typeof btoa !== 'undefined') {
            credentials = btoa(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`);
        } else {
            // Fallback for older React Native versions
            const base64Credentials = Buffer.from(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`, 'utf8').toString('base64');
            credentials = base64Credentials;
        }

        const response = await axios.post(
            FATSECRET_TOKEN_URL,
            'grant_type=client_credentials&scope=basic barcode',
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, expires_in } = response.data;

        // Cache the token with expiration time (minus 5 minutes for safety)
        cachedToken = {
            token: access_token,
            expires_at: Date.now() + ((expires_in - 300) * 1000)
        };

        return access_token;
    } catch (error) {
        console.error('Error getting FatSecret access token:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw new Error('Failed to authenticate with FatSecret API');
    }
}

/**
 * Convert barcode to GTIN-13 format (13 digits with leading zeros)
 */
function formatBarcode(barcode: string): string {
    // Remove any non-digit characters
    const cleanBarcode = barcode.replace(/\D/g, '');

    // Pad with leading zeros to make it 13 digits
    return cleanBarcode.padStart(13, '0');
}

/**
 * Find food ID by barcode using FatSecret API
 */
async function findFoodIdByBarcode(barcode: string): Promise<string | null> {
    try {
        const token = await getAccessToken();

        // Convert to GTIN-13 format (13 digits)
        const formattedBarcode = formatBarcode(barcode);

        const response = await axios.get(
            `${FATSECRET_BASE_URL}/food/barcode/find-by-id/v1`,
            {
                params: {
                    barcode: formattedBarcode,
                    format: 'json'
                },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('FatSecret barcode response:', response.data);

        // Check if we got a valid food_id
        if (response.data && response.data.food_id && response.data.food_id.value && response.data.food_id.value !== '0') {
            return response.data.food_id.value;
        }

        return null;
    } catch (error) {
        console.error('Error finding food ID by barcode:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return null;
    }
}

/**
 * Get food details by food ID using FatSecret API
 */
async function getFoodById(foodId: string): Promise<FatSecretFood | null> {
    try {
        const token = await getAccessToken();

        const response = await axios.get(
            `${FATSECRET_BASE_URL}/food/v4`,
            {
                params: {
                    food_id: foodId,
                    format: 'json'
                },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('FatSecret food details response:', response.data);

        if (response.data && response.data.food) {
            return response.data.food;
        }

        return null;
    } catch (error) {
        console.error('Error getting food details:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return null;
    }
}

/**
 * Convert FatSecret food data to standardized format
 */
function convertFatSecretToFoodData(fatSecretFood: FatSecretFood): FoodItem | null {
    if (!fatSecretFood.servings) {
        return null;
    }

    // Get the first serving (or default serving if available)
    let serving: FatSecretServing;
    if (Array.isArray(fatSecretFood.servings.serving)) {
        // Find default serving or use first one
        serving = fatSecretFood.servings.serving.find(s => (s as any).is_default === '1')
            || fatSecretFood.servings.serving[0];
    } else {
        serving = fatSecretFood.servings.serving;
    }

    if (!serving) {
        return null;
    }

    // Helper function to safely parse numbers
    const safeParseFloat = (value: string | undefined): number => {
        return value ? Number(value) : 0;
    };

    return {
        food_name: fatSecretFood.food_name,
        brand_name: fatSecretFood.brand_name,
        calories: safeParseFloat(serving.calories),
        proteins: safeParseFloat(serving.protein),
        carbs: safeParseFloat(serving.carbohydrate),
        fats: safeParseFloat(serving.fat),
        fiber: safeParseFloat(serving.fiber),
        sugar: safeParseFloat(serving.sugar),
        saturated_fat: safeParseFloat(serving.saturated_fat),
        polyunsaturated_fat: safeParseFloat(serving.polyunsaturated_fat),
        monounsaturated_fat: safeParseFloat(serving.monounsaturated_fat),
        trans_fat: safeParseFloat(serving.trans_fat),
        cholesterol: safeParseFloat(serving.cholesterol),
        sodium: safeParseFloat(serving.sodium),
        potassium: safeParseFloat(serving.potassium),
        vitamin_a: safeParseFloat(serving.vitamin_a),
        vitamin_c: safeParseFloat(serving.vitamin_c),
        calcium: safeParseFloat(serving.calcium),
        iron: safeParseFloat(serving.iron),
        image: '', // FatSecret doesn't provide images in barcode lookup
        serving_unit: serving.serving_description || 'serving',
        serving_weight_grams: safeParseFloat(serving.metric_serving_amount),
        serving_qty: 1, // Default to 1 serving
        healthiness_rating: 5 // Default rating, could be calculated based on nutritional values
    };
}

/**
 * Main function to fetch food data by barcode
 */
export async function fetchFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    try {
        console.log(`Looking up barcode: ${barcode}`);

        // Step 1: Find food ID by barcode
        const foodId = await findFoodIdByBarcode(barcode);
        if (!foodId) {
            console.log('Food ID not found for barcode');
            return null;
        }

        console.log(`Found food ID: ${foodId}`);

        // Step 2: Get food details by ID
        const fatSecretFood = await getFoodById(foodId);
        if (!fatSecretFood) {
            console.log('Food details not found');
            return null;
        }

        // Step 3: Convert to standardized format
        const foodData = convertFatSecretToFoodData(fatSecretFood);
        if (!foodData) {
            console.log('Failed to convert food data');
            return null;
        }

        console.log('Successfully retrieved food data:', foodData.food_name);
        return foodData;

    } catch (error) {
        console.error('Error in fetchFoodByBarcode:', error);
        return null;
    }
}

/**
 * Search foods by name (optional feature)
 */
export async function searchFoods(searchExpression: string, maxResults: number = 20): Promise<any[]> {
    if (!FATSECRET_ENABLED) {
        console.warn('FatSecret API is disabled');
        return [];
    }

    try {
        const accessToken = await getAccessToken();

        const response = await axios.get(
            `${FATSECRET_BASE_URL}/foods/search/v1`,
            {
                params: {
                    search_expression: searchExpression,
                    max_results: maxResults,
                    format: 'json'
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data && response.data.foods && response.data.foods.food) {
            const foods = Array.isArray(response.data.foods.food)
                ? response.data.foods.food
                : [response.data.foods.food];
            return foods;
        }

        return [];
    } catch (error) {
        console.error('Error searching foods:', error);
        return [];
    }
}

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
        const response = await axios.get(`${FATSECRET_BASE_URL}/foods/search/v1`, {
            params: {
                search_expression: query,
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
        const response = await axios.get(`${FATSECRET_BASE_URL}/food/v4`, {
            params: {
                food_id: foodId,
                format: 'json'
            },
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

/**
 * Test function to verify FatSecret API is working
 * Can be called from browser console: window.testFatSecretAPI()
 */
export async function testFatSecretAPI(testBarcode: string = '049000028904') {
    console.log('🧪 Testing FatSecret API...');
    console.log('📊 Using test barcode:', testBarcode);

    try {
        // Test authentication
        console.log('🔐 Testing authentication...');
        const token = await getAccessToken();
        console.log('✅ Authentication successful');

        // Test barcode lookup
        console.log('🔍 Testing barcode lookup...');
        const foodId = await findFoodIdByBarcode(testBarcode);

        if (foodId) {
            console.log('✅ Barcode lookup successful, Food ID:', foodId);

            // Test food details
            console.log('📋 Testing food details...');
            const foodDetails = await getFoodById(foodId);

            if (foodDetails) {
                console.log('✅ Food details retrieved successfully');
                console.log('🍕 Food name:', foodDetails.food_name);
                console.log('🏪 Brand:', foodDetails.brand_name);

                // Test conversion to FoodItem
                console.log('🔄 Testing format conversion...');
                const foodItem = convertFatSecretToFoodData(foodDetails);

                if (foodItem) {
                    console.log('✅ Format conversion successful');
                    console.log('📊 Converted food item:', foodItem);
                    console.log('🎉 FatSecret API test completed successfully!');
                    return foodItem;
                } else {
                    console.error('❌ Format conversion failed');
                }
            } else {
                console.error('❌ Food details retrieval failed');
            }
        } else {
            console.warn('⚠️ Barcode not found in database');
        }
    } catch (error) {
        console.error('❌ FatSecret API test failed:', error);
    }

    return null;
}

// Make it globally available for testing
if (typeof window !== 'undefined') {
    (window as any).testFatSecretAPI = testFatSecretAPI;
} 