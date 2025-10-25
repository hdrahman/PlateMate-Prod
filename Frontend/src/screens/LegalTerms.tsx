import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Alert,
    Linking,
    StatusBar,
    SafeAreaView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define theme colors
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const ACCENT_BLUE = '#2196F3';

// Gradient border card wrapper component
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 16,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View
                style={{
                    margin: 1.5,
                    borderRadius: 15,
                    backgroundColor: style?.backgroundColor || CARD_BG,
                    padding: 16,
                    ...style
                }}
            >
                {children}
            </View>
        </View>
    );
};

export default function LegalTerms() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const openEULA = async () => {
        const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert(
                'Cannot Open Link',
                'Unable to open the Terms of Use. Please try again later.',
                [{ text: 'OK' }]
            );
        }
    };

    const navigateToPrivacyPolicy = () => {
        navigation.navigate('PrivacyPolicy' as never);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BG} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Legal Information</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Medical Disclaimer */}
                <View style={styles.medicalDisclaimerBanner}>
                    <Ionicons name="medical" size={24} color="#FF9500" />
                    <View style={styles.medicalDisclaimerContent}>
                        <Text style={styles.medicalDisclaimerTitle}>Medical Disclaimer</Text>
                        <Text style={styles.medicalDisclaimerText}>
                            PlateMate is a nutrition tracking and informational tool, not a medical device or diagnostic tool.
                            It does not provide medical advice, diagnosis, or treatment. Always consult with a qualified
                            healthcare professional, registered dietitian, or physician before making changes to your diet,
                            starting any weight management program, or if you have any medical conditions or concerns.
                        </Text>
                    </View>
                </View>

                {/* Introduction */}
                <View style={styles.introSection}>
                    <Text style={styles.introText}>
                        Review our legal terms and privacy practices to understand your rights and how we handle your information.
                    </Text>
                </View>

                {/* Terms of Use Card */}
                <GradientBorderCard>
                    <View style={styles.legalCard}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="document-text" size={28} color={ACCENT_BLUE} />
                            <Text style={styles.cardTitle}>Terms of Use (EULA)</Text>
                        </View>
                        <Text style={styles.cardDescription}>
                            PlateMate uses Apple's Standard End User License Agreement (EULA). This governs your use of the PlateMate app and any subscriptions you purchase.
                        </Text>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={openEULA}
                        >
                            <Text style={styles.actionButtonText}>View Terms of Use</Text>
                            <Ionicons name="open-outline" size={18} color={WHITE} />
                        </TouchableOpacity>
                    </View>
                </GradientBorderCard>

                {/* Privacy Policy Card */}
                <GradientBorderCard>
                    <View style={styles.legalCard}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="shield-checkmark" size={28} color={ACCENT_BLUE} />
                            <Text style={styles.cardTitle}>Privacy Policy</Text>
                        </View>
                        <Text style={styles.cardDescription}>
                            Learn how we collect, use, and protect your personal and health data. Your privacy is our priority.
                        </Text>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={navigateToPrivacyPolicy}
                        >
                            <Text style={styles.actionButtonText}>View Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={18} color={WHITE} />
                        </TouchableOpacity>
                    </View>
                </GradientBorderCard>

                {/* Subscription Information */}
                <GradientBorderCard>
                    <View style={styles.legalCard}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="card" size={28} color={ACCENT_BLUE} />
                            <Text style={styles.cardTitle}>Subscription Terms</Text>
                        </View>
                        <View style={styles.subscriptionInfo}>
                            <Text style={styles.subscriptionText}>
                                • Auto-renewable subscriptions available
                            </Text>
                            <Text style={styles.subscriptionText}>
                                • Subscription periods: Monthly or Annual
                            </Text>
                            <Text style={styles.subscriptionText}>
                                • Free trial available for new users
                            </Text>
                            <Text style={styles.subscriptionText}>
                                • Payment charged to Apple ID account at confirmation
                            </Text>
                            <Text style={styles.subscriptionText}>
                                • Subscription auto-renews unless cancelled 24 hours before period ends
                            </Text>
                            <Text style={styles.subscriptionText}>
                                • Manage subscriptions in App Store account settings
                            </Text>
                            <Text style={styles.subscriptionText}>
                                • 30-day money-back guarantee available
                            </Text>
                        </View>
                        <Text style={styles.subscriptionNote}>
                            Full terms are available in the Terms of Use above and in the Privacy Policy.
                        </Text>
                    </View>
                </GradientBorderCard>

                {/* Contact Section */}
                <View style={styles.contactSection}>
                    <Text style={styles.contactTitle}>Questions or Concerns?</Text>
                    <Text style={styles.contactText}>
                        If you have any questions about our legal terms or privacy practices, please contact us at:
                    </Text>
                    <TouchableOpacity
                        onPress={() => Linking.openURL('mailto:privacy@platemate.app')}
                    >
                        <Text style={styles.emailText}>privacy@platemate.app</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: WHITE,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 16,
    },
    medicalDisclaimerBanner: {
        marginTop: 16,
        marginBottom: 8,
        padding: 16,
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 0, 0.3)',
        flexDirection: 'row',
        gap: 12,
    },
    medicalDisclaimerContent: {
        flex: 1,
        gap: 8,
    },
    medicalDisclaimerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF9500',
    },
    medicalDisclaimerText: {
        fontSize: 13,
        color: WHITE,
        lineHeight: 19,
    },
    introSection: {
        paddingVertical: 20,
    },
    introText: {
        fontSize: 15,
        color: SUBDUED,
        lineHeight: 22,
        textAlign: 'center',
    },
    gradientBorderContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    legalCard: {
        gap: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: WHITE,
        flex: 1,
    },
    cardDescription: {
        fontSize: 14,
        color: SUBDUED,
        lineHeight: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT_BLUE,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        gap: 8,
        marginTop: 8,
    },
    actionButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: WHITE,
    },
    subscriptionInfo: {
        gap: 8,
    },
    subscriptionText: {
        fontSize: 13,
        color: SUBDUED,
        lineHeight: 20,
    },
    subscriptionNote: {
        fontSize: 12,
        color: SUBDUED,
        lineHeight: 18,
        marginTop: 8,
        fontStyle: 'italic',
    },
    contactSection: {
        marginTop: 24,
        marginBottom: 16,
        alignItems: 'center',
        gap: 8,
    },
    contactTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
    },
    contactText: {
        fontSize: 14,
        color: SUBDUED,
        textAlign: 'center',
        lineHeight: 20,
    },
    emailText: {
        fontSize: 15,
        color: ACCENT_BLUE,
        fontWeight: '600',
        marginTop: 4,
    },
});
