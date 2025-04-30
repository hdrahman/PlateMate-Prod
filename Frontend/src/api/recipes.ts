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

// Fallbacks for when API is unavailable or rate limited
const MOCK_RECIPES = [
    {
        id: '1',
        title: 'Classic Omelet with Spinach and Cheese',
        image: 'https://images.unsplash.com/photo-1612240498936-65f5101365d2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
        readyInMinutes: 15,
        servings: 1,
        sourceUrl: 'https://example.com/recipe/omelet',
        summary: 'A nutritious and protein-packed breakfast that combines fresh spinach with melted cheese in a fluffy egg base.',
        healthScore: 80,
        ingredients: ['Eggs', 'Spinach', 'Cheese', 'Salt', 'Pepper', 'Butter'],
        instructions: 'Whisk eggs in a bowl. Heat butter in a pan. Add spinach until wilted. Pour eggs over and cook until set. Add cheese, fold, and serve.',
        diets: ['vegetarian', 'gluten-free', 'keto'],
        cuisines: ['american', 'french'],
    },
    {
        id: '2',
        title: 'Chicken & Vegetable Stir Fry',
        image: 'https://images.unsplash.com/photo-1603436202677-80ca0ceb7cc2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
        readyInMinutes: 25,
        servings: 2,
        sourceUrl: 'https://example.com/recipe/stir-fry',
        summary: 'A quick and healthy stir fry with lean protein and plenty of colorful vegetables in a light sauce.',
        healthScore: 90,
        ingredients: ['Chicken breast', 'Broccoli', 'Bell peppers', 'Carrots', 'Soy sauce', 'Garlic', 'Ginger', 'Rice'],
        instructions: 'Slice chicken and vegetables. Stir-fry chicken until cooked. Add vegetables and stir-fry until tender-crisp. Add sauce ingredients, toss to coat, and serve over rice.',
        diets: ['dairy-free'],
        cuisines: ['asian', 'chinese'],
    },
    {
        id: '3',
        title: 'Mediterranean Chickpea Salad',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
        readyInMinutes: 15,
        servings: 2,
        sourceUrl: 'https://example.com/recipe/chickpea-salad',
        summary: 'A refreshing plant-based salad with protein-rich chickpeas, fresh vegetables, and zesty Mediterranean flavors.',
        healthScore: 95,
        ingredients: ['Chickpeas', 'Cucumber', 'Cherry tomatoes', 'Red onion', 'Feta cheese', 'Olive oil', 'Lemon juice', 'Herbs'],
        instructions: 'Combine all ingredients in a bowl. Whisk together olive oil, lemon juice, and herbs. Pour over salad and toss to combine. Chill before serving.',
        diets: ['vegetarian', 'gluten-free'],
        cuisines: ['mediterranean', 'greek'],
    },
    {
        id: '4',
        title: 'Easy Beef and Vegetable Soup',
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
        readyInMinutes: 45,
        servings: 4,
        sourceUrl: 'https://example.com/recipe/beef-soup',
        summary: 'A hearty and comforting soup featuring tender beef chunks, nutritious vegetables, and a flavorful broth.',
        healthScore: 85,
        ingredients: ['Beef chunks', 'Onions', 'Carrots', 'Celery', 'Potatoes', 'Garlic', 'Beef broth', 'Herbs'],
        instructions: 'Brown beef in a pot. Add onions, carrots, celery, and garlic. Pour in broth and add potatoes and herbs. Simmer until meat is tender and vegetables are cooked.',
        diets: ['dairy-free', 'gluten-free'],
        cuisines: ['american', 'comfort'],
    },
    {
        id: '5',
        title: 'Quinoa Buddha Bowl',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
        readyInMinutes: 30,
        servings: 1,
        sourceUrl: 'https://example.com/recipe/buddha-bowl',
        summary: 'A nutritionally balanced meal with whole grains, plant proteins, and colorful vegetables.',
        healthScore: 100,
        ingredients: ['Quinoa', 'Avocado', 'Chickpeas', 'Sweet potato', 'Kale', 'Tahini', 'Lemon juice', 'Seeds'],
        instructions: 'Cook quinoa according to package. Roast sweet potatoes and chickpeas. Massage kale with olive oil. Assemble bowl with quinoa base, vegetables, and protein. Top with tahini dressing and seeds.',
        diets: ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'],
        cuisines: ['healthy', 'mediterranean'],
    }
];

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
        console.warn('Spoonacular API key not configured. Using mock data.');

        // Filter mock data based on params
        let filteredRecipes = [...MOCK_RECIPES];

        if (params.query) {
            const query = params.query.toLowerCase();
            filteredRecipes = filteredRecipes.filter(recipe =>
                recipe.title.toLowerCase().includes(query) ||
                recipe.ingredients.some(ing => ing.toLowerCase().includes(query))
            );
        }

        // Apply other filters as needed
        return filteredRecipes.slice(0, params.number || 10);
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
        return MOCK_RECIPES.slice(0, params.number || 10);
    }
};

// Function to get recipe details by ID
export const getRecipeById = async (id: string): Promise<Recipe | null> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured. Using mock data.');
        return MOCK_RECIPES.find(r => r.id === id) || null;
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
        return MOCK_RECIPES.find(r => r.id === id) || null;
    }
};

// Function to get random recipes
export const getRandomRecipes = async (count: number = 5): Promise<Recipe[]> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured. Using mock data.');
        return shuffleArray([...MOCK_RECIPES]).slice(0, count);
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
        return shuffleArray([...MOCK_RECIPES]).slice(0, count);
    }
};

// Function to get recipes by meal type
export const getRecipesByMealType = async (mealType: string, count: number = 3): Promise<Recipe[]> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured. Using mock data.');

        // Map meal types to diets or cuisines for filtering
        let recipes = [...MOCK_RECIPES];

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
        return shuffleArray([...MOCK_RECIPES]).slice(0, count);
    }
};

// Generate a meal plan using Spoonacular API
export const generateMealPlan = async (params: {
    timeFrame?: 'day' | 'week',
    targetCalories?: number,
    diet?: string,
    exclude?: string[]
}): Promise<any> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured. Using mock data.');
        return {
            meals: shuffleArray([...MOCK_RECIPES]).slice(0, 3),
            nutrients: {
                calories: 2000,
                protein: 100,
                fat: 70,
                carbohydrates: 250
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
            meals: shuffleArray([...MOCK_RECIPES]).slice(0, 3),
            nutrients: {
                calories: 2000,
                protein: 100,
                fat: 70,
                carbohydrates: 250
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