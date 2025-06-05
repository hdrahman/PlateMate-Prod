import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '../api/recipes';

// Cache keys
const CACHE_KEYS = {
    FEATURED_RECIPES: 'featured_recipes_cache',
    CATEGORY_RECIPES: 'category_recipes_cache_',
    LAST_FETCH_DATE: 'last_fetch_date',
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
     * Clear all recipe caches (useful for debugging or force refresh)
     */
    static async clearAllCaches(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(key =>
                key.startsWith(CACHE_KEYS.FEATURED_RECIPES) ||
                key.startsWith(CACHE_KEYS.CATEGORY_RECIPES) ||
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

        return {
            featuredRecipes: !!featuredCache,
            cachedCategories,
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