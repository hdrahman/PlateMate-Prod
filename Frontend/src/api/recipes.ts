import axios from 'axios';
import { SPOONACULAR_API_KEY } from '../utils/config';

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
    { id: 'snack', name: 'Snacks', icon: 'cafe-outline' },
    { id: 'dessert', name: 'Desserts', icon: 'ice-cream-outline' },
    { id: 'vegetarian', name: 'Vegetarian', icon: 'leaf-outline' },
    { id: 'vegan', name: 'Vegan', icon: 'nutrition-outline' },
    { id: 'glutenFree', name: 'Gluten Free', icon: 'barcode-outline' },
    { id: 'dairyFree', name: 'Dairy Free', icon: 'water-outline' },
    { id: 'healthy', name: 'Healthy', icon: 'fitness-outline' },
    { id: 'quick', name: 'Quick & Easy', icon: 'timer-outline' },
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

// Base URL for Spoonacular API
const BASE_URL = 'https://api.spoonacular.com';

// Check if API key is configured
const isConfigured = !!SPOONACULAR_API_KEY;

// Function to map Spoonacular recipe to our Recipe interface
const mapSpoonacularRecipe = (spoonRecipe: any): Recipe => {
    return {
        id: spoonRecipe.id.toString(),
        title: spoonRecipe.title,
        image: spoonRecipe.image?.startsWith('http')
            ? spoonRecipe.image
            : `https://spoonacular.com/recipeImages/${spoonRecipe.image}`,
        readyInMinutes: spoonRecipe.readyInMinutes || 0,
        servings: spoonRecipe.servings || 1,
        sourceUrl: spoonRecipe.sourceUrl || '',
        summary: spoonRecipe.summary?.replace(/<[^>]*>/g, '') || '',
        healthScore: spoonRecipe.healthScore || 0,
        ingredients: spoonRecipe.extendedIngredients?.map((ing: any) => ing.original) || [],
        instructions: spoonRecipe.instructions?.replace(/<[^>]*>/g, '') || '',
        diets: spoonRecipe.diets || [],
        cuisines: spoonRecipe.cuisines || [],
    };
};

// Function to search for recipes by query
export const searchRecipes = async (params: RecipeSearchParams): Promise<Recipe[]> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured.');
        return [];
    }

    try {
        const apiParams: any = {
            apiKey: SPOONACULAR_API_KEY,
            number: params.number || 10,
            offset: params.offset || 0,
            addRecipeInformation: true,
            fillIngredients: true,
        };

        if (params.query) apiParams.query = params.query;
        if (params.cuisine) apiParams.cuisine = params.cuisine;
        if (params.diet) apiParams.diet = params.diet;
        if (params.intolerances) apiParams.intolerances = params.intolerances;
        if (params.maxReadyTime) apiParams.maxReadyTime = params.maxReadyTime;
        if (params.sort) apiParams.sort = params.sort;
        if (params.sortDirection) apiParams.sortDirection = params.sortDirection;

        if (params.includeIngredients && params.includeIngredients.length > 0) {
            apiParams.includeIngredients = params.includeIngredients.join(',');
        }

        const response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
            params: apiParams
        });

        return response.data.results.map(mapSpoonacularRecipe);
    } catch (error) {
        console.error('Error searching recipes:', error);
        return [];
    }
};

// Function to get recipe details by ID
export const getRecipeById = async (id: string): Promise<Recipe | null> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured.');
        return null;
    }

    try {
        const response = await axios.get(`${BASE_URL}/recipes/${id}/information`, {
            params: {
                apiKey: SPOONACULAR_API_KEY,
                includeNutrition: false
            }
        });

        return mapSpoonacularRecipe(response.data);
    } catch (error) {
        console.error('Error getting recipe details:', error);
        return null;
    }
};

