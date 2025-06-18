import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BACKEND_URL } from './config';
import { getDatabase } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase/index';
import { decode as base64decode } from 'base-64';

// Constants for token management
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Service names for different API tokens
export enum ServiceTokenType {
    FIREBASE_AUTH = 'firebase_auth',
    OPENAI = 'openai',
    DEEPSEEK = 'deepseek',
    FATSECRET = 'fatsecret',
    ARLI_AI = 'arli_ai',
}

// Interface for token data
interface TokenData {
    token: string;
    expiryTime: number;
    tokenType: string;
}

// Cache for API clients
const apiClientCache: Record<string, AxiosInstance> = {};

/**
 * TokenManager class - Handles token acquisition, caching, and API client creation
 */
class TokenManager {
    private static instance: TokenManager;
    private tokenCache: Map<string, TokenData> = new Map();
    private tokenRefreshPromises: Map<string, Promise<string>> = new Map();
    private isInitialized = false;

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    /**
     * Initialize the token manager by loading cached tokens
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('🔄 Initializing TokenManager...');

            // Load tokens from SQLite database
            await this.loadTokensFromDatabase();

            // Also try to load Firebase token from AsyncStorage for backward compatibility
            await this.loadFirebaseTokenFromAsyncStorage();

            this.isInitialized = true;
            console.log('✅ TokenManager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing TokenManager:', error);
            // Don't throw - allow app to continue even if token loading fails
        }
    }

    /**
     * Load tokens from SQLite database
     */
    private async loadTokensFromDatabase(): Promise<void> {
        try {
            const db = await getDatabase();

            const results = await db.getAllAsync(
                `SELECT service_name, token, token_type, expiry_time FROM api_tokens`
            );

            for (const row of results) {
                const serviceName = (row as any).service_name;
                const token = (row as any).token;
                const tokenType = (row as any).token_type;
                const expiryTime = (row as any).expiry_time;

                // Only store if not expired or close to expiry
                if (expiryTime > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) {
                    this.tokenCache.set(serviceName, {
                        token,
                        expiryTime,
                        tokenType
                    });
                    console.log(`Loaded token for ${serviceName} from database, valid until ${new Date(expiryTime).toLocaleTimeString()}`);
                } else {
                    console.log(`Token for ${serviceName} is expired or near expiry, will refresh`);
                }
            }
        } catch (error) {
            console.error('Error loading tokens from database:', error);
        }
    }

    /**
     * Load Firebase token from AsyncStorage for backward compatibility
     */
    private async loadFirebaseTokenFromAsyncStorage(): Promise<void> {
        try {
            const cachedTokenJson = await AsyncStorage.getItem('@auth_token_cache');
            if (cachedTokenJson) {
                const cachedToken = JSON.parse(cachedTokenJson);

                if (cachedToken.expiryTime > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) {
                    this.tokenCache.set(ServiceTokenType.FIREBASE_AUTH, {
                        token: cachedToken.token,
                        expiryTime: cachedToken.expiryTime,
                        tokenType: 'Bearer'
                    });
                    console.log('Firebase token loaded from AsyncStorage');

                    // Store in database for future use
                    await this.storeTokenInDatabase(
                        ServiceTokenType.FIREBASE_AUTH,
                        cachedToken.token,
                        cachedToken.expiryTime,
                        'Bearer'
                    );
                }
            }
        } catch (error) {
            console.error('Error loading Firebase token from AsyncStorage:', error);
        }
    }

    /**
     * Store token in SQLite database
     */
    private async storeTokenInDatabase(
        serviceName: string,
        token: string,
        expiryTime: number,
        tokenType: string = 'Bearer'
    ): Promise<void> {
        try {
            const db = await getDatabase();

            // Check if token already exists
            const existingResult = await db.getAllAsync(
                `SELECT id FROM api_tokens WHERE service_name = ?`,
                [serviceName]
            );

            if (existingResult.length > 0) {
                // Update existing token
                await db.runAsync(
                    `UPDATE api_tokens 
           SET token = ?, token_type = ?, expiry_time = ?, updated_at = datetime('now')
           WHERE service_name = ?`,
                    [token, tokenType, expiryTime, serviceName]
                );
            } else {
                // Insert new token
                await db.runAsync(
                    `INSERT INTO api_tokens (service_name, token, token_type, expiry_time)
           VALUES (?, ?, ?, ?)`,
                    [serviceName, token, tokenType, expiryTime]
                );
            }
        } catch (error) {
            console.error(`Error storing token for ${serviceName} in database:`, error);
            // Don't throw - token is still in memory cache
        }
    }

