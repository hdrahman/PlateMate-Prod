import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { supabase } from '../utils/supabaseClient';

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

// Define FoodItem interface directly here
export interface FoodItem {
    food_name: string;
    brand_name?: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    saturated_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitamin_a: number;
    vitamin_c: number;
    calcium: number;
    iron: number;
    image: string;
    serving_unit: string;
    serving_weight_grams: number;
    serving_qty: number;
    healthiness_rating?: number;
    notes?: string;
}

/**
 * Fetch food by barcode using the backend API
 */
export const fetchFoodByBarcode = async (barcode: string): Promise<FoodItem | null> => {
    try {
        // Clean the barcode
        const cleanBarcode = barcode.replace(/\D/g, '');
        console.log('Searching for barcode:', cleanBarcode);

        // Get authentication headers
        const headers = await getAuthHeaders();

        // Use the backend API to search for food by barcode
        const response = await axios.post(
            `${BACKEND_BASE_URL}/food/barcode`,
            { barcode: cleanBarcode },
            { headers }
        );

        // Extract the food data from the response structure
        if (response.data && response.data.success && response.data.food) {
            return response.data.food;
        }

        return null;
    } catch (error) {
        console.error('Error fetching food by barcode:', error);
        throw error;
    }
};

/**
 * Centralized Barcode Service
 * Handles barcode scanning with multiple API fallbacks
 */
export class BarcodeService {
    private static instance: BarcodeService;

    // Singleton pattern for consistent service usage
    public static getInstance(): BarcodeService {
        if (!BarcodeService.instance) {
            BarcodeService.instance = new BarcodeService();
        }
        return BarcodeService.instance;
    }

    /**
     * Primary barcode lookup with intelligent fallback
     * @param barcode - The scanned barcode
     * @returns Promise<FoodItem | null>
     */
    public async lookupBarcode(barcode: string): Promise<FoodItem | null> {
        console.log(`🔍 Starting barcode lookup for: ${barcode}`);

        try {
            // Clean the barcode
            const cleanBarcode = this.cleanBarcode(barcode);

            if (!this.isValidBarcode(cleanBarcode)) {
                console.warn('❌ Invalid barcode format');
                return null;
            }

            // Add a retry mechanism for network reliability
            const maxRetries = 2;
            let currentRetry = 0;
            let lastError = null;

            while (currentRetry <= maxRetries) {
                try {
                    if (currentRetry > 0) {
                        console.log(`Retry attempt ${currentRetry} of ${maxRetries}...`);
                        // Short delay between retries
                        await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
                    }

                    // Strategy: Backend API
                    console.log('🥗 Trying Backend API...');
                    const backendResult = await fetchFoodByBarcode(cleanBarcode);

                    if (backendResult) {
                        console.log('✅ Success with Backend API');
                        return backendResult;
                    }

                    // If we get here without an exception but no result, we got a proper 404
                    // No need to retry in this case
                    break;

                } catch (error) {
                    lastError = error;

                    // Special handling for IP whitelist errors - don't retry these
                    const errorMsg = error.message || '';
                    if (errorMsg.includes('not whitelisted in FatSecret API') ||
                        errorMsg.includes('IP whitelist error')) {
                        console.error('⚠️ FatSecret API IP whitelist error - need to whitelist server IP');
                        throw new Error('The barcode scanning service requires IP whitelisting. Please contact your administrator.');
                    }

                    if (axios.isAxiosError(error)) {
                        // Don't retry for certain error codes
                        if (error.response?.status === 404) {
                            console.log('Barcode not found (404) - no need to retry');
                            break;
                        }
                        if (error.response?.status === 400) {
                            console.log('Bad request (400) - no need to retry');
                            break;
                        }
                    }

                    currentRetry++;
                    if (currentRetry > maxRetries) {
                        console.warn(`⚠️ All retry attempts failed`);
                        break;
                    }
                }
            }

            console.log('❌ No results found');
            return null;

        } catch (error) {
            console.error('💥 BarcodeService error:', error);

            // Re-throw IP whitelist errors so they can be displayed to the user
            if (error.message && (
                error.message.includes('not whitelisted in FatSecret API') ||
                error.message.includes('IP whitelist error') ||
                error.message.includes('requires IP whitelisting')
            )) {
                throw error;
            }

            return null;
        }
    }

    /**
     * Clean and format barcode for API consumption
     */
    private cleanBarcode(barcode: string): string {
        return barcode.replace(/\D/g, '').trim();
    }

    /**
     * Validate barcode format
     */
    private isValidBarcode(barcode: string): boolean {
        // UPC-A (12 digits), EAN-13 (13 digits), etc.
        return barcode.length >= 8 && barcode.length <= 14 && /^\d+$/.test(barcode);
    }

    /**
     * Get supported barcode types for camera configuration
     */
    public getSupportedBarcodeTypes(): string[] {
        return [
            "ean13",
            "ean8",
            "upc_e",
            "upc_a",
            "code128",
            "code39"
        ];
    }

    /**
     * Validate barcode scanning result
     */
    public validateScanResult(result: any): boolean {
        return result &&
            result.data &&
            typeof result.data === 'string' &&
            result.data.trim().length > 0;
    }
}

// Export singleton instance
export const barcodeService = BarcodeService.getInstance(); 