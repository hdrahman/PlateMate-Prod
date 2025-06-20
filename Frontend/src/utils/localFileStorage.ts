import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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

// Generate a unique filename for a meal image
const generateUniqueFilename = (userId: string): string => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    return `meal_${userId}_${timestamp}_${randomId}.jpg`;
};

// Save an image to local device storage
export const saveImageLocally = async (imageUri: string, userId: string): Promise<string> => {
    try {
        // Ensure directory exists
        await ensureMealImagesDirectory();

        // Generate unique filename
        const filename = generateUniqueFilename(userId);
        const localPath = `${MEAL_IMAGES_DIR}${filename}`;

        // Optimize image while maintaining high quality
        const optimizedImage = await manipulateAsync(
            imageUri,
            [{ resize: { width: 1200 } }], // Keep higher resolution 1200px width
            {
                compress: 0.95, // Much higher quality (95% vs 80%)
                format: SaveFormat.JPEG
            }
        );

        // Copy the optimized image to our local directory
        await FileSystem.copyAsync({
            from: optimizedImage.uri,
            to: localPath,
        });

        console.log(`✅ Image saved locally: ${localPath}`);
        return localPath;

    } catch (error) {
        console.error('❌ Error saving image locally:', error);
        throw error;
    }
};

// Save multiple images to local device storage
export const saveMultipleImagesLocally = async (uris: string[], userId: string): Promise<string[]> => {
    try {
        console.log(`Starting to save ${uris.length} images locally in parallel`);

        // Process all images in parallel
        const savePromises = uris.map(uri => saveImageLocally(uri, userId));

        // Wait for all save operations to complete
        const savedPaths = await Promise.all(savePromises);

        console.log(`Successfully saved ${savedPaths.length} images locally`);
        return savedPaths;
    } catch (error) {
        console.error('Error saving multiple images locally:', error);
        throw error;
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
            .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
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
            file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')
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