// Function to get random recipes
export const getRandomRecipes = async (count: number = 5): Promise<Recipe[]> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured.');
        return [];
    }

    try {
        const response = await axios.get(`${BASE_URL}/recipes/random`, {
            params: {
                apiKey: SPOONACULAR_API_KEY,
                number: count,
                addRecipeInformation: true,
                fillIngredients: true
            }
        });

        return response.data.recipes.map(mapSpoonacularRecipe);
    } catch (error) {
        console.error('Error getting random recipes:', error);
        return [];
    }
};

// Function to get recipes by meal type
export const getRecipesByMealType = async (mealType: string, count: number = 3): Promise<Recipe[]> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured. Using mock data.');

        // Map meal types to diets or cuisines for filtering
        let recipes = [];

        switch (mealType.toLowerCase()) {
            case 'breakfast':
                return recipes.slice(0, count);
            case 'lunch':
                return recipes.slice(1, 1 + count);
            case 'dinner':
                return recipes.slice(Math.max(0, recipes.length - count));
            default:
                break;
        }

        return shuffleArray(recipes).slice(0, count);
    }

    try {
        let apiParams: any = {
            apiKey: SPOONACULAR_API_KEY,
            number: count,
            addRecipeInformation: true,
            fillIngredients: true
        };

        // Different query parameters based on meal type
        switch (mealType.toLowerCase()) {
            case 'breakfast':
                apiParams.type = 'breakfast';
                break;
            case 'lunch':
                apiParams.type = 'main course';
                apiParams.maxReadyTime = 30; // Quick lunch
                break;
            case 'dinner':
                apiParams.type = 'main course';
                break;
            case 'snack':
                apiParams.type = 'snack';
                break;
            case 'dessert':
                apiParams.type = 'dessert';
                break;
            case 'vegetarian':
                apiParams.diet = 'vegetarian';
                break;
            case 'vegan':
                apiParams.diet = 'vegan';
                break;
            case 'glutenfree':
                apiParams.diet = 'gluten free';
                break;
            case 'dairyfree':
                apiParams.intolerances = 'dairy';
                break;
            case 'healthy':
                apiParams.sort = 'healthiness';
                apiParams.sortDirection = 'desc';
                break;
            case 'quick':
                apiParams.maxReadyTime = 20;
                break;
            default:
                // No specific filtering
                break;
        }

        const response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
            params: apiParams
        });

        return response.data.results.map(mapSpoonacularRecipe);
    } catch (error) {
        console.error(`Error getting ${mealType} recipes:`, error);
        return [];
    }
};

// Generate a meal plan using Spoonacular API
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
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured.');
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

    try {
        const apiParams: any = {
            apiKey: SPOONACULAR_API_KEY,
            timeFrame: params.timeFrame || 'day',
        };

        if (params.targetCalories) apiParams.targetCalories = params.targetCalories;
        if (params.diet) apiParams.diet = params.diet;
        if (params.exclude && params.exclude.length > 0) {
            apiParams.exclude = params.exclude.join(',');
        }

        // Add new filtering parameters if provided
        if (params.type) apiParams.type = params.type;
        if (params.cuisine) apiParams.cuisine = params.cuisine;
        if (params.maxReadyTime) apiParams.maxReadyTime = params.maxReadyTime;
        if (params.minProtein) apiParams.minProtein = params.minProtein;
        if (params.maxCarbs) apiParams.maxCarbs = params.maxCarbs;

        const response = await axios.get(`${BASE_URL}/mealplanner/generate`, {
            params: apiParams
        });

        // For day meal plan
        if (response.data.meals) {
            // Fetch full recipe details for each meal
            const mealPromises = response.data.meals.map((meal: any) =>
                getRecipeById(meal.id.toString())
            );

            const mealDetails = await Promise.all(mealPromises);

            return {
                meals: mealDetails.filter(Boolean), // Filter out any null results
                nutrients: response.data.nutrients
            };
        }

        return response.data;
    } catch (error) {
        console.error('Error generating meal plan:', error);
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

// Helper function to shuffle array
const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};