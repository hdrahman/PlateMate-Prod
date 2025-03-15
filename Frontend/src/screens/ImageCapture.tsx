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
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { launchCameraAsync, MediaTypeOptions } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { addFoodLog } from '../utils/database';

const { width } = Dimensions.get('window');
const BACKEND_URL = 'http://172.31.153.15:8000';

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
    const navigation = useNavigation();
    const route = useRoute();
    const { mealType: initialMealType } = route.params as { mealType: string };

    const [mealType, setMealType] = useState(initialMealType);
    const [showMealTypeDropdown, setShowMealTypeDropdown] = useState(false);
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

    const [images, setImages] = useState<ImageInfo[]>([
        { uri: '', type: 'top', uploaded: false },
        { uri: '', type: 'side', uploaded: false },
        { uri: '', type: 'additional', uploaded: false },
        { uri: '', type: 'additional', uploaded: false }
    ]);

    const [brandName, setBrandName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Add state for GPT-generated description
    const [gptDescription, setGptDescription] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Camera permission is required to take photos');
            }
        })();
    }, []);

    const handleTakePhoto = async (index: number) => {
        try {
            const result = await launchCameraAsync({
                mediaTypes: MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: true,
                aspect: [4, 3]
            });

            if (!result.canceled) {
                const newImages = [...images];
                newImages[index] = {
                    ...newImages[index],
                    uri: result.assets[0].uri,
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
                allowsEditing: true,
                aspect: [4, 3]
            });

            if (!result.canceled) {
                const newImages = [...images];
                newImages[index] = {
                    ...newImages[index],
                    uri: result.assets[0].uri,
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
            const fileInfo = await FileSystem.getInfoAsync(uri);

            const formData = new FormData();
            formData.append('user_id', '1');
            formData.append('image', {
                uri,
                type: 'image/jpeg',
                name: fileInfo.uri.split('/').pop(),
            } as any);

            const response = await fetch(`${BACKEND_URL}/images/upload-image`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

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

    const handleSubmit = async () => {
        // Check if at least 2 images are taken
        const filledImages = images.filter(img => img.uri !== '');
        if (filledImages.length < 2) {
            Alert.alert('Error', 'Please take at least 2 images (top view and side view)');
            return;
        }

        // Check if the first two required images are taken
        if (!images[0].uri || !images[1].uri) {
            Alert.alert('Error', 'Please take both the top view and side view images');
            return;
        }

        setLoading(true);
        setIsAnalyzing(true);

        try {
            // Upload all images first
            console.log('Uploading images...');
            const uploadPromises = filledImages.map(img => uploadImage(img.uri));
            const uploadResults = await Promise.all(uploadPromises);
            console.log('All images uploaded successfully');

            // Combine nutrition data from all images
            const combinedData = uploadResults.reduce<NutritionData>((acc, result) => {
                const data = result.data;
                if (!data) return acc;

                // Combine calories, proteins, carbs, fats
                acc.calories = (acc.calories || 0) + (data.calories || 0);
                acc.proteins = (acc.proteins || 0) + (data.proteins || 0);
                acc.carbs = (acc.carbs || 0) + (data.carbs || 0);
                acc.fats = (acc.fats || 0) + (data.fats || 0);

                // Use the food name from the first image if not already set
                if (!acc.food_name && data.food_name) {
                    acc.food_name = data.food_name;
                }

                return acc;
            }, {});

            // Get valid image URLs for GPT analysis
            const imageUrls = uploadResults
                .map(result => result.url)
                .filter(url => url && typeof url === 'string');

            console.log('Image URLs for GPT analysis:', imageUrls);

            if (imageUrls.length === 0) {
                throw new Error('No valid image URLs available for analysis');
            }

            // Analyze food with GPT - do this only once with all images
            console.log('Sending to GPT for analysis...');
            const description = await analyzeFoodWithGPT(imageUrls, combinedData.food_name || 'Unknown Food');
            console.log('GPT analysis complete');
            setGptDescription(description);

            // Calculate healthiness rating based on GPT analysis (1-10 scale)
            const healthinessRating = calculateHealthinessRating(description);

            // Create a new food log entry
            const foodLog = {
                meal_id: Date.now(),
                food_name: combinedData.food_name || 'Unknown Food',
                calories: combinedData.calories || 0,
                proteins: combinedData.proteins || 0,
                carbs: combinedData.carbs || 0,
                fats: combinedData.fats || 0,
                image_url: uploadResults[0]?.url || '', // Use the first image as the main image
                file_key: uploadResults[0]?.key || 'default_key',
                healthiness_rating: healthinessRating,
                meal_type: mealType,
                brand_name: brandName,
                quantity: quantity,
                notes: notes ? `${notes}\n\nGPT Analysis: ${description}` : `GPT Analysis: ${description}`
            };

            // Add to local database
            await addFoodLog(foodLog);

            // Navigate back to the food log screen
            Alert.alert('Success', 'Food added successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Error submitting food:', error);
            Alert.alert('Error', 'Failed to submit food');
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
        const isRequired = index < 2;

        return (
            <View style={styles.imagePlaceholder}>
                {image.uri ? (
                    <Image source={{ uri: image.uri }} style={styles.image} />
                ) : (
                    <View style={styles.placeholderContent}>
                        <Ionicons name="camera" size={40} color="#8A2BE2" />
                        <Text style={styles.placeholderText}>
                            {index === 0 ? 'Top View' : index === 1 ? 'Side View' : 'Additional'}
                        </Text>
                        {isRequired && <Text style={styles.requiredText}>Required</Text>}
                    </View>
                )}

                <View style={styles.imageActions}>
                    <TouchableOpacity
                        style={[styles.imageButton, styles.cameraButton]}
                        onPress={() => handleTakePhoto(index)}
                    >
                        <Ionicons name="camera" size={20} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.imageButton, styles.galleryButton]}
                        onPress={() => handlePickImage(index)}
                    >
                        <Ionicons name="images" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a1a', '#2d1a3c']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>

                {/* Meal Type Dropdown */}
                <View style={styles.headerTitleContainer}>
                    <TouchableOpacity
                        style={[styles.mealTypeSelector, { width: mealType.length * 14 + 40 }]}
                        onPress={toggleMealTypeDropdown}
                    >
                        <Text style={styles.headerTitle}>{mealType}</Text>
                        <View style={styles.dropdownIcon}>
                            <Ionicons name={showMealTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color="#FFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Empty view for balance */}
                <View style={styles.backButton} />

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
            </LinearGradient>

            <ScrollView style={styles.content}>
                <Text style={styles.sectionTitle}>Food Images</Text>
                <Text style={styles.instructions}>
                    Please take at least 2 images of your food. The first should be a top view, and the second a side view.
                </Text>

                <View style={styles.imagesContainer}>
                    {renderImagePlaceholder(0)}
                    {renderImagePlaceholder(1)}
                    {renderImagePlaceholder(2)}
                    {renderImagePlaceholder(3)}
                </View>

                <Text style={styles.sectionTitle}>Food Details</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Brand Name</Text>
                    <TextInput
                        style={styles.input}
                        value={brandName}
                        onChangeText={setBrandName}
                        placeholder="Enter brand name"
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

                <View style={styles.inputContainer}>
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

                {gptDescription ? (
                    <View style={styles.gptAnalysisContainer}>
                        <Text style={styles.gptAnalysisTitle}>AI Analysis</Text>
                        <Text style={styles.gptAnalysisText}>{gptDescription}</Text>
                    </View>
                ) : isAnalyzing ? (
                    <View style={styles.gptAnalysisContainer}>
                        <Text style={styles.gptAnalysisTitle}>Analyzing with AI...</Text>
                        <ActivityIndicator color="#8A2BE2" style={{ marginTop: 10 }} />
                    </View>
                ) : null}

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
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 25,
        paddingBottom: 15,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    backButton: {
        marginRight: 15,
        width: 28,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginRight: 8,
    },
    content: {
        flex: 1,
        padding: 20,
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
    },
    imagesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    imagePlaceholder: {
        width: (width - 50) / 2,
        height: (width - 50) / 2,
        backgroundColor: '#1e1e1e',
        borderRadius: 10,
        marginBottom: 10,
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
    submitButton: {
        backgroundColor: '#8A2BE2',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
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
        flex: 0,
        marginRight: 40,
        paddingVertical: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(138, 43, 226, 0.7)',
        paddingHorizontal: 0,
        alignSelf: 'center',
    },
    dropdownIcon: {
        backgroundColor: 'rgba(138, 43, 226, 0.5)',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
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
    gptAnalysisContainer: {
        backgroundColor: 'rgba(138, 43, 226, 0.1)',
        borderRadius: 8,
        padding: 15,
        marginTop: 10,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#8A2BE2',
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