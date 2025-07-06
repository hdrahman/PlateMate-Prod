import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import {
    FeatureRequest,
    getFeatureRequests,
    getMyFeatureRequests,
    featureRequestsRealtime,
    isOnline,
    getFeatureRequestsOffline,
    cacheFeatureRequests
} from '../api/features';

export interface UseFeatureRequestsOptions {
    status?: string;
    autoRefresh?: boolean;
    cacheEnabled?: boolean;
}

export interface UseFeatureRequestsReturn {
    requests: FeatureRequest[];
    isLoading: boolean;
    isRefreshing: boolean;
    error: string | null;
    connectionStatus: string;
    networkStatus: boolean;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
    handleUpvoteChange: (requestId: string, newUpvoteStatus: boolean) => void;
}

export const useFeatureRequests = (options: UseFeatureRequestsOptions = {}): UseFeatureRequestsReturn => {
    const { status, autoRefresh = true, cacheEnabled = true } = options;
    
    // State
    const [requests, setRequests] = useState<FeatureRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [networkStatus, setNetworkStatus] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);

    // Load data function
    const loadData = useCallback(async (isRefresh = false, loadOffset = 0) => {
        if (isRefresh) {
            setIsRefreshing(true);
            setError(null);
        } else if (loadOffset === 0) {
            setIsLoading(true);
            setError(null);
        }

        try {
            let data: FeatureRequest[] = [];
            
            if (!networkStatus) {
                // Use cached data when offline
                if (cacheEnabled && loadOffset === 0) {
                    data = await getFeatureRequestsOffline();
                    setRequests(data);
                    setError('Offline - showing cached data');
                }
                return;
            }

            // Determine which API to call
            if (status === 'my-requests') {
                data = await getMyFeatureRequests();
            } else {
                data = await getFeatureRequests(status, 50, loadOffset);
            }
            
            if (loadOffset === 0) {
                setRequests(data);
                setOffset(data.length);
            } else {
                setRequests(prev => [...prev, ...data]);
                setOffset(prev => prev + data.length);
            }
            
            // Check if there are more items
            setHasMore(data.length === 50);
            
            // Cache data for offline use
            if (cacheEnabled && !status && loadOffset === 0) {
                cacheFeatureRequests(data).catch(error => {
                    console.error('Error caching feature requests:', error);
                });
            }
            
            setError(null);
        } catch (err) {
            console.error('Error loading feature requests:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load feature requests';
            
            // Check if this is a server connectivity issue
            const isServerError = errorMessage.includes('Not Found') || 
                                 errorMessage.includes('fetch failed') || 
                                 errorMessage.includes('Network request failed');
            
            // Try to load cached data on error
            if (cacheEnabled && !status && loadOffset === 0) {
                try {
                    const cachedData = await getFeatureRequestsOffline();
                    if (cachedData.length > 0) {
                        setRequests(cachedData);
                        if (isServerError) {
                            setError('Server temporarily unavailable - showing cached data');
                        } else {
                            setError('Using cached data - connection failed');
                        }
                        return;
                    }
                } catch (cacheError) {
                    console.error('Error loading cached data:', cacheError);
                }
            }
            
            // Provide user-friendly error messages
            if (isServerError) {
                setError('Feature requests service is temporarily unavailable. Please try again later.');
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [status, networkStatus, cacheEnabled]);

    // Refresh function
    const refresh = useCallback(async () => {
        setOffset(0);
        await loadData(true, 0);
    }, [loadData]);

    // Load more function
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoading || isRefreshing) return;
        await loadData(false, offset);
    }, [hasMore, isLoading, isRefreshing, offset, loadData]);

    // Handle upvote changes
    const handleUpvoteChange = useCallback((requestId: string, newUpvoteStatus: boolean) => {
        setRequests(prev => prev.map(request => 
            request.id === requestId 
                ? { 
                    ...request, 
                    user_upvoted: newUpvoteStatus,
                    upvotes: newUpvoteStatus ? request.upvotes + 1 : request.upvotes - 1
                }
                : request
        ));
    }, []);

    // Real-time subscription
    useEffect(() => {
        if (!networkStatus || !autoRefresh) return;

        const subscription = featureRequestsRealtime.subscribe({
            onFeatureRequestChange: (payload) => {
                console.log('Feature request change received:', payload);
                
                // Handle different types of changes
                if (payload.eventType === 'INSERT') {
                    // Add new request to the list if it matches current filter
                    if (!status || payload.new.status === status) {
                        setRequests(prev => [payload.new, ...prev]);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    // Update existing request
                    setRequests(prev => prev.map(request => 
                        request.id === payload.new.id ? { ...request, ...payload.new } : request
                    ));
                } else if (payload.eventType === 'DELETE') {
                    // Remove deleted request
                    setRequests(prev => prev.filter(request => request.id !== payload.old.id));
                }
            },
            onUpvoteChange: (payload) => {
                console.log('Upvote change received:', payload);
                
                // Update vote counts
                if (payload.eventType === 'INSERT') {
                    setRequests(prev => prev.map(request => 
                        request.id === payload.new.feature_request_id 
                            ? { ...request, upvotes: request.upvotes + 1 }
                            : request
                    ));
                } else if (payload.eventType === 'DELETE') {
                    setRequests(prev => prev.map(request => 
                        request.id === payload.old.feature_request_id 
                            ? { ...request, upvotes: Math.max(0, request.upvotes - 1) }
                            : request
                    ));
                }
            },
            onStatusChange: (payload) => {
                console.log('Status change received:', payload);
                // Reload data to get updated status information
                refresh();
            }
        });

        // Monitor connection status
        const checkConnection = () => {
            const status = featureRequestsRealtime.getConnectionStatus();
            setConnectionStatus(status);
        };

        const connectionInterval = setInterval(checkConnection, 5000);
        checkConnection();

        return () => {
            clearInterval(connectionInterval);
            featureRequestsRealtime.unsubscribe();
        };
    }, [networkStatus, autoRefresh, status, refresh]);

    // Monitor network status
    useEffect(() => {
        const checkNetworkStatus = async () => {
            try {
                const online = await isOnline();
                
                // Only update network status if it has actually changed
                if (online !== networkStatus) {
                    setNetworkStatus(online);
                    
                    // If we just came back online and had an error, refresh data
                    if (online && !networkStatus && error) {
                        setTimeout(() => refresh(), 1000); // Add small delay to prevent rapid firing
                    }
                }
            } catch (err) {
                console.error('Error checking network status:', err);
                // Don't change network status if check fails
            }
        };

        // Initial check
        checkNetworkStatus();

        // Increase interval to reduce rapid state changes
        const networkInterval = setInterval(checkNetworkStatus, 10000); // Changed from 3000 to 10000ms
        
        return () => clearInterval(networkInterval);
    }, [networkStatus, refresh, error]); // Added error to dependencies

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        requests,
        isLoading,
        isRefreshing,
        error,
        connectionStatus,
        networkStatus,
        refresh,
        loadMore,
        handleUpvoteChange
    };
};

// Hook for connection status only
export const useConnectionStatus = () => {
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [networkStatus, setNetworkStatus] = useState(false);

    useEffect(() => {
        const checkNetworkStatus = async () => {
            const online = await isOnline();
            setNetworkStatus(online);
        };

        const checkRealtimeConnection = () => {
            setConnectionStatus(featureRequestsRealtime.getConnectionStatus());
        };

        const networkInterval = setInterval(checkNetworkStatus, 3000);
        const connectionInterval = setInterval(checkRealtimeConnection, 5000);
        
        // Initial checks
        checkNetworkStatus();
        checkRealtimeConnection();

        return () => {
            clearInterval(networkInterval);
            clearInterval(connectionInterval);
        };
    }, []);

    return { connectionStatus, networkStatus };
}; 