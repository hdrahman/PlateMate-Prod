import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput, Dimensions, ScrollView, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { addFoodLog } from '../utils/database';
import { barcodeService } from '../services/BarcodeService';
import { MacronutrientPieChart, MacronutrientProgress } from '../components/charts/NutritionCharts';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Modern color scheme
const COLORS = {
    PRIMARY_BG: '#000000',
    SECONDARY_BG: '#111111',
    CARD_BG: '#1a1a1a',
    WHITE: '#FFFFFF',
    GRAY_LIGHT: '#B0B0B0',
    GRAY_MEDIUM: '#808080',
    GRAY_DARK: '#333333',
    ACCENT_BLUE: '#0084ff',
    ACCENT_GREEN: '#32D74B',
    ACCENT_ORANGE: '#FF9500',
    ACCENT_RED: '#FF3B30',
    ACCENT_PURPLE: '#AF52DE',
    ACCENT_PINK: '#FF2D92',
    GLASS: 'rgba(255, 255, 255, 0.1)',
    GLASS_BORDER: 'rgba(255, 255, 255, 0.2)',
};

// Define navigation types
type RootStackParamList = {
    ImageCapture: { mealType: string; foodData?: any; photoUri?: string; sourcePage?: string };
    BarcodeResults: { foodData: any; mealType?: string };
    'Food Log': { refresh?: number };
    Camera: undefined;
    BarcodeScanner: undefined;
    MainTabs: { screen: string };
    Manual: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Animation timing constants
const ANIMATION_DURATION = 200;

export default function BarcodeScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [barcodeText, setBarcodeText] = useState('');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [quantity, setQuantity] = useState('1');
    const [servingUnit, setServingUnit] = useState('serving');
    const [mealType, setMealType] = useState('Snacks');
    const [showMealDropdown, setShowMealDropdown] = useState(false);
    const [notes, setNotes] = useState('');
    const [showQuickAdd, setShowQuickAdd] = useState(false);

    const cameraRef = useRef<CameraView>(null);
    const navigation = useNavigation<NavigationProp>();

    const mealTypes = [
        { name: 'Breakfast', icon: 'sunny-outline', color: COLORS.ACCENT_ORANGE },
        { name: 'Lunch', icon: 'restaurant-outline', color: COLORS.ACCENT_GREEN },
        { name: 'Dinner', icon: 'moon-outline', color: COLORS.ACCENT_BLUE },
        { name: 'Snacks', icon: 'cafe-outline', color: COLORS.ACCENT_PINK }
    ];

    // Define renderControlBar function before component logic
    const renderControlBar = () => (
        <View style={styles.controlBar}>
            <TouchableOpacity style={styles.controlButton} onPress={openGallery}>
                <BlurView intensity={30} style={styles.controlButtonInner}>
                    <Ionicons name="images-outline" size={24} color={COLORS.WHITE} />
                    <Text style={styles.buttonLabel}>Gallery</Text>
                </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={handleCapturePhoto}>
                <BlurView intensity={30} style={styles.controlButtonInner}>
                    <Ionicons name="camera-outline" size={28} color={COLORS.WHITE} />
                    <Text style={styles.buttonLabel}>Camera</Text>
                </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.controlButton, styles.activeControlButton]}>
                <BlurView intensity={50} style={styles.controlButtonInner}>
                    <MaterialCommunityIcons name="barcode-scan" size={24} color={COLORS.ACCENT_PINK} />
                    <Text style={[styles.buttonLabel, { color: COLORS.ACCENT_PINK }]}>Barcode</Text>
                </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={openFoodLog}>
                <BlurView intensity={30} style={styles.controlButtonInner}>
                    <Ionicons name="document-text-outline" size={24} color={COLORS.WHITE} />
                    <Text style={styles.buttonLabel}>Manual</Text>
                </BlurView>
            </TouchableOpacity>
        </View>
    );

    // Request camera permissions when component mounts
    useEffect(() => {
        (async () => {
            if (!permission?.granted) {
                await requestPermission();
            }
        })();
    }, []);

    // Handle screen focus events
    useFocusEffect(
        React.useCallback(() => {
            setIsCameraReady(false);
            setScanned(false);
            setShowPreview(false);
            setPreviewData(null);

            const timer = setTimeout(() => {
                setIsCameraReady(true);
            }, 300);

            return () => {
                clearTimeout(timer);
            };
        }, [])
    );

    const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
        if (scanned) return;

        if (!barcodeService.validateScanResult(result)) {
            console.warn('Invalid barcode scan result');
            return;
        }

        setScanned(true);
        setLoading(true);

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { type, data } = result;
        processBarcode(type, data);
    };

    const processBarcode = async (type: string, data: string) => {
        try {
            console.log(`Bar code with type ${type} and data ${data} has been scanned!`);

            const foodData = await barcodeService.lookupBarcode(data);

            if (foodData) {
                console.log('Successfully retrieved food data:', foodData.food_name);
                setPreviewData(foodData);
                setQuantity(foodData?.serving_qty ? String(foodData.serving_qty) : '1');
                setServingUnit(foodData?.serving_unit || 'serving');
                setShowPreview(true);

                // Success haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                console.log('No food data found in any API');

                // Error haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                Alert.alert(
                    'Product Not Found',
                    'This barcode wasn\'t found in our database. Try scanning another product or add it manually.',
                    [
                        {
                            text: 'Manual Entry',
                            onPress: () => navigation.navigate('Manual'),
                            style: 'default',
                        },
                        { text: 'Try Again', onPress: () => setScanned(false) },
                    ]
                );
            }
        } catch (error) {
            console.error('Error processing barcode:', error);

            // Error haptic
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            Alert.alert(
                'Scan Error',
                'Unable to process the barcode. Please check your connection and try again.',
                [
                    {
                        text: 'Manual Entry',
                        onPress: () => navigation.navigate('Manual'),
                        style: 'default',
                    },
                    { text: 'Try Again', onPress: () => setScanned(false) },
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    // Calculate nutrition values based on quantity
    const calculateNutrition = (baseValue: number, currentQuantity: string) => {
        const qty = parseFloat(currentQuantity) || 1;
        const baseQty = previewData?.serving_qty || 1;
        return Math.round((baseValue * qty) / baseQty);
    };

    const handleQuickAdd = async () => {
        if (!previewData) return;

        setShowQuickAdd(true);

        try {
            const userId = await AsyncStorage.getItem('user_id');
            if (!userId) {
                Alert.alert('Error', 'Please log in to continue');
                return;
            }

            const calories = calculateNutrition(previewData.calories || 0, quantity);
            const proteins = calculateNutrition(previewData.proteins || 0, quantity);
            const carbs = calculateNutrition(previewData.carbs || 0, quantity);
            const fats = calculateNutrition(previewData.fats || 0, quantity);

            const foodLogEntry = {
                user_id: parseInt(userId),
                meal_type: mealType,
                food_name: previewData.food_name || 'Unknown Food',
                brand_name: previewData.brand_name || '',
                quantity: `${quantity} ${servingUnit}`,
                calories: calories,
                proteins: proteins,
                carbs: carbs,
                fats: fats,
                notes: notes ? `${notes} | Quick scanned` : 'Quick scanned',
                timestamp: new Date().toISOString(),
            };

            const result = await addFoodLog(foodLogEntry);

            if (result) {
                // Success haptic
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                Alert.alert(
                    '✅ Added Successfully!',
                    `${previewData.food_name} added to ${mealType.toLowerCase()}.`,
                    [
                        {
                            text: 'View Food Log',
                            onPress: () => navigation.navigate('Food Log', { refresh: Date.now() })
                        },
                        {
                            text: 'Scan Another',
                            onPress: () => {
                                setShowPreview(false);
                                setPreviewData(null);
                                setScanned(false);
                            },
                            style: 'default'
                        }
                    ]
                );
            } else {
                throw new Error('Failed to add food log entry');
            }
        } catch (error) {
            console.error('Error adding food to log:', error);
            Alert.alert('Error', 'Failed to add food to log. Please try again.');
        } finally {
            setShowQuickAdd(false);
        }
    };

    const handleManualSubmit = () => {
        if (barcodeText.trim()) {
            processBarcode('manual', barcodeText.trim());
        }
    };

    const toggleTorch = async () => {
        setTorchOn(!torchOn);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Navigation functions
    const openGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                navigation.navigate('ImageCapture', {
                    mealType: 'Snacks',
                    photoUri: result.assets[0].uri,
                    sourcePage: 'BarcodeScanner'
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
        }
    };

    const handleCapturePhoto = () => {
        navigation.navigate('MainTabs', { screen: 'Camera' });
    };

    const openFoodLog = () => {
        navigation.navigate('Manual');
    };

    // If user denies camera permission
    if (permission?.granted === false) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="light-content" />
                <LinearGradient colors={[COLORS.PRIMARY_BG, COLORS.SECONDARY_BG]} style={styles.container}>
                    <View style={styles.permissionContainer}>
                        <MaterialIcons name="camera-alt" size={80} color={COLORS.GRAY_MEDIUM} />
                        <Text style={styles.permissionTitle}>Camera Access Required</Text>
                        <Text style={styles.permissionSubtitle}>
                            Allow camera access to scan product barcodes and discover nutrition information
                        </Text>
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <LinearGradient colors={[COLORS.ACCENT_PURPLE, COLORS.ACCENT_PINK]} style={styles.gradientButton}>
                                <Text style={styles.permissionButtonText}>Enable Camera</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                    {renderControlBar()}
                </LinearGradient>
            </SafeAreaView>
        );
    }

    const renderPreviewModal = () => {
        if (!showPreview || !previewData) return null;

        const calories = calculateNutrition(previewData.calories || 0, quantity);
        const proteins = calculateNutrition(previewData.proteins || 0, quantity);
        const carbs = calculateNutrition(previewData.carbs || 0, quantity);
        const fats = calculateNutrition(previewData.fats || 0, quantity);
        const fiber = previewData.fiber ? calculateNutrition(previewData.fiber, quantity) : null;
        const sugar = previewData.sugar ? calculateNutrition(previewData.sugar, quantity) : null;
        const sodium = previewData.sodium ? calculateNutrition(previewData.sodium, quantity) : null;

        // Get the best available image from Nutritionix API
        const getProductImage = () => {
            if (previewData?.photo?.thumb) return previewData.photo.thumb;
            if (previewData?.photo?.highres) return previewData.photo.highres;
            if (previewData?.image_url) return previewData.image_url;
            if (previewData?.thumbnail) return previewData.thumbnail;
            return null;
        };

        const productImage = getProductImage();

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showPreview}
                onRequestClose={() => setShowPreview(false)}
            >
                <View style={styles.modalContainer}>
                    <BlurView intensity={50} style={styles.modalBlur}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Nutrition Facts</Text>
                                <TouchableOpacity
                                    onPress={() => setShowPreview(false)}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={24} color={COLORS.WHITE} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                                {/* Enhanced Product Header with Image */}
                                <View style={styles.productHeaderCard}>
                                    <View style={styles.productImageSection}>
                                        {productImage ? (
                                            <View style={styles.productImageContainer}>
                                                <Image
                                                    source={{ uri: productImage }}
                                                    style={styles.productImage}
                                                    resizeMode="cover"
                                                />
                                                <View style={styles.scanBadge}>
                                                    <MaterialCommunityIcons name="barcode-scan" size={10} color={COLORS.ACCENT_BLUE} />
                                                    <Text style={styles.scanBadgeText}>SCANNED</Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={styles.placeholderImageContainer}>
                                                <MaterialCommunityIcons name="food" size={32} color={COLORS.GRAY_MEDIUM} />
                                                <View style={styles.scanBadge}>
                                                    <MaterialCommunityIcons name="barcode-scan" size={10} color={COLORS.ACCENT_BLUE} />
                                                    <Text style={styles.scanBadgeText}>SCANNED</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.productInfoSection}>
                                        <Text style={styles.enhancedProductName} numberOfLines={2}>
                                            {previewData.food_name}
                                        </Text>
                                        {previewData.brand_name && (
                                            <Text style={styles.enhancedBrandName}>{previewData.brand_name}</Text>
                                        )}
                                    </View>
                                </View>

                                {/* Enhanced Serving Size Controls */}
                                <View style={styles.enhancedServingCard}>
                                    <Text style={styles.sectionTitle}>Serving Size</Text>
                                    <View style={styles.enhancedServingControls}>
                                        <TouchableOpacity
                                            style={styles.enhancedQuantityButton}
                                            onPress={() => setQuantity(String(Math.max(0.1, parseFloat(quantity) - 0.5)))}
                                        >
                                            <Ionicons name="remove" size={18} color={COLORS.WHITE} />
                                        </TouchableOpacity>

                                        <View style={styles.enhancedQuantityDisplay}>
                                            <TextInput
                                                style={styles.enhancedQuantityInput}
                                                value={quantity}
                                                onChangeText={setQuantity}
                                                keyboardType="decimal-pad"
                                                selectTextOnFocus
                                            />
                                            <Text style={styles.enhancedServingUnitText}>{servingUnit}</Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.enhancedQuantityButton}
                                            onPress={() => setQuantity(String(parseFloat(quantity) + 0.5))}
                                        >
                                            <Ionicons name="add" size={18} color={COLORS.WHITE} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Enhanced Nutrition Display */}
                                <View style={styles.enhancedNutritionCard}>
                                    <Text style={styles.sectionTitle}>Nutrition Information</Text>

                                    {/* Large Calorie Display */}
                                    <View style={styles.enhancedCaloriesDisplay}>
                                        <Text style={styles.enhancedCaloriesNumber}>{calories}</Text>
                                        <Text style={styles.enhancedCaloriesLabel}>calories</Text>
                                    </View>

                                    {/* Enhanced Macros with Progress Bars */}
                                    <View style={styles.macrosSection}>
                                        <View style={styles.macroRow}>
                                            <View style={styles.macroItemEnhanced}>
                                                <View style={styles.macroHeader}>
                                                    <Text style={styles.macroValue}>{carbs}g</Text>
                                                    <Text style={styles.macroLabel}>Carbs</Text>
                                                </View>
                                                <View style={styles.macroBarContainer}>
                                                    <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_BLUE + '30' }]}>
                                                        <View style={[styles.macroProgress, {
                                                            width: `${Math.min(100, (carbs / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                                            backgroundColor: COLORS.ACCENT_BLUE
                                                        }]} />
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={styles.macroItemEnhanced}>
                                                <View style={styles.macroHeader}>
                                                    <Text style={styles.macroValue}>{proteins}g</Text>
                                                    <Text style={styles.macroLabel}>Protein</Text>
                                                </View>
                                                <View style={styles.macroBarContainer}>
                                                    <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_GREEN + '30' }]}>
                                                        <View style={[styles.macroProgress, {
                                                            width: `${Math.min(100, (proteins / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                                            backgroundColor: COLORS.ACCENT_GREEN
                                                        }]} />
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={styles.macroItemEnhanced}>
                                                <View style={styles.macroHeader}>
                                                    <Text style={styles.macroValue}>{fats}g</Text>
                                                    <Text style={styles.macroLabel}>Fat</Text>
                                                </View>
                                                <View style={styles.macroBarContainer}>
                                                    <View style={[styles.macroBar, { backgroundColor: COLORS.ACCENT_ORANGE + '30' }]}>
                                                        <View style={[styles.macroProgress, {
                                                            width: `${Math.min(100, (fats / Math.max(carbs, proteins, fats, 50)) * 100)}%`,
                                                            backgroundColor: COLORS.ACCENT_ORANGE
                                                        }]} />
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Additional Nutrients */}
                                {(fiber || sugar || sodium) && (
                                    <View style={styles.additionalNutrientsCard}>
                                        <Text style={styles.sectionTitle}>Additional Information</Text>
                                        <View style={styles.additionalNutrientsGrid}>
                                            {fiber && (
                                                <View style={styles.additionalNutrientItem}>
                                                    <Text style={styles.additionalNutrientValue}>{fiber}g</Text>
                                                    <Text style={styles.additionalNutrientLabel}>Fiber</Text>
                                                </View>
                                            )}
                                            {sugar && (
                                                <View style={styles.additionalNutrientItem}>
                                                    <Text style={styles.additionalNutrientValue}>{sugar}g</Text>
                                                    <Text style={styles.additionalNutrientLabel}>Sugar</Text>
                                                </View>
                                            )}
                                            {sodium && (
                                                <View style={styles.additionalNutrientItem}>
                                                    <Text style={styles.additionalNutrientValue}>{sodium}mg</Text>
                                                    <Text style={styles.additionalNutrientLabel}>Sodium</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Enhanced Meal Type Selection */}
                                <View style={styles.enhancedMealCard}>
                                    <Text style={styles.sectionTitle}>Add to Meal</Text>
                                    <View style={styles.enhancedMealTypeGrid}>
                                        {mealTypes.map((meal) => (
                                            <TouchableOpacity
                                                key={meal.name}
                                                style={[
                                                    styles.enhancedMealTypeButton,
                                                    mealType === meal.name && styles.enhancedActiveMealType
                                                ]}
                                                onPress={() => setMealType(meal.name)}
                                            >
                                                <Ionicons
                                                    name={meal.icon as any}
                                                    size={24}
                                                    color={mealType === meal.name ? COLORS.WHITE : meal.color}
                                                />
                                                <Text style={[
                                                    styles.enhancedMealTypeText,
                                                    mealType === meal.name && styles.enhancedActiveMealTypeText
                                                ]}>
                                                    {meal.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Enhanced Notes */}
                                <View style={styles.enhancedNotesCard}>
                                    <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                                    <TextInput
                                        style={styles.enhancedNotesInput}
                                        placeholder="Add any notes about this food..."
                                        placeholderTextColor={COLORS.GRAY_MEDIUM}
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        numberOfLines={3}
                                        maxLength={200}
                                        textAlignVertical="top"
                                    />
                                </View>

                                {/* Single Action Button - No View Details */}
                                <TouchableOpacity
                                    style={styles.finalAddButton}
                                    onPress={handleQuickAdd}
                                    disabled={showQuickAdd}
                                >
                                    <LinearGradient
                                        colors={showQuickAdd ? [COLORS.GRAY_MEDIUM, COLORS.GRAY_DARK] : [COLORS.ACCENT_BLUE, COLORS.ACCENT_PURPLE]}
                                        style={styles.finalAddButtonGradient}
                                    >
                                        {showQuickAdd ? (
                                            <ActivityIndicator color={COLORS.WHITE} />
                                        ) : (
                                            <>
                                                <Ionicons name="add" size={20} color={COLORS.WHITE} />
                                                <Text style={styles.finalAddButtonText}>Add to {mealType}</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </BlurView>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" />

            {isCameraReady && (
                <CameraView
                    style={styles.camera}
                    ref={cameraRef}
                    facing="back"
                    enableTorch={torchOn}
                    barcodeScannerSettings={{
                        barcodeTypes: [
                            "ean13",
                            "ean8",
                            "upc_e",
                            "upc_a"
                        ]
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    onCameraReady={() => console.log('Camera is ready')}
                    onMountError={(error) => console.error('Camera mount error:', error)}
                >
                    {!loading && (
                        <View style={styles.cameraOverlay}>
                            {/* Enhanced scanning interface */}
                            <View style={styles.scanningFrame}>
                                <View style={styles.scanLineContainer}>
                                    <View style={styles.scanLine} />
                                </View>
                                <View style={[styles.cornerBorder, styles.topLeft]} />
                                <View style={[styles.cornerBorder, styles.topRight]} />
                                <View style={[styles.cornerBorder, styles.bottomLeft]} />
                                <View style={[styles.cornerBorder, styles.bottomRight]} />
                            </View>

                            <View style={styles.instructionContainer}>
                                <Text style={styles.instructionText}>Point camera at barcode</Text>
                                <Text style={styles.subInstructionText}>Keep barcode in frame for automatic scanning</Text>
                            </View>

                            {/* Manual barcode input */}
                            <View style={styles.manualInputContainer}>
                                <BlurView intensity={30} style={styles.manualInputBlur}>
                                    <TextInput
                                        style={styles.manualInput}
                                        placeholder="Enter barcode manually"
                                        placeholderTextColor={COLORS.GRAY_MEDIUM}
                                        value={barcodeText}
                                        onChangeText={setBarcodeText}
                                        keyboardType="number-pad"
                                        returnKeyType="search"
                                        onSubmitEditing={handleManualSubmit}
                                    />
                                    <TouchableOpacity
                                        style={styles.manualSubmitButton}
                                        onPress={handleManualSubmit}
                                    >
                                        <Ionicons name="search" size={20} color={COLORS.WHITE} />
                                    </TouchableOpacity>
                                </BlurView>
                            </View>
                        </View>
                    )}
                </CameraView>
            )}

            {!isCameraReady && (
                <LinearGradient colors={[COLORS.PRIMARY_BG, COLORS.SECONDARY_BG]} style={styles.loadingCamera}>
                    <View style={styles.loadingContent}>
                        <View style={styles.loadingAnimation}>
                            <ActivityIndicator size="large" color={COLORS.ACCENT_PINK} />
                        </View>
                        <Text style={styles.loadingTitle}>Initializing Scanner</Text>
                        <Text style={styles.loadingSubtitle}>Preparing camera for barcode detection</Text>
                    </View>
                </LinearGradient>
            )}

            {/* Enhanced Header */}
            <BlurView intensity={30} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Barcode Scanner</Text>
                    <Text style={styles.headerSubtitle}>Scan any product barcode</Text>
                </View>

                <TouchableOpacity onPress={toggleTorch} style={styles.headerButton}>
                    <Ionicons
                        name={torchOn ? "flash" : "flash-off"}
                        size={22}
                        color={torchOn ? COLORS.ACCENT_ORANGE : COLORS.WHITE}
                    />
                </TouchableOpacity>
            </BlurView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <BlurView intensity={50} style={styles.loadingBlur}>
                        <View style={styles.loadingContent}>
                            <ActivityIndicator size="large" color={COLORS.ACCENT_PINK} />
                            <Text style={styles.loadingTitle}>Analyzing Product</Text>
                            <Text style={styles.loadingSubtitle}>Fetching nutrition information...</Text>
                        </View>
                    </BlurView>
                </View>
            )}

            {scanned && !loading && !showPreview && (
                <View style={styles.scanCompleteContainer}>
                    <BlurView intensity={30} style={styles.scanCompleteBlur}>
                        <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
                            <LinearGradient
                                colors={[COLORS.ACCENT_PURPLE, COLORS.ACCENT_PINK]}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="refresh" size={20} color={COLORS.WHITE} />
                                <Text style={styles.scanAgainText}>Scan Another</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            )}

            {renderControlBar()}
            {renderPreviewModal()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },

    // Header Styles
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: 'transparent',
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.GLASS,
        borderWidth: 1,
        borderColor: COLORS.GLASS_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.WHITE,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 12,
        color: COLORS.GRAY_LIGHT,
        marginTop: 2,
    },

    // Camera Styles
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 120,
        paddingBottom: 180,
    },

    // Scanning Frame Styles
    scanningFrame: {
        width: width * 0.75,
        height: width * 0.45,
        position: 'relative',
        backgroundColor: 'transparent',
        borderRadius: 16,
    },
    scanLineContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanLine: {
        width: '90%',
        height: 3,
        backgroundColor: COLORS.ACCENT_PINK,
        borderRadius: 2,
        opacity: 0.8,
        shadowColor: COLORS.ACCENT_PINK,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
    },
    cornerBorder: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: COLORS.ACCENT_PINK,
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderTopLeftRadius: 16,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 16,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 16,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 16,
    },

    // Instruction Styles
    instructionContainer: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    instructionText: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    subInstructionText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },

    // Manual Input Styles
    manualInputContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
    },
    manualInputBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.GLASS,
        borderWidth: 1,
        borderColor: COLORS.GLASS_BORDER,
    },
    manualInput: {
        flex: 1,
        color: COLORS.WHITE,
        fontSize: 16,
        paddingVertical: 8,
    },
    manualSubmitButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.ACCENT_PINK,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },

    // Loading Styles
    loadingCamera: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContent: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingAnimation: {
        marginBottom: 20,
    },
    loadingTitle: {
        color: COLORS.WHITE,
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    loadingSubtitle: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 200,
    },
    loadingBlur: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Scan Complete Styles
    scanCompleteContainer: {
        position: 'absolute',
        top: '60%',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 150,
    },
    scanCompleteBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    scanAgainButton: {
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 160,
    },
    scanAgainText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Control Bar Styles
    controlBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        zIndex: 100,
    },
    controlButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    activeControlButton: {
        transform: [{ scale: 1.1 }],
    },
    controlButtonInner: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: 70,
        paddingVertical: 8,
        backgroundColor: COLORS.GLASS,
        borderWidth: 1,
        borderColor: COLORS.GLASS_BORDER,
    },
    buttonLabel: {
        color: COLORS.WHITE,
        fontSize: 11,
        fontWeight: '500',
        marginTop: 4,
        textAlign: 'center',
    },

    // Permission Styles
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 200,
    },
    permissionTitle: {
        color: COLORS.WHITE,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 16,
    },
    permissionSubtitle: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    permissionButton: {
        borderRadius: 16,
        overflow: 'hidden',
        minWidth: 200,
    },
    permissionButtonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
    },

    // Common Styles
    sectionTitle: {
        color: COLORS.WHITE,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBlur: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.CARD_BG,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: height * 0.9,
        paddingTop: 20,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: COLORS.GLASS_BORDER,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.GRAY_DARK,
    },
    modalTitle: {
        color: COLORS.WHITE,
        fontSize: 22,
        fontWeight: '700',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.GRAY_DARK,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalScrollView: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },

    // Product Card Styles
    productHeaderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        marginBottom: 20,
    },
    productImageSection: {
        marginRight: 20,
    },
    productImageContainer: {
        position: 'relative',
    },
    productImage: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    scanBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: COLORS.ACCENT_BLUE,
        borderRadius: 12,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    scanBadgeText: {
        color: COLORS.WHITE,
        fontSize: 12,
        fontWeight: '600',
    },
    placeholderImageContainer: {
        width: 100,
        height: 100,
        borderRadius: 8,
        backgroundColor: COLORS.SECONDARY_BG,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productInfoSection: {
        flex: 1,
    },
    enhancedProductName: {
        color: COLORS.WHITE,
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        lineHeight: 26,
    },
    enhancedBrandName: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 16,
        fontWeight: '500',
    },

    // Enhanced Serving Size Styles
    enhancedServingCard: {
        backgroundColor: COLORS.SECONDARY_BG,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    enhancedServingControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    enhancedQuantityButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.ACCENT_PINK,
        alignItems: 'center',
        justifyContent: 'center',
    },
    enhancedQuantityDisplay: {
        alignItems: 'center',
        marginHorizontal: 24,
        minWidth: 120,
    },
    enhancedQuantityInput: {
        color: COLORS.WHITE,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        minWidth: 80,
        marginBottom: 8,
    },
    enhancedServingUnitText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '500',
    },

    // Enhanced Nutrition Styles
    enhancedNutritionCard: {
        backgroundColor: COLORS.SECONDARY_BG,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    enhancedCaloriesDisplay: {
        alignItems: 'center',
        marginBottom: 20,
    },
    enhancedCaloriesNumber: {
        color: COLORS.WHITE,
        fontSize: 36,
        fontWeight: '800',
    },
    enhancedCaloriesLabel: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '500',
        marginTop: 4,
    },
    macrosSection: {
        marginBottom: 20,
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    macroItemEnhanced: {
        flex: 1,
        alignItems: 'center',
    },
    macroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    macroValue: {
        color: COLORS.WHITE,
        fontSize: 20,
        fontWeight: '700',
    },
    macroLabel: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '500',
    },
    macroBarContainer: {
        height: 20,
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 10,
        overflow: 'hidden',
    },
    macroBar: {
        height: '100%',
        backgroundColor: COLORS.ACCENT_PINK,
    },
    macroProgress: {
        height: '100%',
        backgroundColor: COLORS.ACCENT_PINK,
    },

    // Additional Nutrients Styles
    additionalNutrientsCard: {
        backgroundColor: COLORS.SECONDARY_BG,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    additionalNutrientsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    additionalNutrientItem: {
        width: '48%',
        marginBottom: 12,
    },
    additionalNutrientValue: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '700',
    },
    additionalNutrientLabel: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '500',
    },

    // Enhanced Meal Type Styles
    enhancedMealCard: {
        backgroundColor: COLORS.SECONDARY_BG,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    enhancedMealTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    enhancedMealTypeButton: {
        width: '48%',
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    enhancedActiveMealType: {
        backgroundColor: COLORS.ACCENT_PINK,
        borderColor: COLORS.ACCENT_PINK,
    },
    enhancedMealTypeText: {
        color: COLORS.GRAY_LIGHT,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    enhancedActiveMealTypeText: {
        color: COLORS.WHITE,
    },

    // Enhanced Notes Styles
    enhancedNotesCard: {
        backgroundColor: COLORS.SECONDARY_BG,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    enhancedNotesInput: {
        color: COLORS.WHITE,
        fontSize: 16,
        backgroundColor: COLORS.GRAY_DARK,
        borderRadius: 12,
        padding: 16,
        minHeight: 80,
        textAlignVertical: 'top',
    },

    // Final Add Button Styles
    finalAddButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    finalAddButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
    },
    finalAddButtonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});