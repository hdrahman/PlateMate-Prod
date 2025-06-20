import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { NUTRITION_COLORS } from '../charts/NutritionCharts';

const { width, height } = Dimensions.get('window');

interface IntroStep3Props {
    onNext: () => void;
}

const IntroStep3: React.FC<IntroStep3Props> = ({ onNext }) => {
    const insets = useSafeAreaInsets();

    // Sample macros data for the overlay - different from IntroStep2
    const sampleMacros = {
        protein: 18,
        carbs: 45,
        fat: 12,
        calories: 356
    };

    // Calculate percentages for the visual representation
    const total = sampleMacros.protein + sampleMacros.carbs + sampleMacros.fat;
    const proteinPercentage = (sampleMacros.protein / total) * 100;
    const carbsPercentage = (sampleMacros.carbs / total) * 100;
    const fatPercentage = (sampleMacros.fat / total) * 100;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Background elements */}
            <LinearGradient
                colors={['#000000', '#0a0a0a', '#111111']}
                style={styles.backgroundGradient}
            />

            {/* Decorative background elements */}
            <View style={styles.circlesContainer}>
                <View style={[styles.circle, styles.circle1]} />
                <View style={[styles.circle, styles.circle2]} />
                <View style={[styles.circle, styles.circle3]} />
            </View>

            <View style={styles.contentWrapper}>
                {/* Main content - Removed logo as requested and moved image to top */}
                <View style={styles.mainContent}>
                    {/* Food image at the top */}
                    <View style={styles.topImageContainer}>
                        <Image
                            source={require('../../../assets/food.png')}
                            style={styles.topImage}
                            resizeMode="cover"
                        />
                        <View style={styles.imageOverlay} />

                        {/* Macros Overlay */}
                        <View style={styles.macrosOverlayContainer}>
                            <BlurView intensity={80} style={styles.macrosBlurView} tint="dark">
                                <View style={styles.macrosContent}>
                                    <View style={styles.macrosHeader}>
                                        <Text style={styles.macrosTitle}>Scanned Food</Text>
                                        <View style={styles.macrosBadge}>
                                            <Text style={styles.macrosBadgeText}>AI Analysis</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.foodNameText}>Grilled Chicken Salad</Text>
                                    <Text style={styles.caloriesText}>{sampleMacros.calories} calories</Text>

                                    {/* Macro bar visualization */}
                                    <View style={styles.macroBar}>
                                        <View
                                            style={[
                                                styles.macroBarSegment,
                                                {
                                                    backgroundColor: NUTRITION_COLORS.PROTEIN,
                                                    width: `${proteinPercentage}%`
                                                }
                                            ]}
                                        />
                                        <View
                                            style={[
                                                styles.macroBarSegment,
                                                {
                                                    backgroundColor: NUTRITION_COLORS.CARBS,
                                                    width: `${carbsPercentage}%`
                                                }
                                            ]}
                                        />
                                        <View
                                            style={[
                                                styles.macroBarSegment,
                                                {
                                                    backgroundColor: NUTRITION_COLORS.FAT,
                                                    width: `${fatPercentage}%`
                                                }
                                            ]}
                                        />
                                    </View>

                                    {/* Macro details */}
                                    <View style={styles.macroDetailsContainer}>
                                        <View style={styles.macroDetail}>
                                            <View style={[styles.macroCircle, { backgroundColor: NUTRITION_COLORS.PROTEIN }]} />
                                            <View>
                                                <Text style={styles.macroValue}>{sampleMacros.protein}g</Text>
                                                <Text style={styles.macroLabel}>Protein</Text>
                                            </View>
                                        </View>
                                        <View style={styles.macroDetail}>
                                            <View style={[styles.macroCircle, { backgroundColor: NUTRITION_COLORS.CARBS }]} />
                                            <View>
                                                <Text style={styles.macroValue}>{sampleMacros.carbs}g</Text>
                                                <Text style={styles.macroLabel}>Carbs</Text>
                                            </View>
                                        </View>
                                        <View style={styles.macroDetail}>
                                            <View style={[styles.macroCircle, { backgroundColor: NUTRITION_COLORS.FAT }]} />
                                            <View>
                                                <Text style={styles.macroValue}>{sampleMacros.fat}g</Text>
                                                <Text style={styles.macroLabel}>Fat</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </BlurView>
                        </View>
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={styles.welcomeText}>Your Journey Begins</Text>
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.divider}
                        />
                        <Text style={styles.descriptionText}>
                            Join thousands who've transformed their health with PlateMate's
                            AI-powered nutrition tracking and personalized insights.
                        </Text>
                    </View>

                    <View style={styles.featuresContainer}>
                        <View style={styles.featureItem}>
                            <LinearGradient
                                colors={["rgba(0,116,221,0.2)", "rgba(0,116,221,0.05)"]}
                                style={styles.featureIconContainer}
                            >
                                <Ionicons name="camera-outline" size={20} color="#0074dd" />
                            </LinearGradient>
                            <Text style={styles.featureText}>Photo Food Recognition</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <LinearGradient
                                colors={["rgba(92,0,221,0.2)", "rgba(92,0,221,0.05)"]}
                                style={styles.featureIconContainer}
                            >
                                <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#5c00dd" />
                            </LinearGradient>
                            <Text style={styles.featureText}>Health Analytics</Text>
                        </View>

                        <View style={styles.featureItem}>
                            <LinearGradient
                                colors={["rgba(221,0,149,0.2)", "rgba(221,0,149,0.05)"]}
                                style={styles.featureIconContainer}
                            >
                                <Ionicons name="fitness-outline" size={20} color="#dd0095" />
                            </LinearGradient>
                            <Text style={styles.featureText}>Fitness Integration</Text>
                        </View>
                    </View>
                </View>

                {/* Bottom area with button */}
                <View style={styles.bottomContent}>
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={onNext}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={["#0074dd", "#5c00dd", "#dd0095"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            <Text style={styles.buttonText}>Get Started</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width,
        backgroundColor: '#000',
    },
    backgroundGradient: {
        position: 'absolute',
        width: width,
        height: height,
    },
    circlesContainer: {
        position: 'absolute',
        width: width,
        height: height,
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        borderWidth: 1,
        borderStyle: 'solid',
    },
    circle1: {
        width: width * 1.3,
        height: width * 1.3,
        borderRadius: width * 0.65,
        borderColor: 'rgba(0,116,221,0.1)',
        top: -width * 0.8,
        left: -width * 0.15,
    },
    circle2: {
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        borderColor: 'rgba(92,0,221,0.08)',
        bottom: -width * 0.4,
        right: -width * 0.3,
    },
    circle3: {
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        borderColor: 'rgba(221,0,149,0.1)',
        top: height * 0.3,
        left: -width * 0.4,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'space-between',
    },
    mainContent: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 30,
        paddingHorizontal: 30,
    },
    topImageContainer: {
        width: width * 0.85,
        height: width * 0.6,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 30,
        shadowColor: "#5c00dd",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 15,
    },
    topImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    // New styles for macros overlay
    macrosOverlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    macrosBlurView: {
        width: '90%',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    macrosContent: {
        width: '100%',
        padding: 16,
    },
    macrosHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    macrosTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    macrosBadge: {
        backgroundColor: NUTRITION_COLORS.PROTEIN,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    macrosBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '700',
    },
    foodNameText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    caloriesText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    macroBar: {
        height: 6,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        flexDirection: 'row',
        overflow: 'hidden',
        marginBottom: 14,
    },
    macroBarSegment: {
        height: '100%',
    },
    macroDetailsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    macroDetail: {
        alignItems: 'center',
    },
    macroCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginBottom: 6,
    },
    macroLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
    },
    macroValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    welcomeText: {
        fontSize: 34,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    divider: {
        height: 3,
        width: 60,
        borderRadius: 1.5,
        marginBottom: 15,
    },
    descriptionText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#ddd',
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    featuresContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        marginTop: 20,
    },
    featureItem: {
        alignItems: 'center',
        width: '30%',
    },
    featureIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    featureText: {
        fontSize: 13,
        color: '#fff',
        textAlign: 'center',
    },
    bottomContent: {
        alignItems: 'center',
        paddingVertical: 25,
    },
    startButton: {
        width: width * 0.7,
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    buttonIcon: {
        marginLeft: 8,
    },
});

export default IntroStep3; 