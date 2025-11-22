import Constants from 'expo-constants';
import { supabase } from '../utils/supabaseClient';

// Get backend URL from environment or constants
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8000';

interface ApiRequestOptions extends RequestInit {
    timeout?: number;
    requiresAuth?: boolean;
}

class ApiClient {
    private baseUrl: string;
    private defaultTimeout: number;

    constructor(baseUrl: string, defaultTimeout: number = 10000) {
        this.baseUrl = baseUrl;
        this.defaultTimeout = defaultTimeout;
    }

    private async getHeaders(requiresAuth: boolean): Promise<HeadersInit> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (requiresAuth) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        }

        return headers;
    }

    async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        const { timeout = this.defaultTimeout, requiresAuth = true, ...fetchOptions } = options;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const headers = await this.getHeaders(requiresAuth);
            const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

            console.log(`📡 API Request: ${fetchOptions.method || 'GET'} ${url}`);

            const response = await fetch(url, {
                ...fetchOptions,
                headers: {
                    ...headers,
                    ...fetchOptions.headers,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorDetail = 'API request failed';
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorData.message || errorDetail;
                } catch (e) {
                    errorDetail = `${response.status} ${response.statusText}`;
                }

                // Handle 404 specifically if needed, or just throw
                if (response.status === 404) {
                    throw new Error('Not Found');
                }

                throw new Error(errorDetail);
            }

            // Return null for 204 No Content
            if (response.status === 204) {
                return null as unknown as T;
            }

            return await response.json();
        } catch (error: any) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                console.warn(`Request timed out after ${timeout}ms`);
                throw new Error('Connection to server timed out. Please try again later.');
            }

            console.warn('Network error:', error.message);
            if (error.message && (
                error.message.includes('Network request failed') ||
                error.message.includes('Failed to fetch') ||
                error.message.includes('Network error')
            )) {
                throw new Error('Network connection failed. Please check your internet connection and try again.');
            }

            throw error;
        }
    }

    async get<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    async post<T>(endpoint: string, data: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async put<T>(endpoint: string, data: any, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

export const apiClient = new ApiClient(BACKEND_URL);
