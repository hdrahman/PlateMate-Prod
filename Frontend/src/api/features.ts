import { BACKEND_URL } from '../utils/config';
import { supabase } from '../utils/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { isBackendAvailable } from '../utils/networkUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface FeatureRequest {
    id: string;
    title: string;
    description: string;
    status: 'submitted' | 'in_review' | 'in_progress' | 'completed' | 'rejected';
    upvotes: number;
    created_at: string;
    updated_at: string;
    user_upvoted: boolean;
    author_name: string;
}

export interface FeatureRequestCreate {
    title: string;
    description: string;
}

export interface FeatureRequestUpdate {
    title?: string;
    description?: string;
}

export interface FeatureStatusUpdate {
    status: string;
    admin_comment?: string;
}

export interface FeatureRequestStats {
    submitted: number;
    in_review: number;
    in_progress: number;
    completed: number;
    rejected: number;
    total: number;
    total_upvotes: number;
}

// Backend API base URL
const BACKEND_BASE_URL = BACKEND_URL;

/**
 * Get authorization headers for backend API calls
 */
const getAuthHeaders = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('User not authenticated');
        }

        return {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        };
    } catch (error) {
        console.error('Error getting auth headers:', error);
        throw error;
    }
};

/**
 * Check if backend is available
 */
const checkBackendHealth = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${BACKEND_BASE_URL}/health`, {
            method: 'GET',
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('Backend health check failed:', error);
        return false;
    }
};

/**
 * Create a new feature request
 */
export const createFeatureRequest = async (request: FeatureRequestCreate): Promise<{ success: boolean; message: string; data?: any }> => {
    try {
        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/`, {
            method: 'POST',
            headers,
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            let errorMessage = 'Failed to create feature request';
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
                
                // Handle specific HTTP status codes
                if (response.status === 401) {
                    errorMessage = 'Authentication error: Please log in again';
                } else if (response.status === 403) {
                    errorMessage = 'Permission denied: Unable to create feature request';
                } else if (response.status === 422) {
                    errorMessage = 'Validation error: Please check your input and try again';
                } else if (response.status >= 500) {
                    errorMessage = 'Server error: Please try again later';
                }
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                // Use default error message if response can't be parsed
            }
            
            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error creating feature request:', error);
        
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Network error: Please check your connection and try again');
        }
        
        throw error;
    }
};

/**
 * Get feature requests with optional status filter
 */
export const getFeatureRequests = async (
    status?: string,
    limit: number = 50,
    offset: number = 0
): Promise<FeatureRequest[]> => {
    try {
        // Check backend health first
        const isHealthy = await checkBackendHealth();
        if (!isHealthy) {
            throw new Error('Backend service is currently unavailable');
        }

        const headers = await getAuthHeaders();
        
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        params.append('limit', limit.toString());
        params.append('offset', offset.toString());
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/?${params}`, {
            headers
        });

        if (!response.ok) {
            let errorMessage = 'Failed to fetch feature requests';
            
            try {
                if (response.status === 404) {
                    errorMessage = 'Feature requests service not found - please check if the database is set up correctly';
                } else if (response.status === 401) {
                    errorMessage = 'Authentication error: Please log in again';
                } else if (response.status === 403) {
                    errorMessage = 'Permission denied: Unable to access feature requests';
                } else if (response.status >= 500) {
                    errorMessage = 'Server error: Please try again later';
                } else {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorMessage;
                }
            } catch (parseError) {
                console.error('Error parsing error response:', parseError);
                // Use default error message
            }
            
            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error fetching feature requests:', error);
        
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Network error: Please check your connection and try again');
        }
        
        throw error;
    }
};

/**
 * Get feature requests created by the current user
 */
export const getMyFeatureRequests = async (): Promise<FeatureRequest[]> => {
    try {
        // Check backend health first
        const isHealthy = await checkBackendHealth();
        if (!isHealthy) {
            throw new Error('Backend service is currently unavailable');
        }

        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/my-requests`, {
            headers
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Feature requests service not found - backend may need update');
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch user feature requests');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error fetching user feature requests:', error);
        throw error;
    }
};

/**
 * Toggle upvote for a feature request
 */
