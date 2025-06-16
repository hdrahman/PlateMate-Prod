import { auth } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as base64decode } from 'base-64';

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
 * TokenManager - Handles caching and refreshing of Firebase authentication tokens
 * to reduce latency in API calls while maintaining security
 */
class TokenManager {
    private static instance: TokenManager;
    private tokenCache: TokenCache | null = null;
    private tokenRefreshPromise: Promise<string> | null = null;

    // Time before expiry when we should refresh the token (5 minutes)
    private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

    // For development performance testing
    private logTimings = true;

    private constructor() {
        // Initialize by loading any cached token from storage
        this.initializeFromStorage();
    }

    public static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    /**
     * Initialize token from AsyncStorage if available
     */
    private async initializeFromStorage(): Promise<void> {
        try {
            const cachedTokenJson = await AsyncStorage.getItem('@auth_token_cache');
            if (cachedTokenJson) {
                const cachedToken: TokenCache = JSON.parse(cachedTokenJson);

                // Only use the cached token if it's still valid with some margin
                if (cachedToken.expiryTime > Date.now() + this.REFRESH_THRESHOLD_MS) {
                    this.tokenCache = cachedToken;
                    console.log('Token loaded from storage, valid until:', new Date(cachedToken.expiryTime).toLocaleTimeString());
                } else {
                    console.log('Cached token expired, will request fresh token');
                }
            }
        } catch (error) {
            console.error('Error loading token from storage:', error);
        }
    }

    /**
     * Save token to AsyncStorage for persistence
     */
    private async saveTokenToStorage(tokenCache: TokenCache): Promise<void> {
        try {
            await AsyncStorage.setItem('@auth_token_cache', JSON.stringify(tokenCache));
        } catch (error) {
            console.error('Error saving token to storage:', error);
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
     * Fetch a fresh token from Firebase
     */
    private async fetchFreshToken(): Promise<string> {
        if (this.logTimings) console.time('fetchFreshToken');

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user');
            }

            const token = await user.getIdToken(true);
            const expiryTime = this.getTokenExpiryTime(token);

            this.tokenCache = { token, expiryTime };

            // Save to storage for persistence
            await this.saveTokenToStorage(this.tokenCache);

            console.log(`New token acquired, valid until: ${new Date(expiryTime).toLocaleTimeString()}`);

            return token;
        } catch (error) {
            console.error('Error fetching fresh token:', error);
            throw error;
        } finally {
            if (this.logTimings) console.timeEnd('fetchFreshToken');
            this.tokenRefreshPromise = null;
        }
    }

    /**
     * Get a valid authentication token, refreshing if needed
     */
    public async getToken(): Promise<string> {
        if (this.logTimings) console.time('getToken');

        try {
            // If we're already refreshing a token, wait for that promise
            if (this.tokenRefreshPromise) {
                console.log('Token refresh already in progress, waiting...');
                return await this.tokenRefreshPromise;
            }

            // If we have a cached token that's not close to expiry, use it
            if (this.tokenCache && this.tokenCache.expiryTime > Date.now() + this.REFRESH_THRESHOLD_MS) {
                console.log('Using cached token');
                return this.tokenCache.token;
            }

            // Start a new token refresh
            console.log('Token expired or near expiry, refreshing...');
            this.tokenRefreshPromise = this.fetchFreshToken();
            return await this.tokenRefreshPromise;
        } finally {
            if (this.logTimings) console.timeEnd('getToken');
        }
    }

    /**
     * Get cached token immediately without refreshing (for non-critical operations)
     * Returns null if no valid token is cached
     */
    public getCachedToken(): string | null {
        if (this.tokenCache && this.tokenCache.expiryTime > Date.now()) {
            return this.tokenCache.token;
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
     * Check if token needs refreshing and refresh in background if needed
     */
    private async checkAndRefreshToken(): Promise<void> {
        try {
            // If not authenticated, nothing to do
            if (!auth.currentUser) return;

            // If no token or token expires soon and we're not already refreshing
            if ((!this.tokenCache || this.tokenCache.expiryTime <= Date.now() + this.REFRESH_THRESHOLD_MS) &&
                !this.tokenRefreshPromise) {
                console.log('Proactively refreshing token in background');
                this.tokenRefreshPromise = this.fetchFreshToken();
                await this.tokenRefreshPromise;
            }
        } catch (error) {
            console.error('Background token refresh failed:', error);
        }
    }
}

export const tokenManager = TokenManager.getInstance();
export default tokenManager; 