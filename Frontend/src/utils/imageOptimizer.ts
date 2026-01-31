/**
 * Image Optimization Utility
 * 
 * Handles all image processing before upload:
 * - HEIC to JPEG conversion
 * - Resizing to max 2048px (OpenAI Vision API recommended max)
 * - JPEG compression at 0.85 quality
 * - File size validation
 * 
 * This reduces server memory pressure by 70-90% and speeds up uploads.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import RNHeicConverter from 'react-native-heic-converter';
import { Image } from 'react-native';

// Configuration constants
const MAX_DIMENSION = 2048;  // OpenAI Vision API recommended max dimension
const JPEG_QUALITY = 0.85;   // Good balance of quality/size for food recognition
const MAX_FILE_SIZE_BEFORE = 50 * 1024 * 1024;  // 50MB - reject obviously corrupt/huge files
const MAX_FILE_SIZE_AFTER = 10 * 1024 * 1024;   // 10MB - max size after optimization
const WARNING_FILE_SIZE = 4 * 1024 * 1024;      // 4MB - log warning if still large

export interface OptimizedImage {
    uri: string;
    width: number;
    height: number;
    originalSize?: number;
    optimizedSize?: number;
}

export interface OptimizationResult {
    success: boolean;
    image?: OptimizedImage;
    error?: string;
    userMessage?: string;
}

/**
 * Detect HEIC format by checking file extension.
 * Extension-based detection is sufficient since the file comes from the device's camera/gallery.
 */
export const isHeicImage = (uri: string): boolean => {
    const lowerUri = uri.toLowerCase();
    return lowerUri.endsWith('.heic') || lowerUri.endsWith('.heif');
};

/**
 * Get image dimensions using React Native's Image.getSize
 */
const getImageDimensions = (uri: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            (error) => reject(new Error(`Failed to get image dimensions: ${error}`))
        );
    });
};

/**
 * Get file size in bytes
 */
const getFileSize = async (uri: string): Promise<number> => {
    try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && 'size' in fileInfo) {
            return fileInfo.size;
        }
        return 0;
    } catch (error) {
        console.warn('Could not get file size:', error);
        return 0;
    }
};

/**
 * Convert HEIC to JPEG using react-native-heic-converter
 */
const convertHeicToJpeg = async (uri: string): Promise<string> => {
    try {
        console.log('🔄 Converting HEIC to JPEG...');
        const startTime = Date.now();

        const result = await RNHeicConverter.convert({
            path: uri,
            quality: 0.95, // High quality for HEIC conversion (we'll compress further after)
        });

        console.log(`✅ HEIC conversion completed in ${Date.now() - startTime}ms`);
        return result.path;
    } catch (error) {
        console.error('❌ HEIC conversion failed:', error);
        // Return original - backend has fallback HEIC handling
        return uri;
    }
};

/**
 * Calculate target dimensions maintaining aspect ratio
 */
const calculateResizeDimensions = (
    width: number,
    height: number,
    maxDimension: number
): { width: number; height: number } | null => {
    // No resize needed if already within limits
    if (width <= maxDimension && height <= maxDimension) {
        return null;
    }

    // Calculate scale factor to fit within max dimension
    const scale = Math.min(maxDimension / width, maxDimension / height);

    return {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
    };
};

/**
 * Main image optimization function
 * 
 * Performs:
 * 1. HEIC to JPEG conversion (if needed)
 * 2. Size validation
 * 3. Resize to max 2048px (if needed)
 * 4. JPEG compression
 */
