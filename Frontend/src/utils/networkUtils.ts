import { Alert } from 'react-native';
import axios from 'axios';
import { BACKEND_URL } from './config';
import { API_URL } from './constants';

/**
 * Tests the connection to the backend servers and displays the results
 * This is useful for diagnosing network connectivity issues
 */
export const testBackendConnection = async () => {
    try {
        // Display the URLs we're testing
        console.log(`Testing connection to Backend URL: ${BACKEND_URL}`);
        console.log(`Testing connection to API URL: ${API_URL}`);

        // Create an array of tests to run
        const tests = [
            { name: 'Backend Server', url: `${BACKEND_URL}/health` },
            { name: 'API Server', url: `${API_URL}/health` }
        ];

        // Run each test with a timeout
        const results = await Promise.all(
            tests.map(async test => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);

                    const response = await axios.get(test.url, {
                        timeout: 5000,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    return {
                        name: test.name,
                        status: 'success',
                        statusCode: response.status,
                        message: 'Connection successful!'
                    };
                } catch (error: any) {
                    return {
                        name: test.name,
                        status: 'error',
                        message: error.message || 'Connection failed'
                    };
                }
            })
        );

        // Display results in the console
        console.log('=== Connection Test Results ===');
        results.forEach(result => {
            console.log(`${result.name}: ${result.status.toUpperCase()}`);
            console.log(`Message: ${result.message}`);
            if (result.statusCode) {
                console.log(`Status code: ${result.statusCode}`);
            }
            console.log('---');
        });

        // Show alerts with the results
        Alert.alert(
            'Connection Test Results',
            results.map(r => `${r.name}: ${r.status === 'success' ? '✅' : '❌'}`).join('\n')
        );

        return results;
    } catch (error) {
        console.error('Error during connection test:', error);
        Alert.alert('Connection Test Error', 'An unexpected error occurred during the test.');
        return [];
    }
};

/**
 * Network utility functions to check connectivity
 * Used during onboarding to warn users when offline
 */

export interface NetworkStatus {
    isOnline: boolean;
    backendReachable: boolean;
    lastChecked: Date;
}

let cachedNetworkStatus: NetworkStatus | null = null;
const CACHE_DURATION_MS = 30000; // 30 seconds

/**
 * Check if the app has internet connectivity and backend is reachable
 */
export const checkNetworkConnectivity = async (): Promise<NetworkStatus> => {
    // Return cached result if available and fresh
    if (cachedNetworkStatus &&
        (Date.now() - cachedNetworkStatus.lastChecked.getTime()) < CACHE_DURATION_MS) {
        return cachedNetworkStatus;
    }

    const status: NetworkStatus = {
        isOnline: false,
        backendReachable: false,
        lastChecked: new Date()
    };

    try {
        // Check basic internet connectivity with a simple HTTP request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const connectivityResponse = await fetch('https://httpbin.org/get', {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        status.isOnline = connectivityResponse.ok;
    } catch (error) {
        console.log('ℹ️ No internet connectivity detected');
        status.isOnline = false;
    }

    // If we have internet, check if our backend is reachable
    if (status.isOnline) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const backendResponse = await fetch(`${BACKEND_URL}/health`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            status.backendReachable = backendResponse.ok;
        } catch (error) {
            console.log('ℹ️ Backend not reachable');
            status.backendReachable = false;
        }
    }

    // Cache the result
    cachedNetworkStatus = status;
    return status;
};

/**
 * Quick check if we're likely offline (uses cached result if available)
 */
export const isLikelyOffline = async (): Promise<boolean> => {
    const status = await checkNetworkConnectivity();
    return !status.isOnline;
};

/**
 * Check if backend services are available
 */
export const isBackendAvailable = async (): Promise<boolean> => {
    const status = await checkNetworkConnectivity();
    return status.backendReachable;
};

/**
 * Clear the network status cache to force a fresh check
 */
export const clearNetworkCache = (): void => {
    cachedNetworkStatus = null;
}; 