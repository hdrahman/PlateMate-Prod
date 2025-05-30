import { fetchFoodByBarcode as fetchFromNutritionix } from '../api/nutritionix';
import { fetchFoodByBarcode as fetchFromFatSecret } from '../api/fatSecret';
import { FoodItem } from '../api/nutritionix';

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

            // Strategy 1: Nutritionix API (Primary)
            const nutritionixResult = await this.tryNutritionix(cleanBarcode);
            if (nutritionixResult) {
                console.log('✅ Success with Nutritionix API');
                return this.enhanceResult(nutritionixResult, 'nutritionix');
            }

            // Strategy 2: FatSecret API (Fallback)
            console.log('🔄 Trying FatSecret API as fallback...');
            const fatSecretResult = await this.tryFatSecret(cleanBarcode);
            if (fatSecretResult) {
                console.log('✅ Success with FatSecret API');
                return this.enhanceResult(fatSecretResult, 'fatsecret');
            }

            console.log('❌ No results from any API');
            return null;

        } catch (error) {
            console.error('💥 BarcodeService error:', error);
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
     * Try Nutritionix API
     */
    private async tryNutritionix(barcode: string): Promise<FoodItem | null> {
        try {
            console.log('🥗 Trying Nutritionix API...');
            return await fetchFromNutritionix(barcode);
        } catch (error) {
            console.warn('⚠️ Nutritionix API failed:', error);
            return null;
        }
    }

    /**
     * Try FatSecret API
     */
    private async tryFatSecret(barcode: string): Promise<FoodItem | null> {
        try {
            console.log('🍎 Trying FatSecret API...');
            return await fetchFromFatSecret(barcode);
        } catch (error) {
            console.warn('⚠️ FatSecret API failed:', error);
            return null;
        }
    }

    /**
     * Enhance result with metadata
     */
    private enhanceResult(foodItem: FoodItem, source: 'nutritionix' | 'fatsecret'): FoodItem {
        return {
            ...foodItem,
            notes: foodItem.notes ? `${foodItem.notes} | Source: ${source}` : `Source: ${source}`
        };
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