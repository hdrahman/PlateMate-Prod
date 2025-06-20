import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '../api/recipes';

// Cache keys
const CACHE_KEYS = {
    FEATURED_RECIPES: 'featured_recipes_cache',
    CATEGORY_RECIPES: 'category_recipes_cache_',
    LAST_FETCH_DATE: 'last_fetch_date',
    RECIPES: 'recipes_cache',
    RECIPE_IDS: 'recipe_ids_cache',
};

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export interface CachedData<T> {
    data: T;
    timestamp: number;
    date: string; // Format: YYYY-MM-DD
}

export class RecipeCacheService {
    /**
     * Get the current date in YYYY-MM-DD format
     */
    private static getCurrentDateString(): string {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    /**
     * Check if cached data is still valid for today
     */
    private static isCacheValid(cachedData: CachedData<any>): boolean {
        const currentDate = this.getCurrentDateString();
        const cachedDate = cachedData.date;

        // Cache is valid if it's from today
        return currentDate === cachedDate;
    }

    /**
     * Store data in cache with current timestamp and date
     */
    private static async setCache<T>(key: string, data: T): Promise<void> {
        try {
            const cachedData: CachedData<T> = {
                data,
                timestamp: Date.now(),
                date: this.getCurrentDateString(),
            };

            await AsyncStorage.setItem(key, JSON.stringify(cachedData));
            console.log(`✅ Cached data stored for key: ${key}`);
        } catch (error) {
            console.error(`❌ Error storing cache for key ${key}:`, error);
        }
    }

    /**
     * Retrieve data from cache if it's still valid
     */
    private static async getCache<T>(key: string): Promise<T | null> {
        try {
            const cachedDataString = await AsyncStorage.getItem(key);

            if (!cachedDataString) {
                console.log(`📝 No cache found for key: ${key}`);
                return null;
            }

            const cachedData: CachedData<T> = JSON.parse(cachedDataString);

            if (this.isCacheValid(cachedData)) {
                console.log(`✅ Valid cache found for key: ${key} (from ${cachedData.date})`);
                return cachedData.data;
            } else {
                console.log(`⏰ Cache expired for key: ${key} (was from ${cachedData.date}, today is ${this.getCurrentDateString()})`);
                // Remove expired cache
                await AsyncStorage.removeItem(key);
                return null;
            }
        } catch (error) {
            console.error(`❌ Error retrieving cache for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Cache featured recipes for the day
     */
    static async cacheFeaturedRecipes(recipes: Recipe[]): Promise<void> {
        await this.setCache(CACHE_KEYS.FEATURED_RECIPES, recipes);
    }

    /**
     * Get cached featured recipes if available and valid
     */
    static async getCachedFeaturedRecipes(): Promise<Recipe[] | null> {
        return await this.getCache<Recipe[]>(CACHE_KEYS.FEATURED_RECIPES);
    }

    /**
     * Cache recipes for a specific category
     */
    static async cacheCategoryRecipes(categoryId: string, recipes: Recipe[]): Promise<void> {
        const key = CACHE_KEYS.CATEGORY_RECIPES + categoryId;
        await this.setCache(key, recipes);
    }

    /**
     * Get cached recipes for a specific category
     */
    static async getCachedCategoryRecipes(categoryId: string): Promise<Recipe[] | null> {
        const key = CACHE_KEYS.CATEGORY_RECIPES + categoryId;
        return await this.getCache<Recipe[]>(key);
    }

    /**
     * Cache multiple recipes
     */
    static async cacheRecipes(recipes: Recipe[]): Promise<void> {
        try {
            // Get existing recipe IDs
            const existingIdsString = await AsyncStorage.getItem(CACHE_KEYS.RECIPE_IDS);
            const existingIds: number[] = existingIdsString ? JSON.parse(existingIdsString) : [];

            // Add new recipes to cache
            for (const recipe of recipes) {
                if (recipe && recipe.id) {
                    const key = `${CACHE_KEYS.RECIPES}_${recipe.id}`;
                    await this.setCache(key, recipe);

                    // Add ID to list if not already there
                    if (!existingIds.includes(recipe.id)) {
                        existingIds.push(recipe.id);
                    }
                }
            }

            // Update recipe IDs list
            await AsyncStorage.setItem(CACHE_KEYS.RECIPE_IDS, JSON.stringify(existingIds));
            console.log(`✅ Cached ${recipes.length} recipes, total unique recipes: ${existingIds.length}`);
        } catch (error) {
            console.error('❌ Error caching recipes:', error);
        }
    }

    /**
     * Cache a single recipe
     */
    static async cacheRecipe(recipe: Recipe): Promise<void> {
        if (recipe && recipe.id) {
            try {
                // Cache the individual recipe
                const key = `${CACHE_KEYS.RECIPES}_${recipe.id}`;
                await this.setCache(key, recipe);

                // Add to recipe IDs list if not already there
                const existingIdsString = await AsyncStorage.getItem(CACHE_KEYS.RECIPE_IDS);
                const existingIds: number[] = existingIdsString ? JSON.parse(existingIdsString) : [];

                if (!existingIds.includes(recipe.id)) {
                    existingIds.push(recipe.id);
                    await AsyncStorage.setItem(CACHE_KEYS.RECIPE_IDS, JSON.stringify(existingIds));
                }

                console.log(`✅ Cached recipe: ${recipe.title} (ID: ${recipe.id})`);
            } catch (error) {
                console.error(`❌ Error caching recipe ${recipe.id}:`, error);
            }
        }
    }

    /**
     * Get a cached recipe by ID
     */
    static async getCachedRecipeById(id: number): Promise<Recipe | null> {
        const key = `${CACHE_KEYS.RECIPES}_${id}`;
        return await this.getCache<Recipe>(key);
    }

    /**
     * Search cached recipes by query
     */
    static async searchCachedRecipes(query: string, limit: number = 10): Promise<Recipe[]> {
        try {
            // Get all recipe IDs
            const existingIdsString = await AsyncStorage.getItem(CACHE_KEYS.RECIPE_IDS);
            if (!existingIdsString) {
                return [];
            }

            const recipeIds: number[] = JSON.parse(existingIdsString);
            const matchingRecipes: Recipe[] = [];
            const normalizedQuery = query.toLowerCase();

            // Search through cached recipes
            for (const id of recipeIds) {
                if (matchingRecipes.length >= limit) break;

                const recipe = await this.getCachedRecipeById(id);
                if (recipe) {
                    // Check if recipe matches search query
                    const matchesTitle = recipe.title && recipe.title.toLowerCase().includes(normalizedQuery);
                    const matchesCuisine = recipe.cuisines && recipe.cuisines.some(c =>
                        c.toLowerCase().includes(normalizedQuery));
                    const matchesDishType = recipe.dishTypes && recipe.dishTypes.some(d =>
                        d.toLowerCase().includes(normalizedQuery));

                    if (matchesTitle || matchesCuisine || matchesDishType) {
                        matchingRecipes.push(recipe);
                    }
                }
            }

            console.log(`✅ Found ${matchingRecipes.length} cached recipes matching "${query}"`);
            return matchingRecipes;
        } catch (error) {
            console.error(`❌ Error searching cached recipes for "${query}":`, error);
            return [];
        }
    }

    /**
     * Get random cached recipes
     */
    static async getRandomCachedRecipes(count: number = 10): Promise<Recipe[]> {
        try {
            // Get all recipe IDs
            const existingIdsString = await AsyncStorage.getItem(CACHE_KEYS.RECIPE_IDS);
            if (!existingIdsString) {
                return [];
            }

            const recipeIds: number[] = JSON.parse(existingIdsString);

            // Shuffle the IDs
            const shuffledIds = [...recipeIds].sort(() => 0.5 - Math.random());
            const selectedIds = shuffledIds.slice(0, Math.min(count, shuffledIds.length));

            // Get the selected recipes
            const recipes: Recipe[] = [];
            for (const id of selectedIds) {
                const recipe = await this.getCachedRecipeById(id);
                if (recipe) {
                    recipes.push(recipe);
                }
            }

            console.log(`✅ Retrieved ${recipes.length} random cached recipes`);
            return recipes;
        } catch (error) {
            console.error(`❌ Error getting random cached recipes:`, error);
            return [];
        }
    }

    /**
     * Clear all recipe caches (useful for debugging or force refresh)
     */
    static async clearAllCaches(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(key =>
                key.startsWith(CACHE_KEYS.FEATURED_RECIPES) ||
                key.startsWith(CACHE_KEYS.CATEGORY_RECIPES) ||
                key.startsWith(CACHE_KEYS.RECIPES) ||
                key === CACHE_KEYS.RECIPE_IDS ||
                key === CACHE_KEYS.LAST_FETCH_DATE
            );

            await AsyncStorage.multiRemove(cacheKeys);
            console.log('🧹 All recipe caches cleared');
        } catch (error) {
            console.error('❌ Error clearing caches:', error);
        }
    }

    /**
     * Get cache status for debugging
     */
    static async getCacheStatus(): Promise<{
        featuredRecipes: boolean;
        cachedCategories: string[];
        totalCachedRecipes: number;
        currentDate: string;
    }> {
        const currentDate = this.getCurrentDateString();
        const featuredCache = await this.getCachedFeaturedRecipes();

        // Get all category cache keys
        const keys = await AsyncStorage.getAllKeys();
        const categoryKeys = keys.filter(key => key.startsWith(CACHE_KEYS.CATEGORY_RECIPES));
        const cachedCategories: string[] = [];

        for (const key of categoryKeys) {
            const categoryId = key.replace(CACHE_KEYS.CATEGORY_RECIPES, '');
            const cached = await this.getCachedCategoryRecipes(categoryId);
            if (cached) {
                cachedCategories.push(categoryId);
            }
        }

        // Get total cached recipes count
        const existingIdsString = await AsyncStorage.getItem(CACHE_KEYS.RECIPE_IDS);
        const recipeIds: number[] = existingIdsString ? JSON.parse(existingIdsString) : [];

        return {
            featuredRecipes: !!featuredCache,
            cachedCategories,
            totalCachedRecipes: recipeIds.length,
            currentDate,
        };
    }

    /**
     * Force refresh by clearing today's cache
     */
    static async forceRefresh(): Promise<void> {
        console.log('🔄 Force refreshing recipe caches...');
        await this.clearAllCaches();
    }
} 