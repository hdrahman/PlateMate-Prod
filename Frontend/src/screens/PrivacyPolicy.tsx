import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Alert,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PrivacyPolicySection } from '../types/notifications';

export default function PrivacyPolicy() {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [lastUpdated] = useState(new Date('2024-01-15'));

    const privacyPolicySections: PrivacyPolicySection[] = [
        {
            id: 'data_collection',
            title: 'What Data We Collect',
            importance: 'high',
            lastUpdated: lastUpdated,
            content: `We collect information you provide directly to us, such as:

• Personal information (name, email, age, gender)
• Health and fitness data (weight, height, activity levels, dietary preferences)
• Food logging information (meals, photos, nutritional intake)
• App usage data and preferences
• Device information for app functionality

All data is currently stored locally on your device. We do not collect or transmit this information to our servers.`,
            userActions: [
                { label: 'Manage Data Settings', action: 'data_settings', screen: 'DataSharing' },
                { label: 'Export My Data', action: 'export_data' },
            ],
        },
        {
            id: 'data_usage',
            title: 'How We Use Your Data',
            importance: 'high',
            lastUpdated: lastUpdated,
            content: `Your data is used exclusively to:

• Provide core app functionality (food tracking, progress monitoring)
• Generate personalized insights and recommendations
• Improve your user experience within the app
• Maintain app security and prevent misuse

Since data is stored locally, we cannot use your information for any external purposes, advertising, or sharing with third parties.`,
        },
        {
            id: 'data_storage',
            title: 'Data Storage & Security',
            importance: 'high',
            lastUpdated: lastUpdated,
            content: `Your data security is our priority:

• All data is stored locally on your device using encrypted storage
• No personal data is transmitted to external servers
• App data is protected by your device's security features
• Data is automatically backed up to your device's secure backup system
• You have complete control over your data at all times

If you delete the app, all local data will be permanently removed from your device.`,
            userActions: [
                { label: 'View Security Settings', action: 'security_settings' },
            ],
        },
        {
            id: 'data_sharing',
            title: 'Data Sharing & Third Parties',
            importance: 'medium',
            lastUpdated: lastUpdated,
            content: `Currently, we do not share any data with third parties because:

• All data remains on your device
• No cloud storage or external servers are used
• No advertising networks have access to your data
• No analytics providers receive your personal information

In the future, if we introduce cloud features, you will have complete control over what data (if any) is shared, and we will obtain your explicit consent for any data sharing.`,
            userActions: [
                { label: 'Data Sharing Preferences', action: 'data_sharing', screen: 'DataSharing' },
            ],
        },
        {
            id: 'user_rights',
            title: 'Your Rights & Controls',
            importance: 'high',
            lastUpdated: lastUpdated,
            content: `You have complete control over your data:

• Right to access: View all your stored data at any time
• Right to modify: Edit or update your information
• Right to delete: Remove specific data or delete everything
• Right to export: Get a copy of your data in a readable format
• Right to restrict: Control how data is used within the app

These rights are built into the app's design since you own and control all your data locally.`,
            userActions: [
                { label: 'Exercise My Rights', action: 'user_rights' },
                { label: 'Delete All Data', action: 'delete_data' },
            ],
        },
        {
            id: 'contact_support',
            title: 'Contact & Support',
            importance: 'medium',
            lastUpdated: lastUpdated,
            content: `For privacy-related questions or concerns:

• Email: privacy@platemate.app
• Response time: Within 48 hours
• Available in multiple languages
• Free data deletion assistance

We're here to help you understand and control your privacy.`,
            userActions: [
                { label: 'Contact Support', action: 'contact_support' },
                { label: 'Request Data Deletion', action: 'request_deletion' },
            ],
        },
    ];

    const toggleSection = (sectionId: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId);
        } else {
            newExpanded.add(sectionId);
        }
        setExpandedSections(newExpanded);
    };

    const handleUserAction = (action: string, screen?: string) => {
        switch (action) {
            case 'data_settings':
            case 'data_sharing':
                if (screen) {
                    Alert.alert('Navigation', `Would navigate to ${screen} screen`);
                }
                break;
            case 'export_data':
                Alert.alert(
                    'Export Data',
                    'Your data export will be prepared and saved to your device downloads folder.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Export', onPress: () => console.log('Export data requested') },
                    ]
                );
                break;
            case 'delete_data':
                Alert.alert(
                    'Delete All Data',
                    'This will permanently delete all your app data. This action cannot be undone.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => console.log('Delete all data requested')
                        },
                    ]
                );
                break;
            case 'contact_support':
                Linking.openURL('mailto:privacy@platemate.app?subject=Privacy Policy Question');
                break;
            case 'request_deletion':
                Linking.openURL('mailto:privacy@platemate.app?subject=Data Deletion Request');
                break;
            default:
                Alert.alert('Action', `${action} feature coming soon`);
        }
    };

    const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
        switch (importance) {
            case 'high': return '#F44336';
            case 'medium': return '#FF9800';
            case 'low': return '#4CAF50';
        }
    };

    const getImportanceIcon = (importance: 'high' | 'medium' | 'low') => {
        switch (importance) {
            case 'high': return 'warning';
            case 'medium': return 'information-circle';
            case 'low': return 'checkmark-circle';
        }
    };

    return (
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Privacy Policy</Text>
                        <Text style={styles.subtitle}>
                            Transparent about how we handle your data
                        </Text>
                        <View style={styles.lastUpdatedContainer}>
                            <Ionicons name="calendar" size={16} color="#E8E8E8" />
                            <Text style={styles.lastUpdatedText}>
                                Last updated: {lastUpdated.toLocaleDateString()}
                            </Text>
                        </View>
                    </View>

                    {/* Quick Summary */}
                    <View style={styles.summaryCard}>
                        <Ionicons name="shield-checkmark" size={32} color="#4CAF50" />
                        <View style={styles.summaryContent}>
                            <Text style={styles.summaryTitle}>🔒 Privacy At a Glance</Text>
                            <Text style={styles.summaryText}>
                                Your data stays on your device. We don't collect, share, or sell your personal information.
                                You have complete control over your health and fitness data.
                            </Text>
                        </View>
                    </View>

                    {/* Quick Navigation */}
                    <View style={styles.quickNavSection}>
                        <Text style={styles.quickNavTitle}>Quick Access</Text>
                        <View style={styles.quickNavGrid}>
                            <TouchableOpacity
                                style={styles.quickNavItem}
                                onPress={() => handleUserAction('data_settings', 'DataSharing')}
                            >
                                <Ionicons name="settings" size={24} color="#667eea" />
                                <Text style={styles.quickNavText}>Data Settings</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.quickNavItem}
                                onPress={() => handleUserAction('export_data')}
                            >
                                <Ionicons name="download" size={24} color="#667eea" />
                                <Text style={styles.quickNavText}>Export Data</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.quickNavItem}
                                onPress={() => handleUserAction('contact_support')}
                            >
                                <Ionicons name="mail" size={24} color="#667eea" />
                                <Text style={styles.quickNavText}>Contact Us</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.quickNavItem}
                                onPress={() => handleUserAction('delete_data')}
                            >
                                <Ionicons name="trash" size={24} color="#F44336" />
                                <Text style={[styles.quickNavText, { color: '#F44336' }]}>Delete Data</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Privacy Policy Sections */}
                    <View style={styles.sectionsContainer}>
                        <Text style={styles.sectionsTitle}>Full Privacy Policy</Text>

                        {privacyPolicySections.map((section) => (
                            <View key={section.id} style={styles.section}>
                                <TouchableOpacity
                                    style={styles.sectionHeader}
                                    onPress={() => toggleSection(section.id)}
                                >
                                    <View style={styles.sectionTitleContainer}>
                                        <Ionicons
                                            name={getImportanceIcon(section.importance)}
                                            size={20}
                                            color={getImportanceColor(section.importance)}
                                        />
                                        <Text style={styles.sectionTitle}>{section.title}</Text>
                                    </View>
                                    <Ionicons
                                        name={expandedSections.has(section.id) ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color="#E8E8E8"
                                    />
                                </TouchableOpacity>

                                {expandedSections.has(section.id) && (
                                    <View style={styles.sectionContent}>
                                        <Text style={styles.sectionText}>{section.content}</Text>

                                        {section.userActions && section.userActions.length > 0 && (
                                            <View style={styles.userActionsContainer}>
                                                <Text style={styles.userActionsTitle}>Available Actions:</Text>
                                                {section.userActions.map((userAction, index) => (
                                                    <TouchableOpacity
                                                        key={index}
                                                        style={styles.userActionButton}
                                                        onPress={() => handleUserAction(userAction.action, userAction.screen)}
                                                    >
                                                        <Ionicons name="arrow-forward" size={16} color="#667eea" />
                                                        <Text style={styles.userActionText}>{userAction.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>

                    {/* Footer Actions */}
                    <View style={styles.footerActions}>
                        <TouchableOpacity
                            style={styles.footerButton}
                            onPress={() => handleUserAction('contact_support')}
                        >
                            <Ionicons name="help-circle" size={20} color="#667eea" />
                            <Text style={styles.footerButtonText}>Have Questions?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.footerButton}
                            onPress={() => Alert.alert('Download', 'Privacy policy PDF will be downloaded')}
                        >
                            <Ionicons name="document" size={20} color="#667eea" />
                            <Text style={styles.footerButtonText}>Download PDF</Text>
                        </TouchableOpacity>
                    </View>

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
        marginBottom: 15,
    },
    lastUpdatedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    lastUpdatedText: {
        fontSize: 14,
        color: '#E8E8E8',
        marginLeft: 6,
    },
    summaryCard: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 25,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    summaryContent: {
        flex: 1,
        marginLeft: 15,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    summaryText: {
        fontSize: 16,
        color: '#E8E8E8',
        lineHeight: 22,
    },
    quickNavSection: {
        marginBottom: 30,
    },
    quickNavTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 15,
    },
    quickNavGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    quickNavItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
        width: '48%',
        marginBottom: 15,
    },
    quickNavText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
        marginTop: 8,
        textAlign: 'center',
    },
    sectionsContainer: {
        marginBottom: 30,
    },
    sectionsTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 20,
    },
    section: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        marginBottom: 15,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 12,
    },
    sectionContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    sectionText: {
        fontSize: 15,
        color: '#E8E8E8',
        lineHeight: 22,
        marginBottom: 15,
    },
    userActionsContainer: {
        marginTop: 10,
    },
    userActionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 10,
    },
    userActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
    userActionText: {
        fontSize: 14,
        color: '#667eea',
        fontWeight: '500',
        marginLeft: 8,
    },
    footerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    footerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        padding: 15,
        flex: 0.48,
        justifyContent: 'center',
    },
    footerButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 100,
    },
}); 