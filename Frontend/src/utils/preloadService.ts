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
const NUM_RANDOM_RECIPES = 5;
const NUM_POPULAR_CATEGORIES = 3;
const POPULAR_CATEGORIES = ['breakfast', 'quick', 'healthy'];

/**
 * Main preload function to be called when user logs in
 * This function orchestrates all preloading activities
 */
export const preloadDataAfterLogin = async (): Promise<void> => {
    try {
        console.log('🔄 Starting data preloading after login...');

        // Start all preload operations concurrently for maximum efficiency
        await Promise.all([
            preloadAuthTokens(),
            preloadRecipeData(),
            preloadFoodDatabase(),
        ]);

        console.log('✅ All data preloading complete');
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

        // Prepare headers with Firebase token for backend calls
        const headers = {
            'Authorization': `Bearer ${firebaseToken}`,
            'Content-Type': 'application/json'
        };

        // Preload OpenAI token
        try {
            const openaiResponse = await axios.post(
                `${BACKEND_URL}/gpt/get-token`,
                {},
                { headers }
            );

            if (openaiResponse.data && openaiResponse.data.token) {
                // Store the token with expiry time
                await tokenManager.storeServiceToken(
                    'openai',
                    openaiResponse.data.token,
                    openaiResponse.data.expires_in || 3600
                );
                console.log('✅ OpenAI token preloaded');
            }
        } catch (error) {
            console.error('❌ Error preloading OpenAI token:', error);
        }

        // Preload DeepSeek token
        try {
            const deepseekResponse = await axios.post(
                `${BACKEND_URL}/deepseek/get-token`,
                {},
                { headers }
            );

            if (deepseekResponse.data && deepseekResponse.data.token) {
                // Store the token with expiry time
                await tokenManager.storeServiceToken(
                    'deepseek',
                    deepseekResponse.data.token,
                    deepseekResponse.data.expires_in || 3600
                );
                console.log('✅ DeepSeek token preloaded');
            }
        } catch (error) {
            console.error('❌ Error preloading DeepSeek token:', error);
        }

        // Preload FatSecret token
        try {
            const fatsecretResponse = await axios.post(
                `${BACKEND_URL}/food/get-token`,
                {},
                { headers }
            );

            if (fatsecretResponse.data && fatsecretResponse.data.token) {
                // Store the token with expiry time
                await tokenManager.storeServiceToken(
                    'fatsecret',
                    fatsecretResponse.data.token,
                    fatsecretResponse.data.expires_in || 3600
                );
                console.log('✅ FatSecret token preloaded');
            }
        } catch (error) {
            console.error('❌ Error preloading FatSecret token:', error);
        }

        // Preload Arli AI token if needed
        try {
            const arliResponse = await axios.post(
                `${BACKEND_URL}/arli-ai/get-token`,
                {},
                { headers }
            );

            if (arliResponse.data && arliResponse.data.token) {
                // Store the token with expiry time
                await tokenManager.storeServiceToken(
                    'arli_ai',
                    arliResponse.data.token,
                    arliResponse.data.expires_in || 3600
                );
                console.log('✅ Arli AI token preloaded');
            }
        } catch (error) {
            console.error('❌ Error preloading Arli AI token:', error);
        }

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
        console.log('🔄 Preloading recipe data...');

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
                const recipes = await searchRecipes({ query: category, number: 3 });
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

    } catch (error) {
        console.error('❌ Error preloading recipe data:', error);
        throw error;
    }
};

/**
 * Preload common food database items
 */
export const preloadFoodDatabase = async (): Promise<void> => {
    try {
        console.log('🔄 Preloading common food items...');

        // Create food_cache table if it doesn't exist
        const db = await getDatabase();
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS food_cache (
        id TEXT PRIMARY KEY,
        category TEXT,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

        // Common food search terms
        const commonFoods = ['apple', 'banana', 'chicken', 'rice', 'bread'];

        // Get Firebase token for API calls
        const firebaseToken = await tokenManager.getToken('firebase_auth');

        // Prepare headers with Firebase token
        const headers = {
            'Authorization': `Bearer ${firebaseToken}`,
            'Content-Type': 'application/json'
        };

        // Preload common foods
        for (const food of commonFoods) {
            try {
                const response = await axios.post(
                    `${BACKEND_URL}/food/search`,
                    { query: food, max_results: 5 },
                    { headers }
                );

                if (response.data && response.data.foods) {
                    console.log(`✅ Preloaded ${response.data.foods.length} ${food} items`);

                    // Store in database
                    for (const foodItem of response.data.foods) {
                        if (foodItem && typeof foodItem.food_id !== 'undefined') {
                            await db.runAsync(
                                `INSERT OR REPLACE INTO food_cache (id, category, data, timestamp)
               VALUES (?, ?, ?, ?)`,
                                [foodItem.food_id, food, JSON.stringify(foodItem), Date.now()]
                            );
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Error preloading ${food} items:`, error);
            }
        }

    } catch (error) {
        console.error('❌ Error preloading food database:', error);
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