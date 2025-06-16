import { fetchFoodByBarcode as fetchFromBackend } from '../api/nutritionix';
import { FoodItem } from '../api/nutritionix';
import axios from 'axios';

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
                    const backendResult = await fetchFromBackend(cleanBarcode);

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