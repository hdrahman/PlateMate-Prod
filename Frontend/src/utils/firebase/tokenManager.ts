import { auth } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as base64decode } from 'base-64';
import { storeApiToken, getApiToken, deleteApiToken } from '../database';

interface TokenCache {
    token: string;
    expiryTime: number; // Expiry time in milliseconds
}

/**
 * Base64 decode function for React Native (replacement for atob)
 */
const base64Decode = (str: string): string => {
    try {
        // Add padding if needed
        const paddedStr = str.replace(/-/g, '+').replace(/_/g, '/');
        const padding = paddedStr.length % 4;
        const finalStr = padding ?
            paddedStr + '='.repeat(4 - padding) :
            paddedStr;

        // Use base-64 library for decoding
        return base64decode(finalStr);
    } catch (error) {
        console.error('Error decoding base64:', error);
        return '';
    }
};

/**
 * TokenManager - Handles caching and refreshing of authentication tokens
 * for various services to reduce latency in API calls while maintaining security
 */
class TokenManager {
    private static instance: TokenManager;
    private tokenCache: Map<string, TokenCache> = new Map();
    private tokenRefreshPromises: Map<string, Promise<string>> = new Map();

    // Time before expiry when we should refresh the token (5 minutes)
    private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

    // For development performance testing
    private logTimings = true;

    // Service names
    public static readonly FIREBASE_AUTH = 'firebase_auth';
    public static readonly OPENAI = 'openai';
    public static readonly DEEPSEEK = 'deepseek';
    public static readonly FATSECRET = 'fatsecret';
    public static readonly ARLI_AI = 'arli_ai';

    private constructor() {
        // Initialize by loading cached tokens from database
        this.initializeFromStorage();
    }

    public static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    /**
     * Initialize tokens from database if available
     */
    private async initializeFromStorage(): Promise<void> {
        try {
            // Load Firebase auth token from AsyncStorage for backward compatibility
            const cachedTokenJson = await AsyncStorage.getItem('@auth_token_cache');
            if (cachedTokenJson) {
                const cachedToken: TokenCache = JSON.parse(cachedTokenJson);

                // Only use the cached token if it's still valid with some margin
                if (cachedToken.expiryTime > Date.now() + this.REFRESH_THRESHOLD_MS) {
                    this.tokenCache.set(TokenManager.FIREBASE_AUTH, cachedToken);
                    console.log('Firebase token loaded from AsyncStorage, valid until:', new Date(cachedToken.expiryTime).toLocaleTimeString());

                    // Store in database for future use
                    await storeApiToken(
                        TokenManager.FIREBASE_AUTH,
                        cachedToken.token,
                        cachedToken.expiryTime
                    );
                } else {
                    console.log('Cached Firebase token expired, will request fresh token');
                }
            }

            // Try to load tokens from database for each service
            for (const service of [
                TokenManager.FIREBASE_AUTH,
                TokenManager.OPENAI,
                TokenManager.DEEPSEEK,
                TokenManager.FATSECRET,
                TokenManager.ARLI_AI
            ]) {
                const storedToken = await getApiToken(service);
                if (storedToken) {
                    // Parse expiry time from JWT if it's a Firebase token
                    let expiryTime: number;
                    if (service === TokenManager.FIREBASE_AUTH) {
                        expiryTime = this.getTokenExpiryTime(storedToken.token);
                    } else {
                        // For other services, we trust the stored expiry time
                        expiryTime = Date.now() + 3600 * 1000; // Default to 1 hour if we can't determine
                    }

                    this.tokenCache.set(service, {
                        token: storedToken.token,
                        expiryTime
                    });
                    console.log(`${service} token loaded from database, valid until:`, new Date(expiryTime).toLocaleTimeString());
                }
            }
        } catch (error) {
            console.error('Error loading tokens from storage:', error);
        }
    }

