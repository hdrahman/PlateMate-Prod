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
    { id: 'comfort', name: 'Comfort Food', icon: 'heart-outline' },
    { id: 'mexican', name: 'Mexican', icon: 'flame-outline' },
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

// Base URL for Spoonacular API
const BASE_URL = 'https://api.spoonacular.com';

// Check if API key is configured
const isConfigured = !!SPOONACULAR_API_KEY;

// Function to map Spoonacular recipe to our Recipe interface
const mapSpoonacularRecipe = (spoonRecipe: any): Recipe => {
    // Get highest resolution image by modifying the image size parameter
    let imageUrl = spoonRecipe.image || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
        // Use highest resolution: 636x393 for best quality
        imageUrl = `https://spoonacular.com/recipeImages/${spoonRecipe.id}-636x393.${spoonRecipe.imageType || 'jpg'}`;
    } else if (imageUrl && imageUrl.includes('312x231')) {
        // Replace smaller resolution with highest one
        imageUrl = imageUrl.replace('312x231', '636x393');
    } else if (imageUrl && imageUrl.includes('240x150')) {
        // Replace smaller resolution with highest one
        imageUrl = imageUrl.replace('240x150', '636x393');
    } else if (imageUrl && imageUrl.includes('556x370')) {
        // Replace medium resolution with highest one
        imageUrl = imageUrl.replace('556x370', '636x393');
    }

    return {
        id: spoonRecipe.id.toString(),
        title: spoonRecipe.title,
        image: imageUrl,
        readyInMinutes: spoonRecipe.readyInMinutes || 0,
        servings: spoonRecipe.servings || 1,
        sourceUrl: spoonRecipe.sourceUrl || '',
        summary: spoonRecipe.summary?.replace(/<[^>]*>/g, '') || '',
        healthScore: spoonRecipe.healthScore || 0,
        ingredients: spoonRecipe.extendedIngredients?.map((ing: any) => ing.original) || [],
        instructions: spoonRecipe.instructions?.replace(/<[^>]*>/g, '') || '',
        diets: spoonRecipe.diets || [],
        cuisines: spoonRecipe.cuisines || [],
        aggregateLikes: spoonRecipe.aggregateLikes || 0,
    };
};

