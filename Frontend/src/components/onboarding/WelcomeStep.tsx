import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface WelcomeStepProps {
    onNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.logoGradient}
                >
                    <Image
                        source={require('../../../assets/Cropped2.jpg')}
                        style={styles.logoImage}
                        resizeMode="cover"
                    />
                </LinearGradient>
            </View>

            <Text style={styles.title}>Welcome to PlateMate</Text>
            <Text style={styles.subtitle}>Let's personalize your experience</Text>

            <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                    <View style={styles.featureIconContainer}>
                        <Ionicons name="restaurant-outline" size={28} color="#0074dd" />
                    </View>
                    <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>Personalized Nutrition</Text>
                        <Text style={styles.featureDescription}>AI-powered meal recommendations based on your preferences and goals</Text>
                    </View>
                </View>

                <View style={styles.featureItem}>
                    <View style={styles.featureIconContainer}>
                        <Ionicons name="camera-outline" size={28} color="#5c00dd" />
                    </View>
                    <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>Smart Food Recognition</Text>
                        <Text style={styles.featureDescription}>Just snap a photo and we'll identify and track your meal</Text>
                    </View>
                </View>

                <View style={styles.featureItem}>
                    <View style={styles.featureIconContainer}>
                        <Ionicons name="analytics-outline" size={28} color="#dd0095" />
                    </View>
                    <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>Comprehensive Tracking</Text>
                        <Text style={styles.featureDescription}>Track all nutrients, not just calories, for optimal health</Text>
                    </View>
                </View>
            </View>

            <Text style={styles.setupText}>
                Let's set up your profile in just a few steps to get the most out of PlateMate
            </Text>

            <TouchableOpacity style={styles.button} onPress={onNext}>
                <LinearGradient
                    colors={["#0074dd", "#5c00dd", "#dd0095"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    logoContainer: {
        marginBottom: 24,
    },
    logoGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
    },
    logoImage: {
        width: 90,
        height: 90,
        borderRadius: 45,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#aaa',
        marginBottom: 32,
        textAlign: 'center',
    },
    featuresContainer: {
        width: '100%',
        marginBottom: 32,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    featureIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    featureTextContainer: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 20,
    },
    setupText: {
        fontSize: 16,
        color: '#ccc',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    button: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    buttonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 8,
    },
});

export default WelcomeStep; 