    /**
     * Get a token for a specific service
     */
    public async getToken(serviceName: string): Promise<string> {
        // If we're already refreshing this token, wait for that promise
        if (this.tokenRefreshPromises.has(serviceName)) {
            return this.tokenRefreshPromises.get(serviceName)!;
        }

        // Check if we have a valid cached token
        const cachedToken = this.tokenCache.get(serviceName);
        if (cachedToken && cachedToken.expiryTime > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) {
            return cachedToken.token;
        }

        // For Firebase auth, we need to refresh the token
        if (serviceName === ServiceTokenType.FIREBASE_AUTH) {
            return this.refreshFirebaseToken();
        }

        // For other services, we need to fetch from the backend
        return this.fetchServiceToken(serviceName);
    }

    /**
     * Refresh Firebase authentication token
     */
    private async refreshFirebaseToken(): Promise<string> {
        // Create a promise for this refresh operation
        const refreshPromise = (async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('No authenticated user');
                }

                const token = await user.getIdToken(true);

                // Parse expiry time from JWT
                const expiryTime = this.getTokenExpiryTime(token);

                // Store in memory cache
                this.tokenCache.set(ServiceTokenType.FIREBASE_AUTH, {
                    token,
                    expiryTime,
                    tokenType: 'Bearer'
                });

                // Store in AsyncStorage for backward compatibility
                await AsyncStorage.setItem('@auth_token_cache', JSON.stringify({
                    token,
                    expiryTime
                }));

                // Store in database
                await this.storeTokenInDatabase(
                    ServiceTokenType.FIREBASE_AUTH,
                    token,
                    expiryTime,
                    'Bearer'
                );

                console.log(`New Firebase token acquired, valid until: ${new Date(expiryTime).toLocaleTimeString()}`);

                return token;
            } catch (error) {
                console.error('Error refreshing Firebase token:', error);
                throw error;
            } finally {
                // Remove this promise from the map
                this.tokenRefreshPromises.delete(ServiceTokenType.FIREBASE_AUTH);
            }
        })();

        // Store the promise so concurrent calls can use it
        this.tokenRefreshPromises.set(ServiceTokenType.FIREBASE_AUTH, refreshPromise);

        return refreshPromise;
    }

    /**
     * Fetch a token for a service from the backend
     */
    private async fetchServiceToken(serviceName: string): Promise<string> {
        // Create a promise for this fetch operation
        const fetchPromise = (async () => {
            try {
                // First, we need a valid Firebase token
                const firebaseToken = await this.getToken(ServiceTokenType.FIREBASE_AUTH);

                // Determine the endpoint based on service name
                let endpoint: string;
                switch (serviceName) {
                    case ServiceTokenType.OPENAI:
                        endpoint = '/gpt/get-token';
                        break;
                    case ServiceTokenType.DEEPSEEK:
                        endpoint = '/deepseek/get-token';
                        break;
                    case ServiceTokenType.FATSECRET:
                        endpoint = '/food/get-token';
                        break;
                    case ServiceTokenType.ARLI_AI:
                        endpoint = '/arli-ai/get-token';
                        break;
                    default:
                        throw new Error(`Unknown service: ${serviceName}`);
                }

                // Make the request with retry logic
                const response = await this.makeRequestWithRetry(async () => {
                    return axios.post(
                        `${BACKEND_URL}${endpoint}`,
                        {},
                        {
                            headers: {
                                'Authorization': `Bearer ${firebaseToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                });

                if (response.data && response.data.token) {
                    const token = response.data.token;
                    const expiryTimeSeconds = response.data.expires_in || 3600;
                    const expiryTime = Date.now() + (expiryTimeSeconds * 1000);
                    const tokenType = response.data.token_type || 'Bearer';

                    // Store in memory cache
                    this.tokenCache.set(serviceName, {
                        token,
                        expiryTime,
                        tokenType
                    });

                    // Store in database
                    await this.storeTokenInDatabase(
                        serviceName,
                        token,
                        expiryTime,
                        tokenType
                    );

                    console.log(`New ${serviceName} token acquired, valid until: ${new Date(expiryTime).toLocaleTimeString()}`);

                    return token;
                } else {
                    throw new Error(`Invalid token response for ${serviceName}`);
                }
            } catch (error) {
                console.error(`Error fetching ${serviceName} token:`, error);
                throw error;
            } finally {
                // Remove this promise from the map
                this.tokenRefreshPromises.delete(serviceName);
            }
        })();

        // Store the promise so concurrent calls can use it
        this.tokenRefreshPromises.set(serviceName, fetchPromise);

        return fetchPromise;
    }

    /**
     * Make a request with retry logic
     */
    private async makeRequestWithRetry<T>(
        requestFn: () => Promise<T>,
        retries: number = MAX_RETRY_ATTEMPTS
    ): Promise<T> {
        try {
            return await requestFn();
        } catch (error) {
            if (retries > 0) {
                console.log(`Request failed, retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return this.makeRequestWithRetry(requestFn, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Parse JWT token to extract expiry time
     */
    private getTokenExpiryTime(token: string): number {
        try {
            // JWT tokens have 3 parts separated by dots
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }

            // Decode the payload (middle part)
            const payload = JSON.parse(this.decodeBase64(parts[1]));

            // Firebase tokens have 'exp' claim with expiry timestamp in seconds
            if (payload.exp) {
                return payload.exp * 1000; // Convert to milliseconds
            }

            throw new Error('No expiry found in token');
        } catch (error) {
            console.error('Error parsing token expiry:', error);
            // Default to 1 hour from now if we can't parse
            return Date.now() + 3600 * 1000;
        }
    }

    /**
     * Decode base64 string
     */
    private decodeBase64(str: string): string {
        // Add padding if needed
        const paddedStr = str.replace(/-/g, '+').replace(/_/g, '/');
        const padding = paddedStr.length % 4;
        const finalStr = padding ?
            paddedStr + '='.repeat(4 - padding) :
            paddedStr;

        return base64decode(finalStr);
    }

    /**
     * Get an API client for a specific service
     * This creates or reuses an Axios instance with the proper auth token
     */
    public async getApiClient(serviceName: string): Promise<AxiosInstance> {
        // Check if we have a cached client
        if (apiClientCache[serviceName]) {
            return apiClientCache[serviceName];
        }

        // Create a new client
        const client = axios.create({
            baseURL: BACKEND_URL,
            timeout: 30000, // 30 seconds
        });

        // Add request interceptor to inject token
        client.interceptors.request.use(async (config) => {
            try {
                const token = await this.getToken(serviceName);
                const tokenData = this.tokenCache.get(serviceName);
                const tokenType = tokenData?.tokenType || 'Bearer';

                config.headers['Authorization'] = `${tokenType} ${token}`;
            } catch (error) {
                console.error(`Error getting token for ${serviceName}:`, error);
            }
            return config;
        });

        // Add response interceptor to handle token errors
        client.interceptors.response.use(
            (response) => response,
            async (error) => {
                // Handle 401/403 errors by refreshing token and retrying
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    try {
                        // Force token refresh
                        if (serviceName === ServiceTokenType.FIREBASE_AUTH) {
                            await this.refreshFirebaseToken();
                        } else {
                            // Clear token from cache to force refresh
                            this.tokenCache.delete(serviceName);
                            await this.fetchServiceToken(serviceName);
                        }

                        // Retry the original request
                        const originalRequest = error.config;
                        return client(originalRequest);
                    } catch (refreshError) {
                        console.error(`Error refreshing token for ${serviceName}:`, refreshError);
                        return Promise.reject(error);
                    }
                }

                return Promise.reject(error);
            }
        );

        // Cache the client
        apiClientCache[serviceName] = client;

        return client;
    }

    /**
     * Make an authenticated API request
     */
    public async request<T>(
        serviceName: string,
        config: AxiosRequestConfig
    ): Promise<T> {
        const client = await this.getApiClient(serviceName);
        const response = await client(config);
        return response.data;
    }

    /**
     * Delete a token for a specific service
     */
    public async deleteToken(serviceName: string): Promise<void> {
        try {
            // Remove from memory cache
            this.tokenCache.delete(serviceName);

            // Remove from database
            const db = await getDatabase();
            await db.runAsync(
                `DELETE FROM api_tokens WHERE service_name = ?`,
                [serviceName]
            );

            // If it's Firebase token, also remove from AsyncStorage
            if (serviceName === ServiceTokenType.FIREBASE_AUTH) {
                await AsyncStorage.removeItem('@auth_token_cache');
            }

            console.log(`Deleted token for ${serviceName}`);
        } catch (error) {
            console.error(`Error deleting token for ${serviceName}:`, error);
            throw error;
        }
    }

    /**
     * Clear all tokens (used during logout)
     */
    public async clearAllTokens(): Promise<void> {
        try {
            // Clear memory cache
            this.tokenCache.clear();

            // Clear database
            const db = await getDatabase();
            await db.runAsync(`DELETE FROM api_tokens`);

            // Clear AsyncStorage
            await AsyncStorage.removeItem('@auth_token_cache');

            // Clear API client cache
            Object.keys(apiClientCache).forEach(key => {
                delete apiClientCache[key];
            });

            console.log('All tokens cleared');
        } catch (error) {
            console.error('Error clearing all tokens:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();
export default tokenManager; 