// Function to search for recipes by query
export const searchRecipes = async (params: RecipeSearchParams): Promise<Recipe[]> => {
    if (!isConfigured) {
        console.warn('Spoonacular API key not configured.');
        return [];
    }

    try {
        console.log('Searching recipes with params:', params);
        const apiParams: any = {
            apiKey: SPOONACULAR_API_KEY,
            number: params.number || 10,
            offset: params.offset || 0,
            addRecipeInformation: true,
            fillIngredients: true,
            instructionsRequired: true,
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

        console.log(`Found ${response.data.results.length} recipes for query: ${params.query}`);
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
        // Mix of mainstream cuisines that Americans love
        const popularCuisines = ['american', 'mexican', 'italian', 'asian', 'mediterranean'];
        const popularKeywords = [
            'burger', 'quesadilla', 'enchilada', 'nacho', 'loaded fries', 'pizza', 'taco',
            'sandwich', 'pasta', 'stir fry', 'bowl', 'wrap', 'chicken', 'beef', 'cheese'
        ];

        // Try to get a mix of different types of popular foods
        let allResults: Recipe[] = [];

        // Fetch from different categories to ensure variety
        for (let i = 0; i < 3; i++) {
            const randomCuisine = popularCuisines[Math.floor(Math.random() * popularCuisines.length)];
            const randomKeyword = popularKeywords[Math.floor(Math.random() * popularKeywords.length)];

            try {
                let response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
                    params: {
                        apiKey: SPOONACULAR_API_KEY,
                        number: Math.ceil(count / 2), // Get fewer per request to mix categories
                        addRecipeInformation: true,
                        fillIngredients: true,
                        minHealthScore: 40, // Lower threshold for more variety while still being reasonably healthy
                        sort: 'aggregateLikes',
                        sortDirection: 'desc',
                        instructionsRequired: true,
                        limitLicense: false,
                        cuisine: randomCuisine,
                        query: Math.random() > 0.5 ? randomKeyword : undefined, // Sometimes use keyword, sometimes just cuisine
                        offset: Math.floor(Math.random() * 10),
                    }
                });

                const results = response.data.results.map(mapSpoonacularRecipe);
                allResults.push(...results);
            } catch (error) {
                console.log(`Failed to fetch ${randomCuisine} recipes, continuing...`);
            }
        }

        // If we don't have enough results, try a broader search focusing on popular American foods
        if (allResults.length < count) {
            try {
                let response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
                    params: {
                        apiKey: SPOONACULAR_API_KEY,
                        number: count,
                        addRecipeInformation: true,
                        fillIngredients: true,
                        minHealthScore: 35, // Even more flexible for mainstream appeal
                        sort: 'aggregateLikes',
                        sortDirection: 'desc',
                        instructionsRequired: true,
                        limitLicense: false,
                        cuisine: 'american,mexican,italian',
                        type: 'main course',
                        offset: 0,
                    }
                });

                const results = response.data.results.map(mapSpoonacularRecipe);
                allResults.push(...results);
            } catch (error) {
                console.log('Fallback search failed, trying final basic search...');
            }
        }

        // Remove duplicates and sort by popularity
        const uniqueResults = allResults.filter((recipe, index, self) =>
            index === self.findIndex(r => r.id === recipe.id)
        );

        const sortedResults = uniqueResults.sort((a, b) =>
            (b.aggregateLikes || 0) - (a.aggregateLikes || 0)
        );

        // Return the most popular unique recipes
        return sortedResults.slice(0, count);

    } catch (error) {
        console.error('Error getting featured recipes:', error);
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
        // Apply all filters first, then fetch exactly what we need
        let apiParams: any = {
            apiKey: SPOONACULAR_API_KEY,
            number: count,
            addRecipeInformation: true,
            fillIngredients: true,
            minHealthScore: 45, // Lower default for more mainstream appeal while still healthy
            sort: 'aggregateLikes',
            sortDirection: 'desc',
            instructionsRequired: true, // Always required for usability
            offset: Math.floor(Math.random() * 15), // Small random offset for meal types
        };

        // Apply meal type-specific filters on the API side
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
            case 'comfort':
                apiParams.type = 'main course';
                apiParams.query = 'burger,pizza,nachos,quesadilla,mac and cheese,fried chicken,grilled cheese';
                apiParams.cuisine = 'american,mexican,italian';
                apiParams.minHealthScore = 35; // Lower for comfort foods
                break;
            case 'mexican':
                apiParams.cuisine = 'mexican';
                apiParams.query = 'taco,quesadilla,enchilada,burrito,nacho';
                apiParams.minHealthScore = 40;
                break;
            case 'italian':
                apiParams.cuisine = 'italian';
                apiParams.query = 'pizza,pasta,lasagna,risotto,sandwich';
                apiParams.minHealthScore = 40;
                break;
            case 'american':
                apiParams.cuisine = 'american';
                apiParams.query = 'burger,sandwich,bbq,steak,chicken,fries';
                apiParams.minHealthScore = 40;
                break;
            case 'snack':
                apiParams.type = 'snack';
                break;
            case 'vegetarian':
                apiParams.diet = 'vegetarian';
                apiParams.minHealthScore = 50; // Maintain higher standard for vegetarian
                break;
            case 'healthy':
                apiParams.sort = 'healthiness';
                apiParams.sortDirection = 'desc';
                apiParams.minHealthScore = 70; // Higher standard for healthy category
                break;
            case 'quick':
                apiParams.maxReadyTime = 25;
                apiParams.type = 'main course';
                break;
            default:
                // No specific filtering
                break;
        }

        let response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
            params: apiParams
        });

        let results = response.data.results.map(mapSpoonacularRecipe);

        // Check if results have decent engagement (at least some recipes with 5+ likes for meal types)
        const hasGoodEngagement = results.some(recipe => (recipe.aggregateLikes || 0) >= 5);

        // If results have poor engagement, try different strategies while maintaining standards
        if (!hasGoodEngagement && results.length > 0 && mealType.toLowerCase() !== 'healthy') {
            console.log(`Initial ${mealType} results have low engagement, trying alternative approaches...`);

            // Strategy 1: Remove random offset, get most popular with same filters
            const strategy1Params = {
                ...apiParams,
                minHealthScore: 45, // Lower but still reasonable for health app
                offset: 0, // No offset - get the most popular
            };

            response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
                params: strategy1Params
            });

            results = response.data.results.map(mapSpoonacularRecipe);

            // If still poor engagement, try fetching more and selecting best
            const stillPoorEngagement = !results.some(recipe => (recipe.aggregateLikes || 0) >= 5);
            if (stillPoorEngagement && results.length > 0) {
                console.log(`Trying larger sample for ${mealType} recipes...`);

                const strategy2Params = {
                    ...strategy1Params,
                    number: count * 3, // Fetch more to have options
                    minHealthScore: 40, // Minimum acceptable for health app
                };

                response = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
                    params: strategy2Params
                });

                const allResults = response.data.results.map(mapSpoonacularRecipe);

                // Select the best engaged recipes from the larger sample
                const sortedByEngagement = allResults.sort((a, b) =>
                    (b.aggregateLikes || 0) - (a.aggregateLikes || 0)
                );

                results = sortedByEngagement.slice(0, count);
            }
        }

        return results;
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