export const toggleFeatureUpvote = async (requestId: string): Promise<{ success: boolean; message: string; upvoted: boolean }> => {
    try {
        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/${requestId}/upvote`, {
            method: 'POST',
            headers
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to toggle upvote');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error toggling upvote:', error);
        throw error;
    }
};

/**
 * Update a feature request
 */
export const updateFeatureRequest = async (
    requestId: string,
    updateData: FeatureRequestUpdate
): Promise<{ success: boolean; message: string; data?: any }> => {
    try {
        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/${requestId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update feature request');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating feature request:', error);
        throw error;
    }
};

/**
 * Delete a feature request
 */
export const deleteFeatureRequest = async (requestId: string): Promise<{ success: boolean; message: string }> => {
    try {
        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/${requestId}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete feature request');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error deleting feature request:', error);
        throw error;
    }
};

/**
 * Update feature request status (admin only)
 */
export const updateFeatureStatus = async (
    requestId: string,
    statusUpdate: FeatureStatusUpdate
): Promise<{ success: boolean; message: string; data?: any }> => {
    try {
        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/${requestId}/status`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(statusUpdate)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update feature status');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating feature status:', error);
        throw error;
    }
};

/**
 * Get feature request statistics
 */
export const getFeatureRequestStats = async (): Promise<FeatureRequestStats> => {
    try {
        const headers = await getAuthHeaders();
        
        const response = await fetch(`${BACKEND_BASE_URL}/feature-requests/stats`, {
            headers
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch feature request stats');
        }

        const result = await response.json();
        return result.stats;
    } catch (error) {
        console.error('Error fetching feature request stats:', error);
        throw error;
    }
};

// Real-time subscription management
export class FeatureRequestsRealtime {
    private channel: RealtimeChannel | null = null;
    private callbacks: {
        onFeatureRequestChange?: (payload: any) => void;
        onUpvoteChange?: (payload: any) => void;
        onStatusChange?: (payload: any) => void;
    } = {};

    /**
     * Subscribe to real-time feature request changes
     */
    subscribe(callbacks: {
        onFeatureRequestChange?: (payload: any) => void;
        onUpvoteChange?: (payload: any) => void;
        onStatusChange?: (payload: any) => void;
    }) {
        this.callbacks = callbacks;
        
        // Create a unique channel name
        const channelName = `feature-requests-${Date.now()}`;
        
        this.channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'feature_requests'
                },
                (payload) => {
                    console.log('Feature request change:', payload);
                    this.callbacks.onFeatureRequestChange?.(payload);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'feature_upvotes'
                },
                (payload) => {
                    console.log('Upvote change:', payload);
                    this.callbacks.onUpvoteChange?.(payload);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'feature_status_updates'
                },
                (payload) => {
                    console.log('Status change:', payload);
                    this.callbacks.onStatusChange?.(payload);
                }
            )
            .subscribe((status) => {
                console.log('Feature requests realtime status:', status);
            });

        return this.channel;
    }

    /**
     * Unsubscribe from real-time changes
     */
    unsubscribe() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return this.channel?.state || 'disconnected';
    }
}

// Export a singleton instance
export const featureRequestsRealtime = new FeatureRequestsRealtime();

// Network status utility
export const isOnline = async () => {
    // Use the proper network utility for React Native
    try {
        return await isBackendAvailable();
    } catch (error) {
        console.error('Error checking network status:', error);
        return false;
    }
};

// Offline graceful degradation
export const getFeatureRequestsOffline = async (): Promise<FeatureRequest[]> => {
    // Return cached data if available
    try {
        const cachedData = await AsyncStorage.getItem('feature_requests_cache');
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            // Return cached data if it's less than 5 minutes old
            if (Date.now() - timestamp < 5 * 60 * 1000) {
                return data;
            }
        }
    } catch (error) {
        console.error('Error reading cached feature requests:', error);
    }
    
    return [];
};

// Cache feature requests for offline use
export const cacheFeatureRequests = async (requests: FeatureRequest[]) => {
    try {
        const cacheData = {
            data: requests,
            timestamp: Date.now()
        };
        await AsyncStorage.setItem('feature_requests_cache', JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error caching feature requests:', error);
    }
}; 