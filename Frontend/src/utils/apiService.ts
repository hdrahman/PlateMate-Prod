import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BACKEND_URL } from './config';
import tokenManager, { ServiceTokenType } from './tokenManager';

// Constants for request management
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

// Cache configuration - Extended for gym users who want long-lasting cache
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours (half a day) - much better for gym goers!
const MAX_CACHE_SIZE = 100; // Maximum number of cached responses

// Interface for cached response
interface CachedResponse<T> {
    data: T;
    timestamp: number;
}

// LRU Cache for API responses
class LRUCache<T> {
    private cache: Map<string, CachedResponse<T>> = new Map();
    private maxSize: number;

    constructor(maxSize: number = MAX_CACHE_SIZE) {
        this.maxSize = maxSize;
    }

    get(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        // Check if item is expired
        if (Date.now() - item.timestamp > CACHE_DURATION_MS) {
            this.cache.delete(key);
            return null;
        }

        // Move to front of LRU (by deleting and re-adding)
        this.cache.delete(key);
        this.cache.set(key, item);
        return item.data;
    }

    set(key: string, value: T): void {
        // Remove oldest item if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    clear(): void {
        this.cache.clear();
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    // Get all entries in the cache
    getEntries(): [string, CachedResponse<T>][] {
        return Array.from(this.cache.entries());
    }

    // Count recent items based on timestamp threshold
    countRecentItems(timestampThreshold: number): number {
        let count = 0;
        for (const [_, value] of this.cache.entries()) {
            if (value.timestamp > timestampThreshold) {
                count++;
            }
        }
        return count;
    }
}

// Create response caches for different endpoints
const recipeCache = new LRUCache<any>(50);
const foodItemCache = new LRUCache<any>(50);
const generalCache = new LRUCache<any>(50);

/**
 * Generate a cache key from request config
 */
const generateCacheKey = (config: AxiosRequestConfig): string => {
    const { method = 'GET', url = '', params = {}, data = {} } = config;
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
};

/**
 * Determine if a request should be cached
 */
const isCacheable = (config: AxiosRequestConfig): boolean => {
    // Only cache GET requests
    if (config.method?.toUpperCase() !== 'GET') return false;

    // Don't cache if explicitly disabled
    if (config.headers?.['x-no-cache']) return false;

    // Cache specific endpoints
    const url = config.url || '';
    return (
        url.includes('/recipes') ||
        url.includes('/food/search') ||
        url.includes('/food/details')
    );
};

/**
 * Get the appropriate cache for a request
 */
const getCache = (config: AxiosRequestConfig): LRUCache<any> => {
    const url = config.url || '';
    if (url.includes('/recipes')) return recipeCache;
    if (url.includes('/food')) return foodItemCache;
    return generalCache;
};

/**
 * Make a request with retry logic
 */
const makeRequestWithRetry = async <T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    retries: number = MAX_RETRY_ATTEMPTS
): Promise<AxiosResponse<T>> => {
    try {
        return await requestFn();
    } catch (error: any) {
        // Don't retry certain status codes
        if (error.response) {
            // Don't retry 400, 401, 403, 404
            if ([400, 401, 403, 404].includes(error.response.status)) {
                throw error;
            }
        }

        if (retries > 0) {
            console.log(`API request failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return makeRequestWithRetry(requestFn, retries - 1);
        }
        throw error;
    }
};

/**
 * API Service for making authenticated requests
 */
class ApiService {
    /**
     * Make a request to the backend API
     */
    public async request<T = any>(
        config: AxiosRequestConfig,
        options: {
            useCache?: boolean;
            serviceType?: ServiceTokenType;
            forceRefresh?: boolean;
        } = {}
    ): Promise<T> {
        const {
            useCache = true,
            serviceType = ServiceTokenType.SUPABASE_AUTH,
            forceRefresh = false
        } = options;

        // Start token initialization in parallel with other operations
        const tokenInitPromise = tokenManager.initialize();

        // Prepare the full config
        const fullConfig: AxiosRequestConfig = {
            baseURL: BACKEND_URL,
            timeout: REQUEST_TIMEOUT_MS,
            ...config
        };

        // Check cache first (before waiting for token) if enabled and not forcing refresh
        let cachedData = null;
        if (useCache && !forceRefresh && isCacheable(fullConfig)) {
            const cacheKey = generateCacheKey(fullConfig);
            const cache = getCache(fullConfig);
            cachedData = cache.get(cacheKey);

            if (cachedData) {
                console.log(`Using cached response for ${fullConfig.url}`);
                return cachedData;
            }
        }

        try {
            // Ensure token manager is initialized
            await tokenInitPromise;

            // Get the token
            const token = await tokenManager.getToken(serviceType);

            // Set authorization header
            fullConfig.headers = {
                ...fullConfig.headers,
                'Authorization': `Bearer ${token}`
            };

            // Make the request with retry logic
            const response = await makeRequestWithRetry<T>(() => axios(fullConfig));

            // Cache the response if applicable (do this in the background)
            if (useCache && isCacheable(fullConfig)) {
                const cacheKey = generateCacheKey(fullConfig);
                const cache = getCache(fullConfig);

                // Use setTimeout to make caching non-blocking
                setTimeout(() => {
                    cache.set(cacheKey, response.data);
                }, 0);
            }

            return response.data;
        } catch (error: any) {
            // Handle authentication errors
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.error('Authentication error:', error.response.data);
                // Could trigger auth refresh or logout flow here
            }

            // Log other errors
            console.error('API request error:', error);
            throw error;
        }
    }

    /**
     * GET request helper
     */
    public async get<T = any>(
        url: string,
        params?: any,
        options?: {
            useCache?: boolean;
            serviceType?: ServiceTokenType;
            forceRefresh?: boolean;
        }
    ): Promise<T> {
        return this.request<T>(
            {
                method: 'GET',
                url,
                params
            },
            options
        );
    }

    /**
     * POST request helper
     */
    public async post<T = any>(
        url: string,
        data?: any,
        options?: {
            useCache?: boolean;
            serviceType?: ServiceTokenType;
            forceRefresh?: boolean;
        }
    ): Promise<T> {
        return this.request<T>(
            {
                method: 'POST',
                url,
                data
            },
            options
        );
    }

    /**
     * PUT request helper
     */
    public async put<T = any>(
        url: string,
        data?: any,
        options?: {
            useCache?: boolean;
            serviceType?: ServiceTokenType;
            forceRefresh?: boolean;
        }
    ): Promise<T> {
        return this.request<T>(
            {
                method: 'PUT',
                url,
                data
            },
            options
        );
    }

    /**
     * DELETE request helper
     */
    public async delete<T = any>(
        url: string,
        params?: any,
        options?: {
            useCache?: boolean;
            serviceType?: ServiceTokenType;
            forceRefresh?: boolean;
        }
    ): Promise<T> {
        return this.request<T>(
            {
                method: 'DELETE',
                url,
                params
            },
            options
        );
    }

    /**
     * Clear all response caches
     */
    public clearCache(): void {
        recipeCache.clear();
        foodItemCache.clear();
        generalCache.clear();
        console.log('API response caches cleared');
    }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 