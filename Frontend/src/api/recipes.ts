import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { auth } from '../utils/firebase/index';

// Types for Recipe Data
export interface Recipe {
    id: string;
    title: string;
    image: string;
    readyInMinutes: number;
    servings: number;
    sourceUrl: string;
    summary: string;
    healthScore: number;
    ingredients: string[];
    instructions: string;
    diets: string[];
    cuisines: string[];
    aggregateLikes?: number;
}

export interface RecipeSearchParams {
    query?: string;
    cuisine?: string;
    diet?: string;
    intolerances?: string;
    includeIngredients?: string[];
    maxReadyTime?: number;
    sort?: string;
    sortDirection?: string;
    offset?: number;
    number?: number;
}

// Food Recipe Categories
export const foodCategories = [
    { id: 'breakfast', name: 'Breakfast', icon: 'sunny-outline' },
    { id: 'lunch', name: 'Lunch', icon: 'fast-food-outline' },
    { id: 'dinner', name: 'Dinner', icon: 'restaurant-outline' },
    { id: 'italian', name: 'Italian', icon: 'pizza-outline' },
    { id: 'american', name: 'American', icon: 'flag-outline' },
    { id: 'quick', name: 'Quick & Easy', icon: 'timer-outline' },
    { id: 'snack', name: 'Snacks', icon: 'cafe-outline' },
    { id: 'healthy', name: 'Healthy', icon: 'fitness-outline' },
    { id: 'vegetarian', name: 'Vegetarian', icon: 'leaf-outline' },
];

// Food Cuisine Categories
export const cuisineCategories = [
    { id: 'italian', name: 'Italian' },
    { id: 'mexican', name: 'Mexican' },
    { id: 'asian', name: 'Asian' },
    { id: 'american', name: 'American' },
    { id: 'mediterranean', name: 'Mediterranean' },
    { id: 'indian', name: 'Indian' },
    { id: 'french', name: 'French' },
    { id: 'thai', name: 'Thai' },
    { id: 'greek', name: 'Greek' },
    { id: 'chinese', name: 'Chinese' },
];

// Backend API base URL
const BACKEND_BASE_URL = BACKEND_URL;

/**
 * Get authorization headers for backend API calls
 */
const getAuthHeaders = async () => {
    try {
        console.log('Getting auth headers...');
        const user = auth.currentUser;
        console.log('Current user:', user ? 'Authenticated' : 'Not authenticated');

        if (user) {
            console.log('User UID:', user.uid);
            console.log('User email:', user.email);

            try {
                const token = await user.getIdToken(true);
                // Token logging removed for production security
                return {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                };
            } catch (tokenError) {
                console.error('Error getting Firebase token:', tokenError);
                throw tokenError;
            }
        } else {
            console.warn('No authenticated user found');
        }
    } catch (error) {
        console.error('Error getting auth token:', error);
    }
    return {
        'Content-Type': 'application/json'
    };
};

// Function to search for recipes by query
export const searchRecipes = async (params: RecipeSearchParams): Promise<Recipe[]> => {
    try {
        console.log('Searching recipes with params:', params);
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/recipes/search`,
            params,
            { headers }
        );

        // Extract results from the wrapped response format
        const data = response.data;
        if (data && data.results && Array.isArray(data.results)) {
            console.log(`Found ${data.results.length} recipes for query: ${params.query}`);
            return data.results;
        } else {
            console.log(`No recipes found in response:`, data);
            return [];
        }
    } catch (error) {
        console.error('Error searching recipes:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};

// Function to get recipe details by ID
export const getRecipeById = async (id: string): Promise<Recipe | null> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.get(
            `${BACKEND_BASE_URL}/recipes/${id}`,
            { headers }
        );

        return response.data || null;
    } catch (error) {
        console.error('Error getting recipe details:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            } else if (error.response?.status === 404) {
                console.log('Recipe not found');
            }
        }
        return null;
    }
};

// Function to get random recipes
export const getRandomRecipes = async (count: number = 5): Promise<Recipe[]> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.get(
            `${BACKEND_BASE_URL}/recipes/random?count=${count}`,
            { headers }
        );

        // Extract recipes from the wrapped response format
        const data = response.data;
        if (data && data.recipes && Array.isArray(data.recipes)) {
            console.log(`Found ${data.recipes.length} random recipes`);
            return data.recipes;
        } else {
            console.log(`No recipes found in response:`, data);
            return [];
        }
    } catch (error) {
        console.error('Error getting random recipes:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};

// Function to get recipes by meal type
export const getRecipesByMealType = async (mealType: string, count: number = 3): Promise<Recipe[]> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/recipes/by-meal-type`,
            {
                meal_type: mealType,
                count: count
            },
            { headers }
        );

        // Handle direct array response (backend returns array directly for this endpoint)
        const data = response.data;
        if (Array.isArray(data)) {
            console.log(`Found ${data.length} recipes for meal type: ${mealType}`);
            return data;
        } else {
            console.log(`No recipes found for meal type ${mealType}:`, data);
            return [];
        }
    } catch (error) {
        console.error('Error getting recipes by meal type:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};

// Generate a meal plan using backend API
export const generateMealPlan = async (params: {
    timeFrame?: 'day' | 'week',
    targetCalories?: number,
    diet?: string,
    exclude?: string[],
    type?: string,
    cuisine?: string,
    maxReadyTime?: number,
    minProtein?: number,
    maxCarbs?: number
}): Promise<any> => {
    try {
        const headers = await getAuthHeaders();

        const response = await axios.post(
            `${BACKEND_BASE_URL}/recipes/meal-plan`,
            params,
            { headers }
        );

        return response.data || {
            meals: [],
            nutrients: {
                calories: 0,
                protein: 0,
                fat: 0,
                carbohydrates: 0
            }
        };
    } catch (error) {
        console.error('Error generating meal plan:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return {
            meals: [],
            nutrients: {
                calories: 0,
                protein: 0,
                fat: 0,
                carbohydrates: 0
            }
        };
    }
};

// Helper function to shuffle array (kept for compatibility)
const shuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Function to autocomplete recipe search
export const autocompleteRecipes = async (query: string): Promise<{ id: number; title: string }[]> => {
    if (!query.trim()) {
        return [];
    }

    try {
        const headers = await getAuthHeaders();

        const response = await axios.get(
            `${BACKEND_BASE_URL}/recipes/autocomplete?query=${encodeURIComponent(query.trim())}`,
            { headers }
        );

        return response.data || [];
    } catch (error) {
        console.error('Error getting recipe autocomplete:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};

// Function to autocomplete ingredient search
export const autocompleteIngredients = async (query: string): Promise<{ id: number; name: string }[]> => {
    if (!query.trim()) {
        return [];
    }

    try {
        const headers = await getAuthHeaders();

        const response = await axios.get(
            `${BACKEND_BASE_URL}/recipes/ingredients/autocomplete?query=${encodeURIComponent(query.trim())}`,
            { headers }
        );

        return response.data || [];
    } catch (error) {
        console.error('Error getting ingredient autocomplete:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.error('Authentication failed - please log in again');
            }
        }
        return [];
    }
};