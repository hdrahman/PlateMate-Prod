import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    StatusBar,
    Switch,
    ScrollView,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { DataSharingSettings } from '../types/notifications';
import SettingsService from '../services/SettingsService';

interface DataSharingOption {
    id: string;
    title: string;
    description: string;
    enabled: boolean;
}

export default function DataSharing() {
    const navigation = useNavigation<any>();
    const [settings, setSettings] = useState<DataSharingSettings | null>(null);
    const [loading, setLoading] = useState(true);

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
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Data Sharing</Text>
                        <Text style={styles.subtitle}>
                            Control how your data is used and shared
                        </Text>
                    </View>

                    {/* Local Storage Disclaimer */}
                    <View style={styles.disclaimerCard}>
                        <Ionicons name="shield-checkmark" size={32} color="#4CAF50" />
                        <View style={styles.disclaimerContent}>
                            <Text style={styles.disclaimerTitle}>🔒 Your Privacy First</Text>
                            <Text style={styles.disclaimerText}>
                                Currently, everything is being stored locally on your device. We see nothing.
                                Your data stays completely private and secure on your phone.
                            </Text>
                            <Text style={styles.disclaimerSubtext}>
                                The settings below are for future features and your consent preferences.
                            </Text>
                        </View>
                    </View>

                    {/* Essential Data Usage */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="shield" size={24} color="#4CAF50" />
                            <Text style={styles.sectionTitle}>Essential Data Usage</Text>
                        </View>
                        <Text style={styles.sectionDescription}>
                            Required for basic app functionality and security
                        </Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>App Functionality</Text>
                                <Text style={styles.settingDescription}>
                                    Core features like food logging and progress tracking
                                </Text>
                            </View>
                            <View style={styles.requiredBadge}>
                                <Text style={styles.requiredText}>Required</Text>
                            </View>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Security & Authentication</Text>
                                <Text style={styles.settingDescription}>
                                    Account security and session management
                                </Text>
                            </View>
                            <View style={styles.requiredBadge}>
                                <Text style={styles.requiredText}>Required</Text>
                            </View>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Basic Analytics</Text>
                                <Text style={styles.settingDescription}>
                                    Anonymous crash reports and performance data
                                </Text>
                            </View>
                            <Switch
                                value={settings.essential.basicAnalytics}
                                onValueChange={(value) => handleToggle('essential.basicAnalytics', value)}
                                trackColor={{ false: '#E5E5E5', true: '#4CAF50' }}
                                thumbColor={settings.essential.basicAnalytics ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Enhancement Features */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="trending-up" size={24} color="#2196F3" />
                            <Text style={styles.sectionTitle}>Enhancement Features</Text>
                        </View>
                        <Text style={styles.sectionDescription}>
                            Improve your experience with personalized features
                        </Text>

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
                                trackColor={{ false: '#E5E5E5', true: '#2196F3' }}
                                thumbColor={settings.enhancement.personalizedContent ? '#fff' : '#f4f3f4'}
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
                                trackColor={{ false: '#E5E5E5', true: '#2196F3' }}
                                thumbColor={settings.enhancement.improvedRecognition ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Better Recommendations</Text>
                                <Text style={styles.settingDescription}>
                                    Smarter health insights based on your progress
                                </Text>
                            </View>
                            <Switch
                                value={settings.enhancement.betterRecommendations}
                                onValueChange={(value) => handleToggle('enhancement.betterRecommendations', value)}
                                trackColor={{ false: '#E5E5E5', true: '#2196F3' }}
                                thumbColor={settings.enhancement.betterRecommendations ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Marketing Communications */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="megaphone" size={24} color="#FF9800" />
                            <Text style={styles.sectionTitle}>Marketing Communications</Text>
                        </View>
                        <Text style={styles.sectionDescription}>
                            Control how we communicate with you
                        </Text>

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
                                trackColor={{ false: '#E5E5E5', true: '#FF9800' }}
                                thumbColor={settings.marketing.personalizedAds ? '#fff' : '#f4f3f4'}
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
                                trackColor={{ false: '#E5E5E5', true: '#FF9800' }}
                                thumbColor={settings.marketing.emailMarketing ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Partner Sharing</Text>
                                <Text style={styles.settingDescription}>
                                    Share anonymized data with trusted health partners
                                </Text>
                            </View>
                            <Switch
                                value={settings.marketing.partnerSharing}
                                onValueChange={(value) => handleToggle('marketing.partnerSharing', value)}
                                trackColor={{ false: '#E5E5E5', true: '#FF9800' }}
                                thumbColor={settings.marketing.partnerSharing ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Research & Development */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="flask" size={24} color="#9C27B0" />
                            <Text style={styles.sectionTitle}>Research & Development</Text>
                        </View>
                        <Text style={styles.sectionDescription}>
                            Help improve health technology for everyone
                        </Text>

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
                                trackColor={{ false: '#E5E5E5', true: '#9C27B0' }}
                                thumbColor={settings.research.anonymizedResearch ? '#fff' : '#f4f3f4'}
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
                                trackColor={{ false: '#E5E5E5', true: '#9C27B0' }}
                                thumbColor={settings.research.productImprovement ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Academic Partnership</Text>
                                <Text style={styles.settingDescription}>
                                    Support university research on digital health
                                </Text>
                            </View>
                            <Switch
                                value={settings.research.academicPartnership}
                                onValueChange={(value) => handleToggle('research.academicPartnership', value)}
                                trackColor={{ false: '#E5E5E5', true: '#9C27B0' }}
                                thumbColor={settings.research.academicPartnership ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Data Rights */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="document-text" size={24} color="#607D8B" />
                            <Text style={styles.sectionTitle}>Your Data Rights</Text>
                        </View>

                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="download" size={20} color="#607D8B" />
                            <Text style={styles.actionButtonText}>Export My Data</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton}>
                            <Ionicons name="eye" size={20} color="#607D8B" />
                            <Text style={styles.actionButtonText}>View Data Usage</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]}>
                            <Ionicons name="trash" size={20} color="#F44336" />
                            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete All Data</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Reset Button */}
                    <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
                        <Ionicons name="refresh" size={20} color="#FF6B6B" />
                        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
                    </TouchableOpacity>

                    <View style={styles.bottomSpacer} />
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    header: {
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#E8E8E8',
        textAlign: 'center',
    },
    disclaimerCard: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 25,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    disclaimerContent: {
        flex: 1,
        marginLeft: 15,
    },
    disclaimerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    disclaimerText: {
        fontSize: 16,
        color: '#E8E8E8',
        lineHeight: 22,
        marginBottom: 8,
    },
    disclaimerSubtext: {
        fontSize: 14,
        color: '#B8C5D1',
        lineHeight: 20,
        fontStyle: 'italic',
    },
    section: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 12,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#B8C5D1',
        marginBottom: 20,
        lineHeight: 20,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    settingInfo: {
        flex: 1,
        marginRight: 15,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#E8E8E8',
        lineHeight: 18,
    },
    requiredBadge: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    requiredText: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '600',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
    },
    actionButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
        marginLeft: 12,
    },
    deleteButton: {
        backgroundColor: 'rgba(244, 67, 54, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(244, 67, 54, 0.3)',
    },
    deleteButtonText: {
        color: '#F44336',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 107, 107, 0.2)',
        borderRadius: 15,
        padding: 15,
        marginTop: 10,
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF6B6B',
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 100,
    },
}); 