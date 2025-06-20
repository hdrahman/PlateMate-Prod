/**
 * PreloadService - Handles preloading of data when the user logs in
 * to improve app performance and user experience
 */

import { auth } from './firebase/index';
import tokenManager from './firebase/tokenManager';
import { getDatabase } from './database';
import axios from 'axios';
import { BACKEND_URL } from './config';
import { searchRecipes, getRandomRecipes } from '../api/recipes';

// Number of common recipes to preload
const NUM_RANDOM_RECIPES = 3;
const NUM_POPULAR_CATEGORIES = 2;
const POPULAR_CATEGORIES = ['breakfast', 'quick'];

/**
 * Main preload function to be called when user logs in
 * This function orchestrates all preloading activities
 */
export const preloadDataAfterLogin = async (): Promise<void> => {
    try {
        console.log('🔄 Starting data preloading after login...');

        // Only preload auth tokens immediately for faster login
        await preloadAuthTokens();

        // Preload recipe data in the background after a slight delay
        // This improves initial login UX by not blocking with non-essential data
        setTimeout(() => {
            preloadRecipeData().catch(error => {
                console.error('❌ Background recipe preloading error:', error);
            });
        }, 2000);

        console.log('✅ Essential data preloading complete');
    } catch (error) {
        console.error('❌ Error during data preloading:', error);
        // We don't throw here - preloading failures shouldn't block the app
    }
};

/**
 * Preload authentication tokens for all services
 */
export const preloadAuthTokens = async (): Promise<void> => {
    try {
        console.log('🔄 Preloading authentication tokens...');

        // Ensure user is logged in
        const user = auth.currentUser;
        if (!user) {
            console.log('⚠️ No authenticated user, skipping token preloading');
            return;
        }

        // Get Firebase auth token first (this is required for other API calls)
        const firebaseToken = await tokenManager.getToken('firebase_auth');
        console.log('✅ Firebase token preloaded');

    } catch (error) {
        console.error('❌ Error preloading authentication tokens:', error);
        throw error;
    }
};

/**
 * Preload recipe data
 */
export const preloadRecipeData = async (): Promise<void> => {
    try {
        console.log('🔄 Preloading recipe data in background...');

        // Create recipe_cache table if it doesn't exist
        const db = await getDatabase();
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recipe_cache (
        id TEXT PRIMARY KEY,
        category TEXT,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

        // Check if we already have fresh cached data (less than 12 hours old)
        const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
        const freshCacheCount = await db.getFirstAsync(
            `SELECT COUNT(*) as count FROM recipe_cache WHERE timestamp > ?`,
            [twelveHoursAgo]
        ) as { count: number };

        if (freshCacheCount && freshCacheCount.count > 10) {
            console.log('✅ Using existing fresh recipe cache, skipping preload');
            return;
        }

        // Preload random recipes
        try {
            const randomRecipes = await getRandomRecipes(NUM_RANDOM_RECIPES);
            if (randomRecipes && randomRecipes.length > 0) {
                console.log(`✅ Preloaded ${randomRecipes.length} random recipes`);

                // Store in database
                for (const recipe of randomRecipes) {
                    await db.runAsync(
                        `INSERT OR REPLACE INTO recipe_cache (id, category, data, timestamp)
             VALUES (?, ?, ?, ?)`,
                        [recipe.id, 'random', JSON.stringify(recipe), Date.now()]
                    );
                }
            }
        } catch (error) {
            console.error('❌ Error preloading random recipes:', error);
        }

        // Preload popular categories
        for (const category of POPULAR_CATEGORIES) {
            try {
                const recipes = await searchRecipes(category, 3);
                if (recipes && recipes.length > 0) {
                    console.log(`✅ Preloaded ${recipes.length} ${category} recipes`);

                    // Store in database
                    for (const recipe of recipes) {
                        await db.runAsync(
                            `INSERT OR REPLACE INTO recipe_cache (id, category, data, timestamp)
               VALUES (?, ?, ?, ?)`,
                            [recipe.id, category, JSON.stringify(recipe), Date.now()]
                        );
                    }
                }
            } catch (error) {
                console.error(`❌ Error preloading ${category} recipes:`, error);
            }
        }

        // Clean up old cached data in the background
        setTimeout(() => {
            cleanupOldCachedData().catch(err => {
                console.error('Error cleaning up old cache:', err);
            });
        }, 5000);

    } catch (error) {
        console.error('❌ Error preloading recipe data:', error);
        throw error;
    }
};

/**
 * Get cached recipes by category
 */
export const getCachedRecipesByCategory = async (category: string): Promise<any[]> => {
    try {
        const db = await getDatabase();

        const results = await db.getAllAsync(
            `SELECT data FROM recipe_cache WHERE category = ? ORDER BY timestamp DESC`,
            [category]
        );

        return results.map((row: any) => {
            if (row && typeof row.data === 'string') {
                return JSON.parse(row.data);
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        console.error(`❌ Error getting cached ${category} recipes:`, error);
        return [];
    }
};

/**
 * Get cached food items by category
 */
export const getCachedFoodsByCategory = async (category: string): Promise<any[]> => {
    try {
        const db = await getDatabase();

        const results = await db.getAllAsync(
            `SELECT data FROM food_cache WHERE category = ? ORDER BY timestamp DESC`,
            [category]
        );

        return results.map((row: any) => {
            if (row && typeof row.data === 'string') {
                return JSON.parse(row.data);
            }
            return null;
        }).filter(Boolean);
    } catch (error) {
        console.error(`❌ Error getting cached ${category} food items:`, error);
        return [];
    }
};

/**
 * Clean up old cached data (older than 24 hours)
 */
export const cleanupOldCachedData = async (): Promise<void> => {
    try {
        const db = await getDatabase();
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        // Clean up old recipe cache
        await db.runAsync(
            `DELETE FROM recipe_cache WHERE timestamp < ?`,
            [oneDayAgo]
        );

        // Clean up old food cache
        await db.runAsync(
            `DELETE FROM food_cache WHERE timestamp < ?`,
            [oneDayAgo]
        );

        console.log('✅ Cleaned up old cached data');
    } catch (error) {
        console.error('❌ Error cleaning up old cached data:', error);
    }
}; 