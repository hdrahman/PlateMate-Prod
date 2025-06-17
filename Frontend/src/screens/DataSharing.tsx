import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Switch,
    ScrollView,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DataSharingSettings } from '../types/notifications';
import SettingsService from '../services/SettingsService';
import { ThemeContext } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

// Define theme colors
const PRIMARY_BG = '#121212';
const CARD_BG = '#1E1E1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#B8C5D1';

// Section accent colors
const ESSENTIAL_COLOR = '#4CAF50';
const ENHANCEMENT_COLOR = '#2196F3';
const MARKETING_COLOR = '#FF9800';
const RESEARCH_COLOR = '#9C27B0';
const RIGHTS_COLOR = '#607D8B';
const DANGER_COLOR = '#F44336';
const RESET_COLOR = '#FF6B6B';
const PRIMARY_GRADIENT = ['#121212', '#1E1E1E'];

interface DataSharingOption {
    id: string;
    title: string;
    description: string;
    enabled: boolean;
}

// Gradient Border Card component for consistent styling
const GradientCard = ({ children, accentColor }: { children: React.ReactNode, accentColor: string }) => {
    return (
        <View style={styles.gradientCardContainer}>
            <LinearGradient
                colors={[accentColor + '40', accentColor + '20', accentColor + '10']}
                style={styles.gradientBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <View style={styles.cardContent}>
                {children}
            </View>
        </View>
    );
};

export default function DataSharing() {
    const navigation = useNavigation<any>();
    const [settings, setSettings] = useState<DataSharingSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const { isDarkTheme } = useContext(ThemeContext);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const dataSharingSettings = await SettingsService.getDataSharingSettings();
            setSettings(dataSharingSettings);
        } catch (error) {
            console.error('Error loading data sharing settings:', error);
            Alert.alert('Error', 'Failed to load data sharing settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (path: string, value: boolean) => {
        try {
            const updatedSettings = await SettingsService.updateDataSharingSetting(path, value);
            setSettings(updatedSettings);
        } catch (error) {
            console.error('Error updating data sharing setting:', error);
            Alert.alert('Error', 'Failed to update data sharing setting');
        }
    };

    const resetToDefaults = () => {
        Alert.alert(
            'Reset Settings',
            'Are you sure you want to reset all data sharing settings to defaults?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const defaultSettings = await SettingsService.resetDataSharingSettings();
                            setSettings(defaultSettings);
                            Alert.alert('Success', 'Data sharing settings reset to defaults');
                        } catch (error) {
                            console.error('Error resetting settings:', error);
                            Alert.alert('Error', 'Failed to reset settings');
                        }
                    },
                },
            ]
        );
    };

    if (loading || !settings) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <StatusBar barStyle="light-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9B00FF" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Data Sharing</Text>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Privacy Notice */}
                    <GradientCard accentColor={ESSENTIAL_COLOR}>
                        <View style={styles.privacyNotice}>
                            <Ionicons name="shield-checkmark" size={32} color={ESSENTIAL_COLOR} />
                            <View style={styles.privacyContent}>
                                <Text style={styles.privacyTitle}>🔒 Your Privacy First</Text>
                                <Text style={styles.privacyText}>
                                    Currently, everything is being stored locally on your device. We see nothing.
                                    Your data stays completely private and secure on your phone.
                                </Text>
                                <Text style={styles.privacySubtext}>
                                    The settings below are for future features and your consent preferences.
                                </Text>
                            </View>
                        </View>
                    </GradientCard>

                    {/* Future Feature Notice */}
                    <GradientCard accentColor={ENHANCEMENT_COLOR}>
                        <View style={styles.disclaimerBanner}>
                            <Ionicons name="information-circle" size={28} color={ENHANCEMENT_COLOR} />
                            <View style={styles.disclaimerContent}>
                                <Text style={styles.disclaimerTitle}>Coming Soon</Text>
                                <Text style={styles.disclaimerText}>
                                    These settings are currently placeholders and don't activate any actual data sharing.
                                    They've been included to prepare for future updates and let you explore what options
                                    will be available. Your preferences will be saved for when these features are activated.
                                </Text>
                            </View>
                        </View>
                    </GradientCard>

                    {/* Essential Data Usage */}
                    <Text style={styles.sectionTitle}>Essential Data Usage</Text>
                    <GradientCard accentColor={ESSENTIAL_COLOR}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="shield" size={24} color={ESSENTIAL_COLOR} />
                            <Text style={styles.sectionHeaderText}>Required for basic functionality</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>App Functionality</Text>
                                <Text style={styles.settingDescription}>
                                    Core features like food logging and progress tracking
                                </Text>
                            </View>
                            <View style={[styles.requiredBadge, { backgroundColor: ESSENTIAL_COLOR + '20' }]}>
                                <Text style={[styles.requiredText, { color: ESSENTIAL_COLOR }]}>Required</Text>
                            </View>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Security & Authentication</Text>
                                <Text style={styles.settingDescription}>
                                    Account security and session management
                                </Text>
                            </View>
                            <View style={[styles.requiredBadge, { backgroundColor: ESSENTIAL_COLOR + '20' }]}>
                                <Text style={[styles.requiredText, { color: ESSENTIAL_COLOR }]}>Required</Text>
                            </View>
                        </View>

                        <View style={[styles.settingRow, styles.noBorder]}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Basic Analytics</Text>
                                <Text style={styles.settingDescription}>
                                    Anonymous crash reports and performance data
                                </Text>
                            </View>
                            <Switch
                                value={settings.essential.basicAnalytics}
                                onValueChange={(value) => handleToggle('essential.basicAnalytics', value)}
                                trackColor={{ false: '#3E3E3E', true: ESSENTIAL_COLOR + '40' }}
                                thumbColor={settings.essential.basicAnalytics ? ESSENTIAL_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>
                    </GradientCard>

                    {/* Enhancement Features */}
                    <Text style={styles.sectionTitle}>Enhancement Features</Text>
                    <GradientCard accentColor={ENHANCEMENT_COLOR}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="trending-up" size={24} color={ENHANCEMENT_COLOR} />
                            <Text style={styles.sectionHeaderText}>Improve your experience</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Personalized Content</Text>
                                <Text style={styles.settingDescription}>
                                    Customized meal suggestions and workout recommendations
                                </Text>
                            </View>
                            <Switch
                                value={settings.enhancement.personalizedContent}
                                onValueChange={(value) => handleToggle('enhancement.personalizedContent', value)}
                                trackColor={{ false: '#3E3E3E', true: ENHANCEMENT_COLOR + '40' }}
                                thumbColor={settings.enhancement.personalizedContent ? ENHANCEMENT_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Improved Food Recognition</Text>
                                <Text style={styles.settingDescription}>
                                    Better AI accuracy through usage patterns
                                </Text>
                            </View>
                            <Switch
                                value={settings.enhancement.improvedRecognition}
                                onValueChange={(value) => handleToggle('enhancement.improvedRecognition', value)}
                                trackColor={{ false: '#3E3E3E', true: ENHANCEMENT_COLOR + '40' }}
                                thumbColor={settings.enhancement.improvedRecognition ? ENHANCEMENT_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>

                        <View style={[styles.settingRow, styles.noBorder]}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Better Recommendations</Text>
                                <Text style={styles.settingDescription}>
                                    Smarter health insights based on your progress
                                </Text>
                            </View>
                            <Switch
                                value={settings.enhancement.betterRecommendations}
                                onValueChange={(value) => handleToggle('enhancement.betterRecommendations', value)}
                                trackColor={{ false: '#3E3E3E', true: ENHANCEMENT_COLOR + '40' }}
                                thumbColor={settings.enhancement.betterRecommendations ? ENHANCEMENT_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>
                    </GradientCard>

                    {/* Marketing Communications */}
                    <Text style={styles.sectionTitle}>Marketing Communications</Text>
                    <GradientCard accentColor={MARKETING_COLOR}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="megaphone" size={24} color={MARKETING_COLOR} />
                            <Text style={styles.sectionHeaderText}>Control communications</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Personalized Ads</Text>
                                <Text style={styles.settingDescription}>
                                    Relevant health and fitness advertisements
                                </Text>
                            </View>
                            <Switch
                                value={settings.marketing.personalizedAds}
                                onValueChange={(value) => handleToggle('marketing.personalizedAds', value)}
                                trackColor={{ false: '#3E3E3E', true: MARKETING_COLOR + '40' }}
                                thumbColor={settings.marketing.personalizedAds ? MARKETING_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Email Marketing</Text>
                                <Text style={styles.settingDescription}>
                                    Health tips, success stories, and app updates via email
                                </Text>
                            </View>
                            <Switch
                                value={settings.marketing.emailMarketing}
                                onValueChange={(value) => handleToggle('marketing.emailMarketing', value)}
                                trackColor={{ false: '#3E3E3E', true: MARKETING_COLOR + '40' }}
                                thumbColor={settings.marketing.emailMarketing ? MARKETING_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>

                        <View style={[styles.settingRow, styles.noBorder]}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Partner Sharing</Text>
                                <Text style={styles.settingDescription}>
                                    Share anonymized data with trusted health partners
                                </Text>
                            </View>
                            <Switch
                                value={settings.marketing.partnerSharing}
                                onValueChange={(value) => handleToggle('marketing.partnerSharing', value)}
                                trackColor={{ false: '#3E3E3E', true: MARKETING_COLOR + '40' }}
                                thumbColor={settings.marketing.partnerSharing ? MARKETING_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>
                    </GradientCard>

                    {/* Research & Development */}
                    <Text style={styles.sectionTitle}>Research & Development</Text>
                    <GradientCard accentColor={RESEARCH_COLOR}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="flask" size={24} color={RESEARCH_COLOR} />
                            <Text style={styles.sectionHeaderText}>Help improve health technology</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Anonymized Research</Text>
                                <Text style={styles.settingDescription}>
                                    Contribute to health and nutrition research studies
                                </Text>
                            </View>
                            <Switch
                                value={settings.research.anonymizedResearch}
                                onValueChange={(value) => handleToggle('research.anonymizedResearch', value)}
                                trackColor={{ false: '#3E3E3E', true: RESEARCH_COLOR + '40' }}
                                thumbColor={settings.research.anonymizedResearch ? RESEARCH_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Product Improvement</Text>
                                <Text style={styles.settingDescription}>
                                    Help us make the app better for everyone
                                </Text>
                            </View>
                            <Switch
                                value={settings.research.productImprovement}
                                onValueChange={(value) => handleToggle('research.productImprovement', value)}
                                trackColor={{ false: '#3E3E3E', true: RESEARCH_COLOR + '40' }}
                                thumbColor={settings.research.productImprovement ? RESEARCH_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>

                        <View style={[styles.settingRow, styles.noBorder]}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Academic Partnership</Text>
                                <Text style={styles.settingDescription}>
                                    Support university research on digital health
                                </Text>
                            </View>
                            <Switch
                                value={settings.research.academicPartnership}
                                onValueChange={(value) => handleToggle('research.academicPartnership', value)}
                                trackColor={{ false: '#3E3E3E', true: RESEARCH_COLOR + '40' }}
                                thumbColor={settings.research.academicPartnership ? RESEARCH_COLOR : '#f4f3f4'}
                                ios_backgroundColor="#3E3E3E"
                            />
                        </View>
                    </GradientCard>

                    {/* Data Rights */}
                    <Text style={styles.sectionTitle}>Your Data Rights</Text>
                    <GradientCard accentColor={RIGHTS_COLOR}>
                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="download" size={22} color={RIGHTS_COLOR} />
                            <Text style={styles.actionButtonText}>Export My Data</Text>
                            <Ionicons name="chevron-forward" size={18} color={SUBDUED} style={styles.chevron} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="eye" size={22} color={RIGHTS_COLOR} />
                            <Text style={styles.actionButtonText}>View Data Usage</Text>
                            <Ionicons name="chevron-forward" size={18} color={SUBDUED} style={styles.chevron} />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]}>
                            <Ionicons name="trash" size={22} color={DANGER_COLOR} />
                            <Text style={[styles.actionButtonText, { color: DANGER_COLOR }]}>Delete All Data</Text>
                            <Ionicons name="chevron-forward" size={18} color={DANGER_COLOR} style={styles.chevron} />
                        </TouchableOpacity>
                    </GradientCard>

                    {/* Reset Button */}
                    <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
                        <Ionicons name="refresh" size={20} color={WHITE} />
                        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
                    </TouchableOpacity>

                    <View style={styles.bottomSpacer} />
                </View>
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
        flexDirection: "row",
        alignItems: "center",
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 22,
        fontWeight: "bold",
        marginLeft: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        color: WHITE,
        fontWeight: '600',
        marginTop: 12,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    gradientCardContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: CARD_BG,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#333',
    },
    gradientBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    cardContent: {
        padding: 16,
    },
    privacyNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    privacyContent: {
        flex: 1,
        marginLeft: 15,
    },
    privacyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    privacyText: {
        fontSize: 16,
        color: WHITE,
        lineHeight: 22,
        marginBottom: 8,
    },
    privacySubtext: {
        fontSize: 14,
        color: SUBDUED,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    disclaimerBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    disclaimerContent: {
        flex: 1,
        marginLeft: 15,
    },
    disclaimerTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 6,
    },
    disclaimerText: {
        fontSize: 15,
        color: WHITE,
        lineHeight: 21,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#9B00FF',
        marginBottom: 12,
        marginLeft: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionHeaderText: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '500',
        marginLeft: 12,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    noBorder: {
        borderBottomWidth: 0,
    },
    settingInfo: {
        flex: 1,
        marginRight: 15,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: WHITE,
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: SUBDUED,
        lineHeight: 18,
    },
    requiredBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    requiredText: {
        fontSize: 12,
        fontWeight: '600',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingLeft: 5,
        marginVertical: 4,
    },
    dangerButton: {
        marginTop: 8,
    },
    actionButtonText: {
        fontSize: 16,
        color: WHITE,
        fontWeight: '500',
        marginLeft: 12,
        flex: 1,
    },
    chevron: {
        marginLeft: 10,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: RESET_COLOR,
        borderRadius: 15,
        padding: 15,
        marginTop: 10,
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 100,
    },
}); 