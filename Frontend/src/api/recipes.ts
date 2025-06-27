import { BACKEND_URL } from '../utils/config';
import axios from 'axios';
import { supabase } from '../utils/supabaseClient';

// Recipe API interface
export interface Recipe {
    id: number;
    title: string;
    image: string;
    imageType?: string;
    servings?: number;
    readyInMinutes?: number;
    sourceName?: string;
    sourceUrl?: string;
    spoonacularSourceUrl?: string;
    healthScore?: number;
    spoonacularScore?: number;
    pricePerServing?: number;
    analyzedInstructions?: any[];
    cheap?: boolean;
    creditsText?: string;
    cuisines?: string[];
    dairyFree?: boolean;
    diets?: string[];
    gaps?: string;
    glutenFree?: boolean;
    instructions?: string;
    ketogenic?: boolean;
    lowFodmap?: boolean;
    occasions?: string[];
    sustainable?: boolean;
    vegan?: boolean;
    vegetarian?: boolean;
    veryHealthy?: boolean;
    veryPopular?: boolean;
    whole30?: boolean;
    weightWatcherSmartPoints?: number;
    summary?: string;
    dishTypes?: string[];
    extendedIngredients?: any[];
    nutrition?: any;
    aggregateLikes?: number;
    ingredients?: string[];
}

// Helper function to get auth headers
const getAuthHeaders = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('User not authenticated. Please sign in again.');
        }
        return {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        };
    } catch (error: any) {
        console.error('Error getting Supabase token:', error);
        throw new Error('User not authenticated. Please sign in again.');
    }
};

// Get random recipes
export const getRandomRecipes = async (count: number = 10): Promise<Recipe[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/random`, {
            params: { count },
            headers
        });
        return response.data.recipes || [];
    } catch (error) {
        console.error('Error fetching random recipes:', error);
        throw error;
    }
};

// Search recipes
export const searchRecipes = async (query: string, number: number = 10, offset: number = 0): Promise<any> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/search`, {
            params: { query, number, offset },
            headers
        });
        return response.data;
    } catch (error) {
        console.error('Error searching recipes:', error);
        throw error;
    }
};

// Get recipe by ID
export const getRecipeById = async (id: number): Promise<Recipe> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/${id}`, { headers });
        return response.data;
    } catch (error) {
        console.error(`Error fetching recipe with ID ${id}:`, error);
        throw error;
    }
};

// Get recipe information by ID
export const getRecipeInformation = async (id: number): Promise<Recipe> => {
    return getRecipeById(id);
};

// Get similar recipes
export const getSimilarRecipes = async (id: number, number: number = 5): Promise<Recipe[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/${id}/similar`, {
            params: { number },
            headers
        });
        return response.data || [];
    } catch (error) {
        console.error(`Error fetching similar recipes for ID ${id}:`, error);
        throw error;
    }
};

// Get recipes by meal type
export const getRecipesByMealType = async (mealType: string, number: number = 10): Promise<Recipe[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/search`, {
            params: { query: mealType, number },
            headers
        });
        return response.data.results || [];
    } catch (error) {
        console.error(`Error fetching recipes for meal type ${mealType}:`, error);
        throw error;
    }
};

// Get recipes by diet
export const getRecipesByDiet = async (diet: string, number: number = 10): Promise<Recipe[]> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/search`, {
            params: { diet, number },
            headers
        });
        return response.data.results || [];
    } catch (error) {
        console.error(`Error fetching recipes for diet ${diet}:`, error);
        throw error;
    }
};

// Generate meal plan
export const generateMealPlan = async (
    timeFrame: 'day' | 'week',
    targetCalories: number,
    diet?: string,
    exclude?: string
): Promise<any> => {
    try {
        const headers = await getAuthHeaders();
        const params: any = {
            timeFrame,
            targetCalories
        };

        if (diet) params.diet = diet;
        if (exclude) params.exclude = exclude;

        const response = await axios.get(`${BACKEND_URL}/recipes/mealplan`, {
            params,
            headers
        });
        return response.data;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        throw error;
    }
};

// Get recipe nutrition information
export const getRecipeNutrition = async (id: number): Promise<any> => {
    try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BACKEND_URL}/recipes/${id}/nutritionWidget`, { headers });
        return response.data;
    } catch (error) {
        console.error(`Error fetching nutrition for recipe ${id}:`, error);
        throw error;
    }
};