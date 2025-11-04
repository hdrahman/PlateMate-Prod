import * as FileSystem from 'expo-file-system/legacy';

// Create a directory for storing meal images locally on the device
const MEAL_IMAGES_DIR = `${FileSystem.documentDirectory}meal_images/`;

// Ensure the meal images directory exists
export const ensureMealImagesDirectory = async (): Promise<void> => {
    try {
        const dirInfo = await FileSystem.getInfoAsync(MEAL_IMAGES_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(MEAL_IMAGES_DIR, { intermediates: true });
            console.log('✅ Created meal images directory');
        }
    } catch (error) {
        console.error('❌ Error creating meal images directory:', error);
        throw error;
    }
};

// Generate a unique filename for a meal image with correct extension
const generateUniqueFilename = (userId: string, originalUri: string): string => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);

    // Extract extension from original URI
    let extension = 'jpg'; // Default fallback
    const uriParts = originalUri.split('.');
    if (uriParts.length > 1) {
        const lastPart = uriParts[uriParts.length - 1].toLowerCase();
        // Remove query parameters if any
        const cleanExtension = lastPart.split('?')[0];
        // Validate extension
        if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(cleanExtension)) {
            extension = cleanExtension;
        }
    }

    return `meal_${userId}_${timestamp}_${randomId}.${extension}`;
};

// Save an image to local device storage
export const saveImageLocally = async (imageUri: string, userId: string): Promise<string> => {
    try {
        // Ensure directory exists
        await ensureMealImagesDirectory();

        // Generate unique filename with correct extension
        const filename = generateUniqueFilename(userId, imageUri);
        const localPath = `${MEAL_IMAGES_DIR}${filename}`;

        // Since images are already optimized by optimizeImage() function,
        // just copy directly without additional compression to preserve quality
        let optimizedImage;
        try {
            // No additional processing needed - use the already optimized image
            optimizedImage = { uri: imageUri };
            console.log('✅ Using pre-optimized image for local storage (no additional compression)');
        } catch (manipulateError) {
            console.warn('⚠️ Image manipulation failed, using original image:', manipulateError);
            // If image manipulation fails, create a fallback object with the original URI
            optimizedImage = { uri: imageUri };
        }

        // Copy the optimized image to our local directory
        await FileSystem.copyAsync({
            from: optimizedImage.uri,
            to: localPath,
        });

        console.log(`✅ Image saved locally: ${localPath}`);
        return localPath;

    } catch (error) {
        console.error('❌ Error saving image locally, returning original URI as fallback:', error);
        // Return original URI as fallback if everything fails
        return imageUri;
    }
};

// Save multiple images to local device storage
export const saveMultipleImagesLocally = async (uris: string[], userId: string): Promise<string[]> => {
    try {
        console.log(`Starting to save ${uris.length} images locally in parallel`);

        // Process all images in parallel with individual error handling
        const savePromises = uris.map(async (uri, index) => {
            try {
                return await saveImageLocally(uri, userId);
            } catch (error) {
                console.warn(`⚠️ Failed to save image ${index + 1} locally, using original URI:`, error);
                // Return original URI as fallback if local saving fails
                return uri;
            }
        });

        // Wait for all save operations to complete
        const savedPaths = await Promise.all(savePromises);

        console.log(`Successfully processed ${savedPaths.length} images (mix of local saves and fallbacks)`);
        return savedPaths;
    } catch (error) {
        console.error('Error in saveMultipleImagesLocally, using original URIs as fallback:', error);
        // Return original URIs as complete fallback
        return uris;
    }
};

// Check if a local image file exists
export const checkImageExists = async (localPath: string): Promise<boolean> => {
    try {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        return fileInfo.exists;
    } catch (error) {
        console.error('❌ Error checking if image exists:', error);
        return false;
    }
};

// Delete a local image file
export const deleteLocalImage = async (localPath: string): Promise<boolean> => {
    try {
        const exists = await checkImageExists(localPath);
        if (exists) {
            await FileSystem.deleteAsync(localPath);
            console.log(`✅ Deleted local image: ${localPath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error deleting local image:', error);
        return false;
    }
};

// Delete multiple local image files
export const deleteMultipleLocalImages = async (localPaths: string[]): Promise<number> => {
    let deletedCount = 0;

    for (const path of localPaths) {
        const success = await deleteLocalImage(path);
        if (success) deletedCount++;
    }

    return deletedCount;
};

// Get all local meal images
export const getAllLocalMealImages = async (): Promise<string[]> => {
    try {
        await ensureMealImagesDirectory();

        const files = await FileSystem.readDirectoryAsync(MEAL_IMAGES_DIR);
        const imagePaths = files
            .filter(file =>
                file.endsWith('.jpg') ||
                file.endsWith('.jpeg') ||
                file.endsWith('.png') ||
                file.endsWith('.heic') ||
                file.endsWith('.heif') ||
                file.endsWith('.webp')
            )
            .map(file => `${MEAL_IMAGES_DIR}${file}`);

        console.log(`📊 Found ${imagePaths.length} local meal images`);
        return imagePaths;

    } catch (error) {
        console.error('❌ Error getting local meal images:', error);
        return [];
    }
};

// Get storage info for local images
export const getLocalStorageInfo = async (): Promise<{
    totalImages: number;
    totalSizeMB: number;
    directoryPath: string;
}> => {
    try {
        await ensureMealImagesDirectory();

        const files = await FileSystem.readDirectoryAsync(MEAL_IMAGES_DIR);
        const imageFiles = files.filter(file =>
            file.endsWith('.jpg') ||
            file.endsWith('.jpeg') ||
            file.endsWith('.png') ||
            file.endsWith('.heic') ||
            file.endsWith('.heif') ||
            file.endsWith('.webp')
        );

        let totalSize = 0;

        for (const file of imageFiles) {
            const filePath = `${MEAL_IMAGES_DIR}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            if (fileInfo.exists && fileInfo.size) {
                totalSize += fileInfo.size;
            }
        }

        return {
            totalImages: imageFiles.length,
            totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
            directoryPath: MEAL_IMAGES_DIR,
        };

    } catch (error) {
        console.error('❌ Error getting local storage info:', error);
        return {
            totalImages: 0,
            totalSizeMB: 0,
            directoryPath: MEAL_IMAGES_DIR,
        };
    }
};

// Clean up old local images (older than specified days)
export const cleanupOldLocalImages = async (daysOld: number = 30): Promise<number> => {
    try {
        await ensureMealImagesDirectory();

        const files = await FileSystem.readDirectoryAsync(MEAL_IMAGES_DIR);
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = `${MEAL_IMAGES_DIR}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (fileInfo.exists && fileInfo.modificationTime) {
                const fileTime = fileInfo.modificationTime * 1000; // Convert to milliseconds

                if (fileTime < cutoffTime) {
                    await FileSystem.deleteAsync(filePath);
                    deletedCount++;
                    console.log(`🗑️ Deleted old local image: ${file}`);
                }
            }
        }

        console.log(`✅ Cleaned up ${deletedCount} old local images`);
        return deletedCount;

    } catch (error) {
        console.error('❌ Error cleaning up old local images:', error);
        return 0;
    }
}; 