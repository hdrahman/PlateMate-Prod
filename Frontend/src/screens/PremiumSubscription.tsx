import React, { useState } from 'react';
import {
    SafeAreaView,
    Text,
    StyleSheet,
    View,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

interface PlanOption {
    id: string;
    title: string;
    price: string;
    features: string[];
    period: string;
    mostPopular?: boolean;
}

const PremiumSubscription = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Premium plan options
    const plans: PlanOption[] = [
        {
            id: 'monthly',
            title: 'Monthly',
            price: '9.99',
            period: 'month',
            features: [
                'Unlimited food recognition',
                'Custom meal plans',
                'Detailed nutrition insights',
                'Priority support'
            ]
        },
        {
            id: 'yearly',
            title: 'Yearly',
            price: '79.99',
            period: 'year',
            features: [
                'All monthly features',
                'Save 33% compared to monthly',
                'Export nutrition data',
                'Advanced analytics and trends'
            ],
            mostPopular: true
        },
        {
            id: 'lifetime',
            title: 'Lifetime',
            price: '199.99',
            period: 'one-time',
            features: [
                'All yearly features',
                'Pay once, use forever',
                'Early access to new features',
                'Personal nutrition coach consultation'
            ]
        }
    ];

    const handleSubscribe = async () => {
        if (!selectedPlan) {
            Alert.alert('Error', 'Please select a subscription plan');
            return;
        }

        setIsLoading(true);

        try {
            // This would typically integrate with a payment processor like Stripe
            // For now, we'll simulate the subscription process

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Show success message
            Alert.alert(
                'Subscription Success',
                `You've successfully subscribed to the ${plans.find(p => p.id === selectedPlan)?.title} plan!`,
                [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]
            );
        } catch (error) {
            console.error('Subscription error:', error);
            Alert.alert('Error', 'Failed to process subscription. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Premium Subscription</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.heroSection}>
                    <Ionicons name="star" size={40} color="#FFD700" />
                    <Text style={styles.heroTitle}>Unlock PlateMate Premium</Text>
                    <Text style={styles.heroSubtitle}>
                        Elevate your nutrition tracking with our premium features
                    </Text>
                </View>

                <View style={styles.plansContainer}>
                    {plans.map(plan => (
                        <TouchableOpacity
                            key={plan.id}
                            style={[
                                styles.planCard,
                                selectedPlan === plan.id && styles.selectedPlan,
                                plan.mostPopular && styles.popularPlan
                            ]}
                            onPress={() => setSelectedPlan(plan.id)}
                        >
                            {plan.mostPopular && (
                                <View style={styles.popularBadge}>
                                    <Text style={styles.popularText}>Most Popular</Text>
                                </View>
                            )}

                            <Text style={styles.planTitle}>{plan.title}</Text>
                            <View style={styles.priceContainer}>
                                <Text style={styles.dollarSign}>$</Text>
                                <Text style={styles.priceAmount}>{plan.price}</Text>
                                <Text style={styles.pricePeriod}>/{plan.period}</Text>
                            </View>

                            <View style={styles.featuresList}>
                                {plan.features.map((feature, index) => (
                                    <View key={index} style={styles.featureItem}>
                                        <Ionicons name="checkmark-circle" size={18} color="#9B00FF" />
                                        <Text style={styles.featureText}>{feature}</Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.subscribeButton}
                    onPress={handleSubscribe}
                    disabled={isLoading || !selectedPlan}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.subscribeButtonText}>
                            Subscribe Now
                        </Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.termsText}>
                    By subscribing you agree to our Terms of Service and Privacy Policy.
                    You can cancel your subscription anytime.
                </Text>
            </ScrollView>
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
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 10,
        marginBottom: 5,
    },
    heroSubtitle: {
        fontSize: 16,
        color: '#AAA',
        textAlign: 'center',
    },
    plansContainer: {
        marginBottom: 20,
    },
    planCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 20,
        marginBottom: 15,
        borderWidth: 2,
        borderColor: '#333',
    },
    selectedPlan: {
        borderColor: '#9B00FF',
    },
    popularPlan: {
        borderColor: '#FFD700',
    },
    popularBadge: {
        position: 'absolute',
        top: -10,
        right: 20,
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    popularText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000',
    },
    planTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 10,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 15,
    },
    dollarSign: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    priceAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
    },
    pricePeriod: {
        fontSize: 16,
        color: '#AAA',
        marginBottom: 4,
        marginLeft: 2,
    },
    featuresList: {
        marginTop: 10,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    featureText: {
        fontSize: 14,
        color: '#FFF',
        marginLeft: 8,
    },
    subscribeButton: {
        backgroundColor: '#9B00FF',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    subscribeButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    termsText: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        lineHeight: 18,
    }
});

export default PremiumSubscription;
