import { BACKEND_URL } from '../utils/config';
import apiService from '../utils/apiService';
import { ServiceTokenType } from '../utils/tokenManager';

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

// Get random recipes - NOW WITH AUTOMATIC CACHING
export const getRandomRecipes = async (count: number = 10): Promise<Recipe[]> => {
    try {
        const response = await apiService.get('/recipes/random', { count }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response.recipes || [];
    } catch (error) {
        console.error('Error fetching random recipes:', error);
        throw error;
    }
};

// Search recipes - NOW WITH AUTOMATIC CACHING
export const searchRecipes = async (query: string, number: number = 10, offset: number = 0): Promise<any> => {
    try {
        const response = await apiService.get('/recipes/search', { query, number, offset }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response;
    } catch (error) {
        console.error('Error searching recipes:', error);
        throw error;
    }
};

// Get recipe by ID - NOW WITH AUTOMATIC CACHING
export const getRecipeById = async (id: number): Promise<Recipe> => {
    try {
        const response = await apiService.get(`/recipes/${id}`, {}, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response;
    } catch (error) {
        console.error(`Error fetching recipe with ID ${id}:`, error);
        throw error;
    }
};

// Get recipe information by ID - NOW WITH AUTOMATIC CACHING
export const getRecipeInformation = async (id: number): Promise<Recipe> => {
    return getRecipeById(id);
};

// Get similar recipes - NOW WITH AUTOMATIC CACHING
export const getSimilarRecipes = async (id: number, number: number = 5): Promise<Recipe[]> => {
    try {
        const response = await apiService.get(`/recipes/${id}/similar`, { number }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response || [];
    } catch (error) {
        console.error(`Error fetching similar recipes for ID ${id}:`, error);
        throw error;
    }
};

// Get recipes by meal type - NOW WITH AUTOMATIC CACHING
export const getRecipesByMealType = async (mealType: string, number: number = 10): Promise<Recipe[]> => {
    try {
        const response = await apiService.get('/recipes/search', { query: mealType, number }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response.results || [];
    } catch (error) {
        console.error(`Error fetching recipes for meal type ${mealType}:`, error);
        throw error;
    }
};

// Get recipes by diet - NOW WITH AUTOMATIC CACHING
export const getRecipesByDiet = async (diet: string, number: number = 10): Promise<Recipe[]> => {
    try {
        const response = await apiService.get('/recipes/search', { diet, number }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response.results || [];
    } catch (error) {
        console.error(`Error fetching recipes for diet ${diet}:`, error);
        throw error;
    }
};

// Generate meal plan - NOW WITH AUTOMATIC CACHING
export const generateMealPlan = async (
    timeFrame: 'day' | 'week',
    targetCalories: number,
    diet?: string,
    exclude?: string
): Promise<any> => {
    try {
        const params: any = {
            timeFrame,
            targetCalories
        };

        if (diet) params.diet = diet;
        if (exclude) params.exclude = exclude;

        const response = await apiService.get('/recipes/mealplan', params, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        throw error;
    }
};

// Get recipe nutrition information - NOW WITH AUTOMATIC CACHING
export const getRecipeNutrition = async (id: number): Promise<any> => {
    try {
        const response = await apiService.get(`/recipes/${id}/nutritionWidget`, {}, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true // Explicitly enable caching
        });
        return response;
    } catch (error) {
        console.error(`Error fetching nutrition for recipe ${id}:`, error);
        throw error;
    }
};