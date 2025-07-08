import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, StackActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { launchCameraAsync, MediaTypeOptions } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { addFoodLog, addMultipleFoodLogs, getCurrentUserId } from '../utils/database';
import { BACKEND_URL } from '../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnalysisModal from '../components/AnalysisModal';
import { saveImageLocally, saveMultipleImagesLocally } from '../utils/localFileStorage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { navigateToFoodLog } from '../navigation/RootNavigation';

const { width } = Dimensions.get('window');

// Define navigation types
type RootStackParamList = {
    FoodLog: { refresh?: number };
    ImageCapture: { mealType: string; photoUri?: string; foodData?: any; sourcePage?: string };
    Camera: undefined;
    BarcodeScanner: undefined;
    // Add other screens as needed
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'ImageCapture'>;

type ImageInfo = {
    uri: string;
    type: 'top' | 'side' | 'additional';
    uploaded: boolean;
    data?: any;
};

// Combine nutrition data from all images
type NutritionData = {
    calories?: number;
    proteins?: number;
    carbs?: number;
    fats?: number;
    food_name?: string;
    description?: string;
    healthiness_rating?: number;
};

const ImageCapture: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute();
    const { mealType: initialMealType, photoUri: initialPhotoUri, foodData } = route.params as { mealType: string; photoUri?: string; foodData?: any };

    const [mealType, setMealType] = useState(initialMealType);
    const [showMealTypeDropdown, setShowMealTypeDropdown] = useState(false);
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

    // Initialize images array based on whether we received a photoUri
    const [images, setImages] = useState<ImageInfo[]>(() => {
        if (initialPhotoUri) {
            return [
                { uri: initialPhotoUri, type: 'top', uploaded: false },
                { uri: '', type: 'side', uploaded: false }
            ];
        }
        return [
            { uri: '', type: 'top', uploaded: false },
            { uri: '', type: 'side', uploaded: false }
        ];
    });

    const [brandName, setBrandName] = useState(foodData?.brand_name || '');
    const [quantity, setQuantity] = useState(foodData?.serving_qty ? `${foodData.serving_qty} ${foodData.serving_unit || ''}` : '');
    const [notes, setNotes] = useState('');
    const [foodName, setFoodName] = useState(foodData?.food_name || '');
    const [loading, setLoading] = useState(false);
    
    // New state for UI improvements
    const [showSideView, setShowSideView] = useState(false);
    const [showOptionalDetails, setShowOptionalDetails] = useState(false);

    // Add state for GPT-generated description
    const [gptDescription, setGptDescription] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStage, setAnalysisStage] = useState<'uploading' | 'analyzing' | 'processing'>('uploading');
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [analysisStartTime, setAnalysisStartTime] = useState(0);

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Camera permission is required to take photos');
            }
        })();
        
        // If we have an initial photo URI, show the side view option
        if (initialPhotoUri) {
            setShowSideView(true);
        }
    }, [initialPhotoUri]);

    const optimizeImage = async (uri: string): Promise<string> => {
        try {
            console.log('Optimizing image for high quality...');
            // Keep high quality - only resize if absolutely massive
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1600 } }], // Higher resolution
                { compress: 0.98, format: ImageManipulator.SaveFormat.JPEG } // Near lossless quality
            );

            console.log('Image optimized successfully');
            console.log(`Original URI: ${uri}`);
            console.log(`Optimized URI: ${manipResult.uri}`);

            return manipResult.uri;
        } catch (error) {
            console.error('Error optimizing image:', error);
            // Fall back to original image if optimization fails
            return uri;
        }
    };

    const handleTakePhoto = async (index: number) => {
        try {
            const result = await launchCameraAsync({
                mediaTypes: MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled) {
                // Optimize image while keeping high quality
                const optimizedUri = await optimizeImage(result.assets[0].uri);

                const newImages = [...images];
                newImages[index] = {
                    ...newImages[index],
                    uri: optimizedUri,
                    uploaded: false
                };
                setImages(newImages);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    const handlePickImage = async (index: number) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled) {
                // Optimize image while keeping high quality
                const optimizedUri = await optimizeImage(result.assets[0].uri);

                const newImages = [...images];
                newImages[index] = {
                    ...newImages[index],
                    uri: optimizedUri,
                    uploaded: false
                };
                setImages(newImages);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadImage = async (uri: string): Promise<{ url: string, key: string, data: any }> => {
        try {
            console.log('Starting image upload...');
            const startTime = Date.now();

            const fileInfo = await FileSystem.getInfoAsync(uri);
            console.log(`Image file info: ${fileInfo.exists ? 'File exists' : 'File does not exist'}`);
            if (fileInfo.exists && 'size' in fileInfo) {
                console.log(`Image file size: ${fileInfo.size} bytes`);
            }

            if (!fileInfo.exists) {
                throw new Error('Image file does not exist');
            }

            // Extract file extension and create proper filename
            const fileExtension = uri.split('.').pop() || 'jpg';
            const fileName = `image_${Date.now()}.${fileExtension}`;

            console.log(`📷 Processing single image upload: ${uri}`);

            const formData = new FormData();
            formData.append('user_id', '1');

            // Use Android-compatible file object structure (NO blobs!)
            const fileObject = {
                uri: uri,
                type: `image/${fileExtension}`,
                name: fileName,
            };

            formData.append('image', fileObject as any);
            console.log(`✅ Added image to FormData: ${fileName}`);

            // Get Supabase auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('User not authenticated. Please sign in again.');
            }
            const token = session.access_token;

            console.log('📤 Sending single image to backend...');
            const response = await fetch(`${BACKEND_URL}/images/upload-image`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    // CRITICAL: Do NOT set Content-Type for FormData in Android
                    // Let the native implementation set the boundary automatically
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const endTime = Date.now();
            console.log(`Upload + Analysis time: ${(endTime - startTime) / 1000} seconds`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Upload failed with status ${response.status}:`, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            // Ensure we have a valid image_url before checking startsWith
            if (!data.image_url) {
                console.error('No image_url in response:', data);
                throw new Error('No image_url in response');
            }

            // Ensure we return a full URL
            const fullUrl = data.image_url.startsWith('http')
                ? data.image_url
                : `${BACKEND_URL}/${data.image_url}`;

            return {
                url: fullUrl,
                key: data.file_key || 'default_key',
                data: data.nutrition_data || {}
            };
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    };

    // New function to analyze food with GPT
    const analyzeFoodWithGPT = async (imageUrls: string[], foodName: string): Promise<string> => {
        try {
            if (!imageUrls || imageUrls.length === 0) {
                throw new Error('No image URLs provided for GPT analysis');
            }

            console.log(`Analyzing ${imageUrls.length} images with GPT`);

            // Make sure we have full URLs for the images
            const fullImageUrls = imageUrls.map(url => {
                // Check if the URL is already a full URL
                if (url && url.startsWith('http')) {
                    return url;
                }
                // Otherwise, prepend the backend URL
                return url ? `${BACKEND_URL}/${url}` : '';
            }).filter(url => url !== ''); // Remove any empty URLs

            if (fullImageUrls.length === 0) {
                throw new Error('No valid image URLs after processing');
            }

            console.log('Processed image URLs:', fullImageUrls);

            // Get Supabase auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('User not authenticated. Please sign in again.');
            }
            const token = session.access_token;

            const response = await fetch(`${BACKEND_URL}/gpt/analyze-food`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    image_urls: fullImageUrls,
                    food_name: foodName || 'Unknown Food',
                    meal_type: mealType
                }),
            });

            if (!response.ok) {
                console.error(`GPT analysis failed with status: ${response.status}`);
                const errorText = await response.text();
                console.error(`Error details: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.description || 'No description available';
        } catch (error) {
            console.error('GPT analysis failed:', error);
            return 'Failed to analyze food with GPT';
        }
    };

    // Add debugging helper for network issues
    const debugNetworkIssue = async () => {
        try {
            console.log('🔍 Starting network diagnostics...');
            console.log(`📱 Platform: ${Platform.OS}`);
            console.log(`🌐 Backend URL: ${BACKEND_URL}`);

            // Test basic connectivity
            console.log('🏥 Testing basic connectivity...');
            const healthResponse = await fetch(`${BACKEND_URL}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (healthResponse.ok) {
                console.log('✅ Basic connectivity works');
            } else {
                console.log(`❌ Basic connectivity failed: ${healthResponse.status}`);
            }

            // Test authenticated endpoint
            console.log('🔐 Testing authenticated endpoint...');
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const authTestResponse = await fetch(`${BACKEND_URL}/health/auth-status`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });

                if (authTestResponse.ok) {
                    console.log('✅ Authentication works');
                } else {
                    console.log(`❌ Authentication failed: ${authTestResponse.status}`);
                }
            } else {
                console.log('❌ No auth session available');
            }

        } catch (error) {
            console.error('❌ Network diagnostics failed:', error);
        }
    };

    // Function to upload multiple images to backend and get ChatGPT analysis
    const uploadMultipleImages = async (imageUris: string[]): Promise<{ meal_id: number, nutrition_data: any, localImagePaths: string[] }> => {
        try {
            console.log('🚀 Uploading multiple images to backend with ChatGPT analysis...');
            const startTime = Date.now();
            setAnalysisStage('uploading');

            // Get current user ID for local storage
            const userId = getCurrentUserId();

            // Start local image saving first (but don't let it block the main process)
            let localImagePathsPromise: Promise<string[]>;
            try {
                localImagePathsPromise = saveMultipleImagesLocally(imageUris, userId);
            } catch (localSaveError) {
                console.warn('⚠️ Local image saving failed, continuing with backend upload:', localSaveError);
                // Create a fallback promise that resolves to original URIs
                localImagePathsPromise = Promise.resolve(imageUris);
            }

            // Get Supabase auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('User not authenticated. Please sign in again.');
            }
            const token = session.access_token;

            setAnalysisStage('analyzing');

            // Create FormData with Android-compatible file handling
            const formData = new FormData();
            formData.append('user_id', '1');

            // Process each image for Android compatibility
            for (let i = 0; i < imageUris.length; i++) {
                const uri = imageUris[i];

                try {
                    // Verify file exists and get detailed info
                    const fileInfo = await FileSystem.getInfoAsync(uri);
                    console.log(`📋 File info for image ${i + 1}:`, {
                        uri,
                        exists: fileInfo.exists,
                        size: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 'unknown',
                        isDirectory: fileInfo.exists && 'isDirectory' in fileInfo ? fileInfo.isDirectory : false
                    });

                    if (!fileInfo.exists) {
                        console.error(`❌ Image file does not exist: ${uri}`);
                        continue;
                    }

                    if (fileInfo.exists && 'isDirectory' in fileInfo && fileInfo.isDirectory) {
                        console.error(`❌ URI points to directory, not file: ${uri}`);
                        continue;
                    }

                    console.log(`✅ Processing valid image ${i + 1}/${imageUris.length}: ${uri}`);

                    // Extract file extension from URI more reliably
                    let fileExtension = 'jpg'; // Default fallback
                    const uriParts = uri.split('.');
                    if (uriParts.length > 1) {
                        const lastPart = uriParts[uriParts.length - 1].toLowerCase();
                        // Remove query parameters if any
                        fileExtension = lastPart.split('?')[0];
                    }

                    // Ensure valid image extensions
                    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
                        fileExtension = 'jpg';
                    }

                    const fileName = `image_${i}_${Date.now()}.${fileExtension}`;

                    // Map file extension to correct MIME type
                    let mimeType = `image/${fileExtension}`;
                    if (fileExtension === 'jpg') {
                        mimeType = 'image/jpeg'; // Ensure compatibility with backend validation
                    }

                    // Use Android-compatible file object structure (NO blobs!)
                    const fileObject = {
                        uri: uri,
                        type: mimeType,
                        name: fileName,
                    };

                    console.log(`📦 Creating file object:`, fileObject);
                    formData.append('images', fileObject as any);
                    console.log(`✅ Successfully added image ${i + 1} to FormData: ${fileName}`);

                } catch (fileError) {
                    console.error(`❌ Error processing image ${i}:`, fileError);
                    console.error(`❌ Failed URI: ${uri}`);
                    continue; // Skip this image and continue with others
                }
            }

            console.log('📤 Sending FormData to backend...');

            // Make the upload request with proper headers for Android
            const response = await fetch(`${BACKEND_URL}/images/upload-multiple-images`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    // CRITICAL: Do NOT set Content-Type for FormData in Android
                    // Let the native implementation set the boundary automatically
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            // Wait for local image saving to complete (with fallback if it fails)
            let localImagePaths: string[];
            try {
                localImagePaths = await localImagePathsPromise;
                console.log('✅ Images saved locally for gallery');
            } catch (localSaveError) {
                console.warn('⚠️ Local image saving failed during await, using original URIs:', localSaveError);
                // Use original URIs as fallback
                localImagePaths = imageUris;
            }

            const endTime = Date.now();
            console.log(`📊 Total upload time: ${(endTime - startTime) / 1000} seconds`);

            // Check response
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Upload failed with status ${response.status}:`, errorText);
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('📥 Received response from backend:', data);

            if (!data.nutrition_data || !Array.isArray(data.nutrition_data)) {
                throw new Error('Invalid nutrition data received from backend');
            }

            setAnalysisStage('processing');

            console.log(`✅ Successfully processed ${data.nutrition_data.length} food items`);
            console.log(`🖼️ Local images status: ${localImagePaths.length} paths available`);

            return {
                meal_id: data.meal_id,
                nutrition_data: data.nutrition_data,
                localImagePaths: localImagePaths
            };

        } catch (error) {
            console.error('❌ Complete upload process failed:', error);

            // Run network diagnostics for debugging
            console.log('🔍 Running network diagnostics after upload failure...');
            await debugNetworkIssue();

            // Log additional debugging info for Android
            if (Platform.OS === 'android') {
                console.error('🐛 Android-specific debugging:');
                console.error('- Make sure network_security_config allows HTTPS');
                console.error('- FormData file structure must use {uri, type, name} format');
                console.error('- Content-Type header must NOT be set manually');
                console.error('- Check if cleartext traffic is disabled');
                console.error('- Verify file URIs are accessible in production build');
            }

            throw error;
        }
    };

    const processMultipleImagesLocally = async (imageUris: string[]): Promise<{ meal_id: number, nutrition_data: any }> => {
        try {
            console.log('📱 Processing multiple images locally...');
            const startTime = Date.now();
            setAnalysisStage('uploading');

            // Get current user ID for local storage
            const userId = getCurrentUserId();

            // Save all images to local device storage
            console.log(`💾 Saving ${imageUris.length} images locally...`);
            const localPaths = await saveMultipleImagesLocally(imageUris, userId);

            setAnalysisStage('analyzing');

            // For local-only mode, we'll create mock nutrition data
            // In a real app, you could integrate with an offline AI model or nutrition database
            const mockNutritionData = imageUris.map((_, index) => ({
                food_name: foodName || `Food Item ${index + 1}`,
                calories: Math.floor(Math.random() * 400) + 100, // Random calories 100-500
                proteins: Math.floor(Math.random() * 30) + 5,    // Random protein 5-35g
                carbs: Math.floor(Math.random() * 50) + 10,      // Random carbs 10-60g
                fats: Math.floor(Math.random() * 20) + 2,        // Random fats 2-22g
                fiber: Math.floor(Math.random() * 10) + 1,       // Random fiber 1-11g
                sugar: Math.floor(Math.random() * 20) + 1,       // Random sugar 1-21g
                saturated_fat: Math.floor(Math.random() * 8) + 1,
                polyunsaturated_fat: Math.floor(Math.random() * 5) + 1,
                monounsaturated_fat: Math.floor(Math.random() * 8) + 1,
                trans_fat: Math.floor(Math.random() * 2),
                cholesterol: Math.floor(Math.random() * 50),
                sodium: Math.floor(Math.random() * 500) + 50,
                potassium: Math.floor(Math.random() * 300) + 100,
                vitamin_a: Math.floor(Math.random() * 100),
                vitamin_c: Math.floor(Math.random() * 50),
                calcium: Math.floor(Math.random() * 200) + 50,
                iron: Math.floor(Math.random() * 10) + 1,
                weight: Math.floor(Math.random() * 200) + 50,    // Random weight 50-250g
                weight_unit: "g",
                healthiness_rating: Math.floor(Math.random() * 8) + 3, // Rating 3-10
                image_url: localPaths[index] // Store local path
            }));

            setAnalysisStage('processing');

            const endTime = Date.now();
            console.log(`✅ Local processing time: ${(endTime - startTime) / 1000} seconds`);

            // Generate unique meal ID
            const mealId = Date.now();

            return {
                meal_id: mealId,
                nutrition_data: mockNutritionData
            };
        } catch (error) {
            console.error('❌ Local image processing failed:', error);
            throw error;
        }
    };

    const handleSubmit = async () => {
        // If we have barcode data, we don't necessarily need images
        if (foodData) {
            setLoading(true);
            try {
                // Format current date as ISO string (YYYY-MM-DD)
                const today = new Date();
                const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                console.log(`Saving food log from barcode with date: ${formattedDate}`);

                // Create a food log entry from barcode data
                const foodLog = {
                    meal_id: Date.now().toString(), // Generate a unique meal ID
                    food_name: foodName || foodData.food_name || 'Unknown Food',
                    calories: foodData.calories || 0,
                    proteins: foodData.proteins || 0,
                    carbs: foodData.carbs || 0,
                    fats: foodData.fats || 0,
                    fiber: foodData.fiber || 0,
                    sugar: foodData.sugar || 0,
                    saturated_fat: foodData.saturated_fat || 0,
                    polyunsaturated_fat: foodData.polyunsaturated_fat || 0,
                    monounsaturated_fat: foodData.monounsaturated_fat || 0,
                    trans_fat: foodData.trans_fat || 0,
                    cholesterol: foodData.cholesterol || 0,
                    sodium: foodData.sodium || 0,
                    potassium: foodData.potassium || 0,
                    vitamin_a: foodData.vitamin_a || 0,
                    vitamin_c: foodData.vitamin_c || 0,
                    calcium: foodData.calcium || 0,
                    iron: foodData.iron || 0,
                    image_url: foodData.image || '',
                    file_key: 'default_key',
                    healthiness_rating: foodData.healthiness_rating || 5,
                    date: formattedDate,
                    meal_type: mealType,
                    brand_name: brandName,
                    quantity: quantity,
                    notes: notes
                };

                console.log('Saving barcode food log to local database:', foodLog);

                // Navigate immediately while database operation runs in background
                console.log('🚀 About to navigate to FoodLog...');
                navigateToFoodLog();

                // Continue with database operation after navigation has started
                await addFoodLog(foodLog);
                return;
            } catch (error) {
                console.error('Error submitting barcode food:', error);
                Alert.alert('Error', 'Failed to submit food. Please try again.');
                setLoading(false);
                return;
            }
        }

        // Check if at least 1 image is taken when not using barcode data
        const filledImages = images.filter(img => img.uri !== '');
        if (filledImages.length < 1) {
            Alert.alert('Required', 'Please take at least one photo of your meal to continue', [
                { text: 'OK', style: 'default' }
            ]);
            return;
        }

        // Check if the primary image is taken
        if (!images[0].uri) {
            Alert.alert('Required', 'Please take a photo of your meal to continue', [
                { text: 'OK', style: 'default' }
            ]);
            return;
        }

        // Start the loading and analysis processes
        setLoading(true);
        setIsAnalyzing(true);
        setShowAnalysisModal(true);
        setAnalysisStage('uploading');
        setAnalysisStartTime(0);

        try {
            // Get all image URIs
            const imageUris = filledImages.map(img => img.uri);

            // Use backend ChatGPT integration instead of local processing
            console.log('🚀 Using backend ChatGPT integration for food analysis...');
            const result = await uploadMultipleImages(imageUris);
            console.log('Backend ChatGPT analysis completed successfully');

            // Format current date as ISO string (YYYY-MM-DD)
            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            console.log(`Saving food logs with date: ${formattedDate}`);

            // Hide the analysis modal immediately to improve perceived performance
            setShowAnalysisModal(false);

            // Check if we have an array of nutrition data
            if (Array.isArray(result.nutrition_data) && result.nutrition_data.length > 0) {
                // Process each food item in the array
                const foodLogsToInsert = [];

                for (let index = 0; index < result.nutrition_data.length; index++) {
                    const nutritionData = result.nutrition_data[index];
                    // Use the first local image path for all food items from the same meal
                    const primaryImagePath = result.localImagePaths && result.localImagePaths.length > 0
                        ? result.localImagePaths[0]
                        : imageUris[0]; // Fallback to original URI if local path not available

                    // Create a food log entry with all required fields
                    const foodLog = {
                        meal_id: result.meal_id.toString(),
                        food_name: foodName || nutritionData.food_name || 'Unknown Food',
                        calories: nutritionData.calories || 0,
                        proteins: nutritionData.proteins || 0,
                        carbs: nutritionData.carbs || 0,
                        fats: nutritionData.fats || 0,
                        fiber: nutritionData.fiber || 0,
                        sugar: nutritionData.sugar || 0,
                        saturated_fat: nutritionData.saturated_fat || 0,
                        polyunsaturated_fat: nutritionData.polyunsaturated_fat || 0,
                        monounsaturated_fat: nutritionData.monounsaturated_fat || 0,
                        trans_fat: nutritionData.trans_fat || 0,
                        cholesterol: nutritionData.cholesterol || 0,
                        sodium: nutritionData.sodium || 0,
                        potassium: nutritionData.potassium || 0,
                        vitamin_a: nutritionData.vitamin_a || 0,
                        vitamin_c: nutritionData.vitamin_c || 0,
                        calcium: nutritionData.calcium || 0,
                        iron: nutritionData.iron || 0,
                        image_url: primaryImagePath,
                        file_key: 'default_key',
                        healthiness_rating: nutritionData.healthiness_rating || 5,
                        date: formattedDate,
                        meal_type: mealType,
                        brand_name: brandName,
                        quantity: quantity,
                        notes: notes
                    };

                    foodLogsToInsert.push(foodLog);
                }

                // Navigate before database operation to prevent UI blocking
                console.log('🚀 About to navigate to FoodLog...');
                navigateToFoodLog();

                // Continue with database operation after navigation has started
                console.log(`Saving ${foodLogsToInsert.length} food logs to local database in batch`);
                await addMultipleFoodLogs(foodLogsToInsert);
                console.log(`Saved ${result.nutrition_data.length} food items to database`);
            } else {
                // Fallback to old behavior if not an array or empty
                const nutritionData = result.nutrition_data[0] || {};

                // Use the first local image path or fallback to original URI
                const primaryImagePath = result.localImagePaths && result.localImagePaths.length > 0
                    ? result.localImagePaths[0]
                    : imageUris[0]; // Fallback to original URI if local path not available

                // Create a food log entry with all required fields
                const foodLog = {
                    meal_id: result.meal_id.toString(),
                    food_name: foodName || nutritionData.food_name || 'Unknown Food',
                    calories: nutritionData.calories || 0,
                    proteins: nutritionData.proteins || 0,
                    carbs: nutritionData.carbs || 0,
                    fats: nutritionData.fats || 0,
                    fiber: nutritionData.fiber || 0,
                    sugar: nutritionData.sugar || 0,
                    saturated_fat: nutritionData.saturated_fat || 0,
                    polyunsaturated_fat: nutritionData.polyunsaturated_fat || 0,
                    monounsaturated_fat: nutritionData.monounsaturated_fat || 0,
                    trans_fat: nutritionData.trans_fat || 0,
                    cholesterol: nutritionData.cholesterol || 0,
                    sodium: nutritionData.sodium || 0,
                    potassium: nutritionData.potassium || 0,
                    vitamin_a: nutritionData.vitamin_a || 0,
                    vitamin_c: nutritionData.vitamin_c || 0,
                    calcium: nutritionData.calcium || 0,
                    iron: nutritionData.iron || 0,
                    image_url: primaryImagePath,
                    file_key: 'default_key',
                    healthiness_rating: nutritionData.healthiness_rating || 5,
                    date: formattedDate,
                    meal_type: mealType,
                    brand_name: brandName,
                    quantity: quantity,
                    notes: notes
                };

                // Navigate before database operation to prevent UI blocking
                console.log('🚀 About to navigate to FoodLog...');
                navigateToFoodLog();

                // Continue with database operation after navigation has started
                console.log('Saving food log to local database:', foodLog);
                await addFoodLog(foodLog);
            }
        } catch (error) {
            setShowAnalysisModal(false);
            console.error('Error submitting food:', error);
            Alert.alert('Error', 'Failed to submit food. Please try again.');
        } finally {
            setLoading(false);
            setIsAnalyzing(false);
        }
    };

    // Function to calculate healthiness rating based on GPT description
    const calculateHealthinessRating = (description: string): number => {
        // Simple algorithm to estimate healthiness from description
        const healthyTerms = ['vegetable', 'fruit', 'protein', 'lean', 'nutritious', 'healthy', 'vitamin', 'mineral', 'fiber', 'whole grain'];
        const unhealthyTerms = ['processed', 'sugar', 'fat', 'fried', 'unhealthy', 'calorie', 'sodium', 'cholesterol', 'saturated', 'trans fat'];

        let score = 5; // Start with neutral score

        // Increase score for healthy terms
        healthyTerms.forEach(term => {
            if (description.toLowerCase().includes(term)) {
                score += 0.5;
            }
        });

        // Decrease score for unhealthy terms
        unhealthyTerms.forEach(term => {
            if (description.toLowerCase().includes(term)) {
                score -= 0.5;
            }
        });

        // Ensure score is between 1-10
        return Math.max(1, Math.min(10, Math.round(score)));
    };

    const toggleMealTypeDropdown = () => {
        setShowMealTypeDropdown(!showMealTypeDropdown);
    };

    const selectMealType = (type: string) => {
        setMealType(type);
        setShowMealTypeDropdown(false);
    };

    const renderImagePlaceholder = (index: number) => {
        const image = images[index];
        const isRequired = index === 0;
        const isSideView = index === 1;

        // Don't render side view unless it's been activated
        if (isSideView && !showSideView && !image.uri) {
            return null;
        }

        // Function to remove an image
        const handleRemoveImage = () => {
            const newImages = [...images];
            newImages[index] = {
                ...newImages[index],
                uri: '',
                uploaded: false
            };
            setImages(newImages);
        };

        return (
            <View style={[
                styles.imagePlaceholderWrapper, 
                index === 0 && styles.primaryImageWrapper,
                index === 1 && styles.sideImageWrapper
            ]}>
                <LinearGradient
                    colors={isRequired ? ["#FF00F5", "#9B00FF", "#00CFFF"] : ["#4a4a4a", "#666", "#4a4a4a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.imagePlaceholderGradient}
                    locations={[0, 0.5, 1]}
                >
                    <View style={styles.imagePlaceholder}>
                        {image.uri ? (
                            // Image is present - show the image with an X button
                            <View style={styles.imageContainer}>
                                <Image source={{ uri: image.uri }} style={styles.image} />
                                <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={handleRemoveImage}
                                >
                                    <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // No image - make the entire box clickable for camera
                            <TouchableOpacity
                                style={styles.placeholderContent}
                                onPress={() => handleTakePhoto(index)}
                            >
                                <Ionicons name="camera" size={index === 0 ? 50 : 40} color={isRequired ? "#8A2BE2" : "#666"} />
                                <Text style={[styles.placeholderText, { color: isRequired ? "#8A2BE2" : "#888" }]}>
                                    {index === 0 ? 'Tap to capture your meal' : 'Side view (optional)'}
                                </Text>
                                {isRequired && <Text style={styles.requiredText}>Required</Text>}
                            </TouchableOpacity>
                        )}

                        {/* Gallery button */}
                        <TouchableOpacity
                            style={[styles.galleryButton, { backgroundColor: isRequired ? "#8A2BE2" : "#4a4a4a" }]}
                            onPress={() => handlePickImage(index)}
                        >
                            <Ionicons name="images" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const renderAddSideViewButton = () => {
        if (showSideView || images[1].uri) return null;
        
        return (
            <TouchableOpacity 
                style={styles.addSideViewButton}
                onPress={() => setShowSideView(true)}
            >
                <LinearGradient
                    colors={["#4a4a4a", "#666", "#4a4a4a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.addSideViewGradient}
                    locations={[0, 0.5, 1]}
                >
                    <View style={styles.addSideViewContent}>
                        <Ionicons name="add" size={24} color="#fff" />
                        <Text style={styles.addSideViewText}>Add side view (optional)</Text>
                        <Text style={styles.addSideViewSubtext}>For better nutrition analysis</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderOptionalDetailsSection = () => {
        return (
            <View style={styles.optionalDetailsWrapper}>
                <TouchableOpacity 
                    style={styles.sectionHeader}
                    onPress={() => setShowOptionalDetails(!showOptionalDetails)}
                >
                    <View style={styles.sectionHeaderContent}>
                        <Ionicons name="settings-outline" size={20} color="#8A2BE2" />
                        <Text style={styles.sectionHeaderTitle}>Additional Details</Text>
                        <Text style={styles.sectionHeaderSubtitle}>Optional</Text>
                    </View>
                    <Ionicons 
                        name={showOptionalDetails ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color="#8A2BE2" 
                    />
                </TouchableOpacity>

                {showOptionalDetails && (
                    <View style={styles.optionalDetailsContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Food Name</Text>
                            <TextInput
                                style={styles.modernInput}
                                value={foodName}
                                onChangeText={setFoodName}
                                placeholder="e.g., Grilled Chicken Salad"
                                placeholderTextColor="#666"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Brand/Restaurant</Text>
                            <TextInput
                                style={styles.modernInput}
                                value={brandName}
                                onChangeText={setBrandName}
                                placeholder="e.g., McDonald's, Homemade"
                                placeholderTextColor="#666"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Quantity</Text>
                            <TextInput
                                style={styles.modernInput}
                                value={quantity}
                                onChangeText={setQuantity}
                                placeholder="e.g., 1 serving, 200g, 1 cup"
                                placeholderTextColor="#666"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Notes</Text>
                            <TextInput
                                style={[styles.modernInput, styles.textAreaInput]}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Any additional notes..."
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={3}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // Add a container style to ensure consistent background and proper spacing
    const containerStyle = {
        flex: 1,
        backgroundColor: '#000',
        // Removed dynamic padding to avoid blank space at the top
    };

    // If user cancels the analysis
    const handleAnalysisCancel = () => {
        // Implement any cancellation logic here
        // This might include aborting the network request if possible
        setShowAnalysisModal(false);
        setLoading(false);
        setIsAnalyzing(false);
        Alert.alert('Cancelled', 'Image analysis has been cancelled.');
    };

    return (
        <SafeAreaView style={[styles.container, containerStyle]}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <TouchableOpacity
                        style={styles.mealTypeSelector}
                        onPress={toggleMealTypeDropdown}
                    >
                        <MaskedView
                            maskElement={
                                <Text style={styles.headerTitle}>{mealType}</Text>
                            }
                        >
                            <LinearGradient
                                colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ height: 35, width: mealType.length * 16 }}
                            />
                        </MaskedView>

                        <View style={styles.dropdownIconContainer}>
                            <Ionicons name={showMealTypeDropdown ? "chevron-up" : "chevron-down"} size={22} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Empty view for balance */}
                <View style={{ width: 28 }} />

                {/* Meal Type Dropdown Modal */}
                <Modal
                    visible={showMealTypeDropdown}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={toggleMealTypeDropdown}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={toggleMealTypeDropdown}
                    >
                        <View style={styles.dropdownContainer}>
                            {mealTypes.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.dropdownItem,
                                        mealType === type && styles.selectedDropdownItem
                                    ]}
                                    onPress={() => selectMealType(type)}
                                >
                                    <Text
                                        style={[
                                            styles.dropdownItemText,
                                            mealType === type && styles.selectedDropdownItemText
                                        ]}
                                    >
                                        {type}
                                    </Text>
                                    {mealType === type && (
                                        <Ionicons name="checkmark" size={20} color="#8A2BE2" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableOpacity>
                </Modal>
            </View>

            <LinearGradient
                colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0 }}
                style={[styles.headerBar, { width: mealType.length * 16 + 40 }]}
                locations={[0, 0.5, 1]}
            />

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>Capture Your Meal</Text>
                    <Text style={styles.instructionsText}>
                        Take a slightly angled photo of your food for best results. If any parts are hidden from view, use the optional side view to capture those areas. You can also add additional context and details if needed.
                    </Text>
                </View>

                <View style={styles.imagesContainer}>
                    {renderImagePlaceholder(0)}
                    {renderAddSideViewButton()}
                    {renderImagePlaceholder(1)}
                </View>

                {renderOptionalDetailsSection()}

                <View style={styles.submitSection}>
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.submitGradient}
                            locations={[0, 0.5, 1]}
                        >
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator color="#fff" size="small" />
                                    <Text style={styles.submitText}>Processing...</Text>
                                </View>
                            ) : (
                                <Text style={styles.submitText}>Analyze My Meal</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                    
                    <Text style={styles.submitDescription}>
                        We'll analyze your food and provide detailed nutrition information
                    </Text>
                </View>
            </ScrollView>

            {/* Analysis Modal */}
            <AnalysisModal
                visible={showAnalysisModal}
                onCancel={handleAnalysisCancel}
                stage={analysisStage}
                imageUri={images.find(img => img.uri !== '')?.uri}
            />

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#000',
        zIndex: 10,
    },
    backButton: {
        padding: 4,
        width: 28,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdownIconContainer: {
        backgroundColor: '#161618',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        right: 0,
        top: 2,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    instructionsContainer: {
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    instructionsTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    instructionsText: {
        fontSize: 15,
        color: '#aaa',
        lineHeight: 22,
    },
    imagesContainer: {
        marginBottom: 24,
    },
    imagePlaceholderWrapper: {
        width: '100%',
        height: 280, // Make primary image square-ish
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    primaryImageWrapper: {
        height: 280, // Square aspect ratio for primary image
    },
    sideImageWrapper: {
        height: 160, // Rectangular aspect ratio for side image
    },
    imagePlaceholderGradient: {
        flex: 1,
        padding: 2,
    },
    imagePlaceholder: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    placeholderContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    placeholderText: {
        fontSize: 16,
        marginTop: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    requiredText: {
        color: '#ff6b6b',
        fontSize: 12,
        marginTop: 8,
        fontWeight: '600',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    removeImageButton: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    galleryButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#4a4a4a',
    },
    addSideViewButton: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        height: 80, // Smaller height for compact button
    },
    addSideViewGradient: {
        flex: 1,
        padding: 2,
    },
    addSideViewContent: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    addSideViewText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginTop: 8,
    },
    addSideViewSubtext: {
        fontSize: 13,
        color: '#aaa',
        marginTop: 4,
    },
    optionalDetailsWrapper: {
        marginBottom: 24,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#1a1a1a',
    },
    sectionHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionHeaderTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 12,
    },
    sectionHeaderSubtitle: {
        fontSize: 14,
        color: '#8A2BE2',
        marginLeft: 8,
        fontWeight: '500',
    },
    optionalDetailsContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#1a1a1a',
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        color: '#fff',
        marginBottom: 8,
        fontWeight: '500',
    },
    modernInput: {
        backgroundColor: '#2a2a2a',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    textAreaInput: {
        height: 80,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    submitSection: {
        marginTop: 8,
        alignItems: 'center',
    },
    submitButton: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
    },
    submitGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    submitText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitDescription: {
        fontSize: 13,
        color: '#aaa',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 20,
    },
    mealTypeSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        paddingRight: 40,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownContainer: {
        backgroundColor: '#1e1e1e',
        borderRadius: 10,
        width: '80%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    dropdownItem: {
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectedDropdownItem: {
        backgroundColor: 'rgba(138, 43, 226, 0.1)',
    },
    dropdownItemText: {
        fontSize: 18,
        color: '#fff',
    },
    selectedDropdownItemText: {
        color: '#8A2BE2',
        fontWeight: 'bold',
    },
    headerBar: {
        height: 2,
        marginBottom: 15,
        alignSelf: 'center',
        zIndex: 5,
    },
    // Legacy styles for backward compatibility
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    instructions: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 20,
        marginTop: -8,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    submitButtonWrapper: {
        marginTop: 6,
        marginBottom: 20,
        borderRadius: 8,
        overflow: 'hidden',
    },
    gradientWrapper: {
        flex: 1,
        padding: 1.5,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    imageActions: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        flexDirection: 'row',
    },
    imageButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    cameraButton: {
        backgroundColor: '#8A2BE2',
    },
    optionalText: {
        fontSize: 16,
        fontWeight: 'normal',
        color: '#777',
    },
    foodDetailsWrapper: {
        marginBottom: 6,
        borderRadius: 8,
        overflow: 'hidden',
    },
    foodDetailsContainer: {
        backgroundColor: '#0A0A0A',
        borderRadius: 6,
        padding: 15,
    },
    underlinedTitle: {
        textDecorationLine: 'underline',
    },
    descriptionBar: {
        height: 2,
        width: '100%',
        marginBottom: 15,
        marginTop: -5,
    },
    gptAnalysisWrapper: {
        marginTop: 6,
        marginBottom: 6,
        borderRadius: 8,
        overflow: 'hidden',
    },
    gptAnalysisContainer: {
        backgroundColor: '#1e1e1e',
        borderRadius: 6,
        padding: 15,
        width: '100%',
    },
    gptAnalysisTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#8A2BE2',
        marginBottom: 8,
    },
    gptAnalysisText: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
    },
});

export default ImageCapture; 