export const optimizeImageForUpload = async (uri: string): Promise<OptimizationResult> => {
    try {
        console.log('🖼️ Starting image optimization:', uri);
        const startTime = Date.now();

        let processedUri = uri;

        // Step 1: Check initial file size
        const originalSize = await getFileSize(uri);
        if (originalSize > MAX_FILE_SIZE_BEFORE) {
            console.error(`❌ Image too large: ${(originalSize / (1024 * 1024)).toFixed(1)}MB`);
            return {
                success: false,
                error: 'IMAGE_TOO_LARGE',
                userMessage: `This image is too large (${(originalSize / (1024 * 1024)).toFixed(0)}MB). Please try a different photo or reduce the image size in your camera settings.`,
            };
        }

        // Step 2: Convert HEIC to JPEG if needed
        if (isHeicImage(uri)) {
            processedUri = await convertHeicToJpeg(uri);
        }

        // Step 3: Get current dimensions
        let dimensions: { width: number; height: number };
        try {
            dimensions = await getImageDimensions(processedUri);
            console.log(`📐 Original dimensions: ${dimensions.width}x${dimensions.height}`);
        } catch (error) {
            console.error('❌ Failed to get image dimensions:', error);
            return {
                success: false,
                error: 'INVALID_IMAGE',
                userMessage: 'Unable to read this image. Please try a different photo.',
            };
        }

        // Step 4: Calculate resize dimensions (if needed)
        const targetDimensions = calculateResizeDimensions(
            dimensions.width,
            dimensions.height,
            MAX_DIMENSION
        );

        // Step 5: Apply resize and compression via expo-image-manipulator
        const actions: ImageManipulator.Action[] = [];

        if (targetDimensions) {
            actions.push({ resize: targetDimensions });
            console.log(`📏 Resizing to: ${targetDimensions.width}x${targetDimensions.height}`);
        }

        // Always apply JPEG compression for consistent output
        const manipulated = await ImageManipulator.manipulateAsync(
            processedUri,
            actions,
            {
                compress: JPEG_QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );

        // Step 6: Verify output size
        const optimizedSize = await getFileSize(manipulated.uri);

        if (optimizedSize > MAX_FILE_SIZE_AFTER) {
            // Try more aggressive compression
            console.warn(`⚠️ Image still large after optimization: ${(optimizedSize / (1024 * 1024)).toFixed(1)}MB, trying higher compression...`);

            const recompressed = await ImageManipulator.manipulateAsync(
                manipulated.uri,
                [],
                {
                    compress: 0.6, // More aggressive compression
                    format: ImageManipulator.SaveFormat.JPEG,
                }
            );

            const recompressedSize = await getFileSize(recompressed.uri);

            if (recompressedSize > MAX_FILE_SIZE_AFTER) {
                console.error(`❌ Image still too large after aggressive compression: ${(recompressedSize / (1024 * 1024)).toFixed(1)}MB`);
                return {
                    success: false,
                    error: 'COMPRESSION_FAILED',
                    userMessage: 'This image is too complex to process. Please try a simpler photo or reduce your camera resolution settings.',
                };
            }

            console.log(`✅ Aggressive compression succeeded: ${(recompressedSize / (1024 * 1024)).toFixed(2)}MB`);

            return {
                success: true,
                image: {
                    uri: recompressed.uri,
                    width: targetDimensions?.width ?? dimensions.width,
                    height: targetDimensions?.height ?? dimensions.height,
                    originalSize,
                    optimizedSize: recompressedSize,
                },
            };
        }

        if (optimizedSize > WARNING_FILE_SIZE) {
            console.warn(`⚠️ Optimized image still large: ${(optimizedSize / (1024 * 1024)).toFixed(2)}MB`);
        }

        const endTime = Date.now();
        const finalWidth = targetDimensions?.width ?? dimensions.width;
        const finalHeight = targetDimensions?.height ?? dimensions.height;
        const savings = originalSize > 0 ? ((1 - optimizedSize / originalSize) * 100).toFixed(0) : 'N/A';

        console.log(`✅ Image optimized in ${endTime - startTime}ms`);
        console.log(`   📐 ${dimensions.width}x${dimensions.height} → ${finalWidth}x${finalHeight}`);
        console.log(`   📦 ${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB (${savings}% reduction)`);

        return {
            success: true,
            image: {
                uri: manipulated.uri,
                width: finalWidth,
                height: finalHeight,
                originalSize,
                optimizedSize,
            },
        };

    } catch (error) {
        console.error('❌ Image optimization failed:', error);

        // Return the original image as fallback - let backend handle it
        console.warn('⚠️ Falling back to original image');
        return {
            success: true, // Still allow upload with original
            image: {
                uri,
                width: 0,
                height: 0,
            },
        };
    }
};

/**
 * Optimize multiple images in parallel
 */
export const optimizeMultipleImages = async (uris: string[]): Promise<OptimizationResult[]> => {
    console.log(`🖼️ Optimizing ${uris.length} images...`);
    const startTime = Date.now();

    const results = await Promise.all(uris.map(uri => optimizeImageForUpload(uri)));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Batch optimization completed in ${Date.now() - startTime}ms`);
    console.log(`   ✓ ${successful} successful, ✗ ${failed} failed`);

    return results;
};
