import { fetchFoodByBarcode as fetchFromBackend } from '../api/nutritionix';
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

            // Strategy 1: Backend API (Primary and Only)
            const backendResult = await this.tryBackend(cleanBarcode);
            if (backendResult) {
                console.log('✅ Success with Backend API');
                return this.enhanceResult(backendResult, 'backend');
            }

            console.log('❌ No results found');
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
     * Try Backend API
     */
    private async tryBackend(barcode: string): Promise<FoodItem | null> {
        try {
            console.log('🥗 Trying Backend API...');
            return await fetchFromBackend(barcode);
        } catch (error) {
            console.warn('⚠️ Backend API failed:', error);
            return null;
        }
    }



    /**
     * Enhance result with metadata
     */
    private enhanceResult(foodItem: FoodItem, source: 'backend'): FoodItem {
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