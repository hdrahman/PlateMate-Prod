import apiService from '../utils/apiService';
import { ServiceTokenType } from '../utils/tokenManager';
import { RecipeCacheService } from '../services/RecipeCacheService';

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

// Get random recipes
export const getRandomRecipes = async (count: number = 10): Promise<Recipe[]> => {
    try {
        const response = await apiService.get('/recipes/random', { count }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        // Cache the recipes for offline use
        if (response.recipes && Array.isArray(response.recipes)) {
            await RecipeCacheService.cacheRecipes(response.recipes);
        }

        return response.recipes || [];
    } catch (error) {
        console.error('Error fetching random recipes:', error);

        // Try to get cached recipes if network request fails
        try {
            const cachedRecipes = await RecipeCacheService.getRandomCachedRecipes(count);
            if (cachedRecipes.length > 0) {
                console.log(`Retrieved ${cachedRecipes.length} cached recipes`);
                return cachedRecipes;
            }
        } catch (cacheError) {
            console.error('Error retrieving cached recipes:', cacheError);
        }

        throw error;
    }
};

// Search recipes
export const searchRecipes = async (query: string, number: number = 10, offset: number = 0): Promise<any> => {
    try {
        // Check cache first for faster response
        try {
            const cachedRecipes = await RecipeCacheService.searchCachedRecipes(query, number);
            if (cachedRecipes.length > 0) {
                console.log(`Using ${cachedRecipes.length} cached recipes matching "${query}"`);

                // Start a background refresh to update cache with fresh data
                setTimeout(async () => {
                    try {
                        const freshResponse = await apiService.get('/recipes/search', {
                            query,
                            number,
                            offset
                        }, {
                            serviceType: ServiceTokenType.SUPABASE_AUTH,
                            useCache: false // Skip cache check since we're updating the cache
                        });

                        // Update cache in the background
                        if (freshResponse.results && Array.isArray(freshResponse.results)) {
                            await RecipeCacheService.cacheRecipes(freshResponse.results);
                            console.log(`Updated cache with ${freshResponse.results.length} fresh recipes for "${query}"`);
                        }
                    } catch (refreshError) {
                        console.log('Background cache refresh failed:', refreshError);
                        // Non-critical error, can be ignored
                    }
                }, 0);

                // Return cached results immediately
                return {
                    results: cachedRecipes,
                    totalResults: cachedRecipes.length,
                    offset: 0,
                    number: cachedRecipes.length
                };
            }
        } catch (cacheError) {
            console.log('Cache check failed, continuing with API request:', cacheError);
            // Continue with API request if cache check fails
        }

        // Make the API request
        const response = await apiService.get('/recipes/search', {
            query,
            number,
            offset
        }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        // Cache the recipes in the background for offline use
        if (response.results && Array.isArray(response.results)) {
            setTimeout(async () => {
                try {
                    await RecipeCacheService.cacheRecipes(response.results);
                    console.log(`Cached ${response.results.length} recipes for offline use`);
                } catch (cacheError) {
                    console.error('Error caching recipes:', cacheError);
                    // Non-critical error, can be ignored
                }
            }, 0);
        }

        return response;
    } catch (error) {
        console.error('Error searching recipes:', error);

        // Try to get cached recipes if network request fails
        try {
            const cachedRecipes = await RecipeCacheService.searchCachedRecipes(query, number);
            if (cachedRecipes.length > 0) {
                console.log(`Retrieved ${cachedRecipes.length} cached recipes matching "${query}" after API failure`);
                return {
                    results: cachedRecipes,
                    totalResults: cachedRecipes.length,
                    offset: 0,
                    number: cachedRecipes.length
                };
            }
        } catch (cacheError) {
            console.error('Error searching cached recipes:', cacheError);
        }

        throw error;
    }
};

// Get recipe by ID
export const getRecipeById = async (id: number): Promise<Recipe> => {
    try {
        const response = await apiService.get(`/recipes/${id}`, undefined, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        // Cache the recipe for offline use
        if (response) {
            await RecipeCacheService.cacheRecipe(response);
        }

        return response;
    } catch (error) {
        console.error(`Error fetching recipe with ID ${id}:`, error);

        // Try to get cached recipe if network request fails
        try {
            const cachedRecipe = await RecipeCacheService.getCachedRecipeById(id);
            if (cachedRecipe) {
                console.log(`Retrieved cached recipe with ID ${id}`);
                return cachedRecipe;
            }
        } catch (cacheError) {
            console.error('Error retrieving cached recipe:', cacheError);
        }

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
        const response = await apiService.get(`/recipes/${id}/similar`, { number }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        // Cache the recipes for offline use
        if (Array.isArray(response)) {
            await RecipeCacheService.cacheRecipes(response);
        }

        return response || [];
    } catch (error) {
        console.error(`Error fetching similar recipes for ID ${id}:`, error);
        throw error;
    }
};

// Get recipes by meal type
export const getRecipesByMealType = async (mealType: string, number: number = 10): Promise<Recipe[]> => {
    try {
        const response = await apiService.get('/recipes/search', {
            query: mealType,
            number
        }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        // Cache the recipes for offline use
        if (response.results && Array.isArray(response.results)) {
            await RecipeCacheService.cacheRecipes(response.results);
        }

        return response.results || [];
    } catch (error) {
        console.error(`Error fetching recipes for meal type ${mealType}:`, error);

        // Try to get cached recipes if network request fails
        try {
            const cachedRecipes = await RecipeCacheService.searchCachedRecipes(mealType, number);
            if (cachedRecipes.length > 0) {
                console.log(`Retrieved ${cachedRecipes.length} cached recipes for meal type "${mealType}"`);
                return cachedRecipes;
            }
        } catch (cacheError) {
            console.error('Error retrieving cached recipes:', cacheError);
        }

        throw error;
    }
};

// Get recipes by diet
export const getRecipesByDiet = async (diet: string, number: number = 10): Promise<Recipe[]> => {
    try {
        const response = await apiService.get('/recipes/search', {
            diet,
            number
        }, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        // Cache the recipes for offline use
        if (response.results && Array.isArray(response.results)) {
            await RecipeCacheService.cacheRecipes(response.results);
        }

        return response.results || [];
    } catch (error) {
        console.error(`Error fetching recipes for diet ${diet}:`, error);

        // Try to get cached recipes if network request fails
        try {
            const cachedRecipes = await RecipeCacheService.searchCachedRecipes(diet, number);
            if (cachedRecipes.length > 0) {
                console.log(`Retrieved ${cachedRecipes.length} cached recipes for diet "${diet}"`);
                return cachedRecipes;
            }
        } catch (cacheError) {
            console.error('Error retrieving cached recipes:', cacheError);
        }

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
        const params: any = {
            timeFrame,
            targetCalories
        };

        if (diet) params.diet = diet;
        if (exclude) params.exclude = exclude;

        const response = await apiService.get('/recipes/mealplan', params, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        return response;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        throw error;
    }
};

// Get recipe nutrition information
export const getRecipeNutrition = async (id: number): Promise<any> => {
    try {
        const response = await apiService.get(`/recipes/${id}/nutritionWidget`, undefined, {
            serviceType: ServiceTokenType.SUPABASE_AUTH,
            useCache: true
        });

        return response;
    } catch (error) {
        console.error(`Error fetching nutrition for recipe ${id}:`, error);
        throw error;
    }
};