    /**
     * Parse Firebase JWT token to extract expiry time
     */
    private getTokenExpiryTime(token: string): number {
        try {
            // JWT tokens have 3 parts separated by dots
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }

            // Decode the payload (middle part)
            const payload = JSON.parse(base64Decode(parts[1]));

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
     * Fetch a fresh Firebase authentication token
     */
    private async fetchFreshFirebaseToken(): Promise<string> {
        if (this.logTimings) console.time('fetchFreshFirebaseToken');

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user');
            }

            const token = await user.getIdToken(true);
            const expiryTime = this.getTokenExpiryTime(token);

            this.tokenCache.set(TokenManager.FIREBASE_AUTH, { token, expiryTime });

            // Save to both AsyncStorage (for backward compatibility) and database
            await AsyncStorage.setItem('@auth_token_cache', JSON.stringify({ token, expiryTime }));
            await storeApiToken(TokenManager.FIREBASE_AUTH, token, expiryTime);

            console.log(`New Firebase token acquired, valid until: ${new Date(expiryTime).toLocaleTimeString()}`);

            return token;
        } catch (error) {
            console.error('Error fetching fresh Firebase token:', error);
            throw error;
        } finally {
            if (this.logTimings) console.timeEnd('fetchFreshFirebaseToken');
            this.tokenRefreshPromises.delete(TokenManager.FIREBASE_AUTH);
        }
    }

    /**
     * Get a valid Firebase authentication token, refreshing if needed
     */
    public async getToken(serviceName: string = TokenManager.FIREBASE_AUTH): Promise<string> {
        if (this.logTimings) console.time(`getToken_${serviceName}`);

        try {
            // Special handling for Firebase auth token
            if (serviceName === TokenManager.FIREBASE_AUTH) {
                return await this.getFirebaseAuthToken();
            }

            // For other services, just return from cache or null
            const cachedToken = this.tokenCache.get(serviceName);
            if (cachedToken && cachedToken.expiryTime > Date.now() + this.REFRESH_THRESHOLD_MS) {
                console.log(`Using cached ${serviceName} token`);
                return cachedToken.token;
            }

            // If no cached token or expired, try from database
            const storedToken = await getApiToken(serviceName);
            if (storedToken) {
                return storedToken.token;
            }

            throw new Error(`No token available for ${serviceName}`);
        } finally {
            if (this.logTimings) console.timeEnd(`getToken_${serviceName}`);
        }
    }

    /**
     * Get a valid Firebase authentication token, refreshing if needed
     */
    private async getFirebaseAuthToken(): Promise<string> {
        // If we're already refreshing a token, wait for that promise
        if (this.tokenRefreshPromises.has(TokenManager.FIREBASE_AUTH)) {
            console.log('Firebase token refresh already in progress, waiting...');
            return await this.tokenRefreshPromises.get(TokenManager.FIREBASE_AUTH)!;
        }

        // If we have a cached token that's not close to expiry, use it
        const cachedToken = this.tokenCache.get(TokenManager.FIREBASE_AUTH);
        if (cachedToken && cachedToken.expiryTime > Date.now() + this.REFRESH_THRESHOLD_MS) {
            console.log('Using cached Firebase token');
            return cachedToken.token;
        }

        // Start a new token refresh
        console.log('Firebase token expired or near expiry, refreshing...');
        const refreshPromise = this.fetchFreshFirebaseToken();
        this.tokenRefreshPromises.set(TokenManager.FIREBASE_AUTH, refreshPromise);
        return await refreshPromise;
    }

    /**
     * Store a token for a specific service
     */
    public async storeServiceToken(
        serviceName: string,
        token: string,
        expiryTimeInSeconds: number
    ): Promise<void> {
        try {
            const expiryTime = expiryTimeInSeconds * 1000; // Convert to milliseconds

            // Store in memory cache
            this.tokenCache.set(serviceName, {
                token,
                expiryTime
            });

            // Store in database
            await storeApiToken(serviceName, token, expiryTime);

            console.log(`Stored ${serviceName} token, valid until: ${new Date(expiryTime).toLocaleTimeString()}`);
        } catch (error) {
            console.error(`Error storing ${serviceName} token:`, error);
            throw error;
        }
    }

    /**
     * Get cached token immediately without refreshing (for non-critical operations)
     * Returns null if no valid token is cached
     */
    public getCachedToken(serviceName: string = TokenManager.FIREBASE_AUTH): string | null {
        const cachedToken = this.tokenCache.get(serviceName);
        if (cachedToken && cachedToken.expiryTime > Date.now()) {
            return cachedToken.token;
        }
        return null;
    }

    /**
     * Schedule background token refresh
     * Call this during app initialization to ensure tokens are always fresh
     */
    public initBackgroundRefresh(): void {
        // Check token status every minute
        setInterval(() => {
            this.checkAndRefreshToken();
        }, 60 * 1000);

        // Do an immediate check
        this.checkAndRefreshToken();
    }

    /**
     * Check if Firebase token needs refreshing and refresh in background if needed
     */
    private async checkAndRefreshToken(): Promise<void> {
        try {
            // If not authenticated, nothing to do
            if (!auth.currentUser) return;

            // If no token or token expires soon and we're not already refreshing
            const cachedToken = this.tokenCache.get(TokenManager.FIREBASE_AUTH);
            if ((!cachedToken || cachedToken.expiryTime <= Date.now() + this.REFRESH_THRESHOLD_MS) &&
                !this.tokenRefreshPromises.has(TokenManager.FIREBASE_AUTH)) {
                console.log('Proactively refreshing Firebase token in background');
                const refreshPromise = this.fetchFreshFirebaseToken();
                this.tokenRefreshPromises.set(TokenManager.FIREBASE_AUTH, refreshPromise);
                await refreshPromise;
            }
        } catch (error) {
            console.error('Background token refresh failed:', error);
        }
    }

    /**
     * Public method to trigger a background token refresh
     * Can be safely called from anywhere to ensure a fresh token is available
     */
    public refreshTokenInBackground(serviceName: string = TokenManager.FIREBASE_AUTH): void {
        if (serviceName === TokenManager.FIREBASE_AUTH) {
            setTimeout(() => {
                this.checkAndRefreshToken()
                    .catch(error => console.error('Error in refreshTokenInBackground:', error));
            }, 0);
        }
    }

    /**
     * Delete a token for a specific service
     */
    public async deleteServiceToken(serviceName: string): Promise<void> {
        try {
            // Remove from memory cache
            this.tokenCache.delete(serviceName);

            // Remove from database
            await deleteApiToken(serviceName);

            console.log(`Deleted ${serviceName} token`);
        } catch (error) {
            console.error(`Error deleting ${serviceName} token:`, error);
            throw error;
        }
    }
}

export const tokenManager = TokenManager.getInstance();
export default tokenManager; 