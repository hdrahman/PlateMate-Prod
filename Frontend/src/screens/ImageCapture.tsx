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
import { addFoodLog, addMultipleFoodLogs } from '../utils/database';
import { BACKEND_URL } from '../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnalysisModal from '../components/AnalysisModal';

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
    }, []);

    const compressImage = async (uri: string): Promise<string> => {
        try {
            console.log('Compressing image...');
            // Compress image while maintaining good quality for AI analysis
            // 1200px width is sufficient for AI analysis while keeping file size manageable
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1200 } }],
                { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
            );

            console.log('Image compressed successfully');
            console.log(`Original URI: ${uri}`);
            console.log(`Compressed URI: ${manipResult.uri}`);

            return manipResult.uri;
        } catch (error) {
            console.error('Error compressing image:', error);
            // Fall back to original image if compression fails
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
                // Compress image before storing it
                const compressedUri = await compressImage(result.assets[0].uri);

                const newImages = [...images];
                newImages[index] = {
                    ...newImages[index],
                    uri: compressedUri,
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
                // Compress image before storing it
                const compressedUri = await compressImage(result.assets[0].uri);

                const newImages = [...images];
                newImages[index] = {
                    ...newImages[index],
                    uri: compressedUri,
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

            const formData = new FormData();
            formData.append('user_id', '1');
            formData.append('image', {
                uri,
                type: 'image/jpeg',
                name: fileInfo.uri.split('/').pop(),
            } as any);

            console.log('Sending request to backend...');
            const response = await fetch(`${BACKEND_URL}/images/upload-image`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const endTime = Date.now();
            console.log(`Upload + Analysis time: ${(endTime - startTime) / 1000} seconds`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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

            const response = await fetch(`${BACKEND_URL}/gpt/analyze-food`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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

    const uploadMultipleImages = async (imageUris: string[]): Promise<{ meal_id: number, nutrition_data: any }> => {
        try {
            console.log('Starting multiple image upload...');
            const startTime = Date.now();
            setAnalysisStage('uploading');

            const formData = new FormData();
            formData.append('user_id', '1');

            // Add all images to the form data
            for (let i = 0; i < imageUris.length; i++) {
                const uri = imageUris[i];
                const filename = uri.split('/').pop() || `image${i}.jpg`;

                const fileInfo = await FileSystem.getInfoAsync(uri);
                console.log(`Image ${i + 1} file info: ${fileInfo.exists ? 'File exists' : 'File does not exist'}`);
                if (fileInfo.exists && 'size' in fileInfo) {
                    console.log(`Image ${i + 1} file size: ${fileInfo.size} bytes`);
                }

                // Convert file:// URI to blob or base64 if needed
                formData.append('images', {
                    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                    type: 'image/jpeg',
                    name: filename,
                } as any);
            }

            console.log('📤 Uploading images to:', `${BACKEND_URL}/images/upload-multiple-images`);

            // Update modal stage after images are prepared 
            setAnalysisStage('analyzing');

            const response = await fetch(`${BACKEND_URL}/images/upload-multiple-images`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            // Update stage once we get response
            setAnalysisStage('processing');

            const endTime = Date.now();
            console.log(`Multiple uploads + Analysis time: ${(endTime - startTime) / 1000} seconds`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Upload failed with status:', response.status);
                console.error('❌ Error details:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
                meal_id: data.meal_id,
                nutrition_data: data.nutrition_data || {}
            };
        } catch (error) {
            console.error('Multiple image upload failed:', error);
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
                    meal_id: Date.now(), // Generate a unique meal ID
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
                await addFoodLog(foodLog);

                // Navigate back to the food log screen with refresh parameter
                Alert.alert('Success', 'Food added successfully', [
                    {
                        text: 'OK',
                        onPress: async () => {
                            // Add a small delay to ensure database operations complete
                            await new Promise(resolve => setTimeout(resolve, 500));

                            try {
                                // Get the route information to check where we came from
                                const params = route.params as { mealType: string; photoUri?: string; foodData?: any; sourcePage?: string };
                                const routeName = params.sourcePage || 'FoodLog';
                                const refreshTimestamp = Date.now();

                                // First go back to clear the navigation stack
                                navigation.goBack();

                                // Wait a moment before updating the FoodLog screen
                                setTimeout(() => {
                                    // Only update FoodLog if we're not returning to Camera or BarcodeScanner
                                    if (routeName === 'FoodLog') {
                                        console.log('Sending refresh param to FoodLog:', refreshTimestamp);
                                        navigation.dispatch(
                                            StackActions.replace('FoodLog', { refresh: refreshTimestamp })
                                        );
                                    }
                                }, 100);
                            } catch (error) {
                                console.error('Navigation error:', error);
                            }
                        }
                    }
                ]);
                return;
            } catch (error) {
                console.error('Error submitting barcode food:', error);
                Alert.alert('Error', 'Failed to submit food. Please try again.');
                setLoading(false);
                return;
            }
        }

        // Check if at least 2 images are taken when not using barcode data
        const filledImages = images.filter(img => img.uri !== '');
        if (filledImages.length < 1) {
            Alert.alert('Error', 'Please take at least 1 image (top view)');
            return;
        }

        // Check if the first required image is taken
        if (!images[0].uri) {
            Alert.alert('Error', 'Please take a top view image');
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

            // Upload all images at once
            console.log('Uploading multiple images...');
            const result = await uploadMultipleImages(imageUris);
            console.log('Multiple images uploaded successfully');

            // Format current date as ISO string (YYYY-MM-DD)
            const today = new Date();
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            console.log(`Saving food logs with date: ${formattedDate}`);

            // Check if we have an array of nutrition data
            if (Array.isArray(result.nutrition_data) && result.nutrition_data.length > 0) {
                // Process each food item in the array
                const foodLogsToInsert = [];

                for (const nutritionData of result.nutrition_data) {
                    // Create a food log entry with all required fields
                    const foodLog = {
                        meal_id: result.meal_id,
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
                        image_url: imageUris[0],
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

                console.log(`Saving ${foodLogsToInsert.length} food logs to local database in batch`);
                await addMultipleFoodLogs(foodLogsToInsert);
                console.log(`Saved ${result.nutrition_data.length} food items to database`);
            } else {
                // Fallback to old behavior if not an array or empty
                const nutritionData = result.nutrition_data[0] || {};

                // Create a food log entry with all required fields
                const foodLog = {
                    meal_id: result.meal_id,
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
                    image_url: imageUris[0],
                    file_key: 'default_key',
                    healthiness_rating: nutritionData.healthiness_rating || 5,
                    date: formattedDate,
                    meal_type: mealType,
                    brand_name: brandName,
                    quantity: quantity,
                    notes: notes
                };

                console.log('Saving food log to local database:', foodLog);
                await addFoodLog(foodLog);
            }

            // Hide the analysis modal
            setShowAnalysisModal(false);

            // Navigate back to the food log screen with refresh parameter
            Alert.alert('Success', 'Food added successfully', [
                {
                    text: 'OK',
                    onPress: async () => {
                        // Add a small delay to ensure database operations complete
                        await new Promise(resolve => setTimeout(resolve, 500));

                        try {
                            // Get the route information to check where we came from
                            const params = route.params as { mealType: string; photoUri?: string; foodData?: any; sourcePage?: string };
                            const routeName = params.sourcePage || 'FoodLog';
                            const refreshTimestamp = Date.now();

                            // First go back to clear the navigation stack
                            navigation.goBack();

                            // Wait a moment before updating the FoodLog screen
                            setTimeout(() => {
                                // Only update FoodLog if we're not returning to Camera or BarcodeScanner
                                if (routeName === 'FoodLog') {
                                    console.log('Sending refresh param to FoodLog:', refreshTimestamp);
                                    navigation.dispatch(
                                        StackActions.replace('FoodLog', { refresh: refreshTimestamp })
                                    );
                                }
                            }, 100);
                        } catch (error) {
                            console.error('Navigation error:', error);
                        }
                    }
                }
            ]);

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
            <View style={styles.imagePlaceholderWrapper}>
                <LinearGradient
                    colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
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
                                <Ionicons name="camera" size={40} color="#8A2BE2" />
                                <Text style={styles.placeholderText}>
                                    {index === 0 ? 'Top View' : index === 1 ? 'Side View' : 'Additional'}
                                </Text>
                                {isRequired && <Text style={styles.requiredText}>Required</Text>}
                            </TouchableOpacity>
                        )}

                        {/* Keep only the gallery button at the bottom */}
                        <View style={styles.imageActions}>
                            <TouchableOpacity
                                style={[styles.imageButton, styles.galleryButton]}
                                onPress={() => handlePickImage(index)}
                            >
                                <Ionicons name="images" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    // Add a container style to ensure consistent background and proper spacing
    const containerStyle = {
        flex: 1,
        backgroundColor: '#000',
        // Ensure padding for status bar if needed
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
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

            <ScrollView style={styles.content}>
                <Text style={styles.instructions}>
                    Please take at least 1 image of your food. The first image (top view) is required. You can also take a second image (side view) to provide additional detail about your meal.
                </Text>
                <LinearGradient
                    colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 0 }}
                    style={styles.descriptionBar}
                    locations={[0, 0.5, 1]}
                />

                <View style={styles.imagesContainer}>
                    {renderImagePlaceholder(0)}
                    {renderImagePlaceholder(1)}
                </View>

                <View style={styles.foodDetailsWrapper}>
                    <LinearGradient
                        colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradientWrapper, { borderRadius: 8 }]}
                        locations={[0, 0.5, 1]}
                    >
                        <View style={styles.foodDetailsContainer}>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={[styles.sectionTitle, styles.underlinedTitle]}>Food Details</Text>
                                <Text style={[styles.sectionTitle, styles.optionalText]}> (Optional)</Text>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Brand/Restaurant Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={brandName}
                                    onChangeText={setBrandName}
                                    placeholder="Enter brand or restaurant name"
                                    placeholderTextColor="#888"
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Food Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={foodName}
                                    onChangeText={setFoodName}
                                    placeholder="Enter food name"
                                    placeholderTextColor="#888"
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Quantity</Text>
                                <TextInput
                                    style={styles.input}
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    placeholder="Enter quantity (e.g., 1 serving, 200g)"
                                    placeholderTextColor="#888"
                                />
                            </View>

                            <View style={[styles.inputContainer, { marginBottom: 0 }]}>
                                <Text style={styles.label}>Additional Notes</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Enter any additional notes"
                                    placeholderTextColor="#888"
                                    multiline
                                    numberOfLines={4}
                                />
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                <View style={styles.submitButtonWrapper}>
                    <LinearGradient
                        colors={["#FF00F5", "#9B00FF", "#00CFFF"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradientWrapper, { borderRadius: 8 }]}
                        locations={[0, 0.5, 1]}
                    >
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit</Text>
                            )}
                        </TouchableOpacity>
                    </LinearGradient>
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
        zIndex: 10, // Ensure header is above other content
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
    headerTitleContainer: {
        // Remove this style that had position: 'absolute'
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
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    imagePlaceholderWrapper: {
        width: (width - 50) / 2,
        height: (width - 50) / 2,
        marginBottom: 10,
        borderRadius: 10,
        overflow: 'hidden',
    },
    imagePlaceholderGradient: {
        flex: 1,
        padding: 1.5, // Reduced from 2px to be slightly thinner
    },
    imagePlaceholder: {
        flex: 1,
        backgroundColor: '#1e1e1e',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    placeholderContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#8A2BE2',
        marginTop: 10,
        fontSize: 14,
    },
    requiredText: {
        color: '#ff6b6b',
        fontSize: 12,
        marginTop: 5,
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
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
    galleryButton: {
        backgroundColor: '#4a4a4a',
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
        padding: 1.5, // Reduced from 2px to be slightly thinner
    },
    submitButton: {
        backgroundColor: '#1e1e1e',
        padding: 15,
        alignItems: 'center',
        width: '100%',
        borderRadius: 6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
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
    imageContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
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
    headerBar: {
        height: 2,
        marginBottom: 15,
        alignSelf: 'center',
        zIndex: 5,
    },
});

export default ImageCapture; 