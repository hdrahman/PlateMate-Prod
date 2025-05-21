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