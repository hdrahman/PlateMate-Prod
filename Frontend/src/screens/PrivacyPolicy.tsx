import React, { useState, useContext } from 'react';
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
    Dimensions,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PrivacyPolicySection } from '../types/notifications';
import MaskedView from '@react-native-masked-view/masked-view';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../ThemeContext';

// Define theme colors
const PRIMARY_BG = '#000000';
// CARD_BG removed - use theme.colors.cardBackground instead
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const ACCENT_BLUE = '#2196F3';
const ACCENT_RED = '#FF6B6B';
const ACCENT_TEAL = '#4ECDC4';
const ACCENT_ORANGE = '#F39C12';
const ACCENT_PURPLE = '#8E44AD';

// Gradient border card wrapper component
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
    theme?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style, theme }) => {
    const cardBg = theme?.colors?.cardBackground || '#1E1E1E';
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
                    backgroundColor: style?.backgroundColor || cardBg,
                    padding: 16,
                    ...style
                }}
            >
                {children}
            </View>
        </View>
    );
};

export default function PrivacyPolicy() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { theme, isDarkTheme } = useContext(ThemeContext);
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
                    navigation.navigate(screen as never);
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
            case 'security_settings':
                Alert.alert('Security Settings', 'Security settings feature coming soon.');
                break;
            case 'user_rights':
                Alert.alert('Your Rights', 'Detailed rights management features coming soon.');
                break;
            default:
                Alert.alert('Action', `${action} feature coming soon`);
        }
    };

    const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
        switch (importance) {
            case 'high': return '#FF6B6B';
            case 'medium': return '#F39C12';
            case 'low': return '#4ECDC4';
        }
    };

    const getImportanceIcon = (importance: 'high' | 'medium' | 'low') => {
        switch (importance) {
            case 'high': return 'warning';
            case 'medium': return 'information-circle';
            case 'low': return 'checkmark-circle';
        }
    };

    // Create gradient text component
    const GradientText = ({ text, style }: { text: string, style?: any }) => {
        return (
            <MaskedView
                maskElement={<Text style={[styles.title, style]}>{text}</Text>}
            >
                <LinearGradient
                    colors={['#0074dd', '#5c00dd', '#dd0095']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={[styles.title, style, { opacity: 0 }]}>{text}</Text>
                </LinearGradient>
            </MaskedView>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom,
                    paddingHorizontal: 20
                }}
            >
                {/* Header with Back Button */}
                <View style={styles.headerContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <View style={styles.header}>
                        <GradientText text="Privacy Policy" />
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            Transparent about how we handle your data
                        </Text>
                        <View style={[styles.lastUpdatedContainer, { backgroundColor: theme.colors.border }]}>
                            <Ionicons name="calendar" size={16} color={theme.colors.textSecondary} />
                            <Text style={[styles.lastUpdatedText, { color: theme.colors.textSecondary }]}>
                                Last updated: {lastUpdated.toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* New Privacy Emphasis Card */}
                <GradientBorderCard theme={theme}>
                    <View style={styles.privacyEmphasisCard}>
                        <LinearGradient
                            colors={['#0074dd', '#5c00dd', '#dd0095']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.emphasisIconContainer}
                        >
                            <Ionicons name="shield-checkmark-outline" size={32} color={WHITE} />
                        </LinearGradient>
                        <View style={styles.emphasisContent}>
                            <Text style={[styles.emphasisTitle, { color: theme.colors.text }]}>Your Data Stays on Your Device</Text>
                            <Text style={[styles.emphasisText, { color: theme.colors.textSecondary }]}>
                                <Text style={[styles.emphasisBold, { color: theme.colors.text }]}>PlateMate stores all your nutrition, fitness, and health data locally.</Text> We
                                only store basic profile information from settings. Everything else never leaves your
                                device — we have no access to your personal data.
                            </Text>
                        </View>
                    </View>
                </GradientBorderCard>

                {/* Quick Summary */}
                <GradientBorderCard theme={theme}>
                    <View style={styles.summaryCard}>
                        <LinearGradient
                            colors={['#4ECDC4', '#26A69A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.shieldIconContainer}
                        >
                            <Ionicons name="shield-checkmark" size={32} color={WHITE} />
                        </LinearGradient>
                        <View style={styles.summaryContent}>
                            <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Privacy At a Glance</Text>
                            <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
                                Your data stays on your device. We don't collect, share, or sell your personal information.
                                You have complete control over your health and fitness data.
                            </Text>
                        </View>
                    </View>
                </GradientBorderCard>

                {/* Quick Navigation */}
                <View style={styles.quickNavSection}>
                    <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>Quick Access</Text>
                    <View style={styles.quickNavGrid}>
                        <TouchableOpacity
                            style={[styles.quickNavItem, { backgroundColor: theme.colors.cardBackground }]}
                            onPress={() => handleUserAction('data_settings', 'DataSharing')}
                        >
                            <LinearGradient
                                colors={['#2196F3', '#1976D2']}
                                style={styles.quickNavIconContainer}
                            >
                                <Ionicons name="settings" size={24} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={[styles.quickNavText, { color: theme.colors.text }]}>Data Settings</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickNavItem, { backgroundColor: theme.colors.cardBackground }]}
                            onPress={() => handleUserAction('export_data')}
                        >
                            <LinearGradient
                                colors={['#4ECDC4', '#26A69A']}
                                style={styles.quickNavIconContainer}
                            >
                                <Ionicons name="download" size={24} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={[styles.quickNavText, { color: theme.colors.text }]}>Export Data</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickNavItem, { backgroundColor: theme.colors.cardBackground }]}
                            onPress={() => handleUserAction('contact_support')}
                        >
                            <LinearGradient
                                colors={['#8E44AD', '#9B59B6']}
                                style={styles.quickNavIconContainer}
                            >
                                <Ionicons name="mail" size={24} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={[styles.quickNavText, { color: theme.colors.text }]}>Contact Us</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickNavItem, { backgroundColor: theme.colors.cardBackground }]}
                            onPress={() => handleUserAction('delete_data')}
                        >
                            <LinearGradient
                                colors={['#FF6B6B', '#E74C3C']}
                                style={styles.quickNavIconContainer}
                            >
                                <Ionicons name="trash" size={24} color="#FFFFFF" />
                            </LinearGradient>
                            <Text style={[styles.quickNavText, { color: theme.colors.text }]}>Delete Data</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Privacy Policy Sections */}
                <View style={styles.sectionsContainer}>
                    <Text style={[styles.sectionHeaderText, { color: theme.colors.text }]}>Full Privacy Policy</Text>

                    {privacyPolicySections.map((section) => (
                        <GradientBorderCard key={section.id} style={styles.sectionCardInner}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={() => toggleSection(section.id)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.sectionTitleContainer}>
                                    <View style={[
                                        styles.importanceIconContainer,
                                        { backgroundColor: getImportanceColor(section.importance) + '20' }
                                    ]}>
                                        <Ionicons
                                            name={getImportanceIcon(section.importance)}
                                            size={20}
                                            color={getImportanceColor(section.importance)}
                                        />
                                    </View>
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
                                </View>
                                <View style={[styles.chevronContainer, { backgroundColor: theme.colors.border }]}>
                                    <Ionicons
                                        name={expandedSections.has(section.id) ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color={theme.colors.textSecondary}
                                    />
                                </View>
                            </TouchableOpacity>

                            {expandedSections.has(section.id) && (
                                <View style={[styles.sectionContent, { borderTopColor: theme.colors.border }]}>
                                    <Text style={[styles.sectionText, { color: theme.colors.textSecondary }]}>{section.content}</Text>

                                    {section.userActions && section.userActions.length > 0 && (
                                        <View style={styles.userActionsContainer}>
                                            <Text style={[styles.userActionsTitle, { color: theme.colors.text }]}>Available Actions:</Text>
                                            {section.userActions.map((userAction, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={styles.userActionButton}
                                                    onPress={() => handleUserAction(userAction.action, userAction.screen)}
                                                >
                                                    <LinearGradient
                                                        colors={['#0074dd', '#5c00dd']}
                                                        style={styles.actionButtonGradient}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                    >
                                                        <Ionicons name="arrow-forward" size={16} color={WHITE} />
                                                        <Text style={styles.userActionText}>{userAction.label}</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}
                        </GradientBorderCard>
                    ))}
                </View>

                {/* Footer Actions */}
                <View style={styles.footerActions}>
                    <TouchableOpacity
                        style={styles.footerButton}
                        onPress={() => handleUserAction('contact_support')}
                    >
                        <LinearGradient
                            colors={['#0074dd', '#5c00dd']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.footerButtonGradient}
                        >
                            <Ionicons name="help-circle" size={20} color={WHITE} />
                            <Text style={styles.footerButtonText}>Have Questions?</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.footerButton}
                        onPress={() => Alert.alert('Download', 'Privacy policy PDF will be downloaded')}
                    >
                        <LinearGradient
                            colors={['#5c00dd', '#dd0095']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.footerButtonGradient}
                        >
                            <Ionicons name="document" size={20} color={WHITE} />
                            <Text style={styles.footerButtonText}>Download PDF</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    headerContainer: {
        paddingVertical: 20,
        position: 'relative',
        marginTop: 10,
    },
    backButton: {
        position: 'absolute',
        left: 0,
        top: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: SUBDUED,
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
        color: SUBDUED,
        marginLeft: 6,
    },
    privacyEmphasisCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
        backgroundColor: 'rgba(33, 150, 243, 0.05)', // Subtle blue tint
    },
    emphasisIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emphasisContent: {
        flex: 1,
        marginLeft: 15,
    },
    emphasisTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    emphasisText: {
        fontSize: 15,
        color: SUBDUED,
        lineHeight: 22,
    },
    emphasisBold: {
        fontWeight: 'bold',
        color: WHITE,
    },
    shieldIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
    },
    summaryContent: {
        flex: 1,
        marginLeft: 15,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: WHITE,
        marginBottom: 8,
    },
    summaryText: {
        fontSize: 15,
        color: SUBDUED,
        lineHeight: 22,
    },
    quickNavSection: {
        marginVertical: 24,
    },
    sectionHeaderText: {
        fontSize: 18,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 16,
        paddingLeft: 5,
    },
    quickNavGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    quickNavItem: {
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        width: '48%',
        marginBottom: 15,
    },
    quickNavIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickNavText: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '500',
        marginTop: 8,
        textAlign: 'center',
    },
    sectionsContainer: {
        marginBottom: 24,
    },
    gradientBorderContainer: {
        marginVertical: 10,
        borderRadius: 16,
    },
    sectionCardInner: {
        padding: 0,
    },
    section: {
        borderRadius: 16,
        marginBottom: 15,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    importanceIconContainer: {
        padding: 8,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: WHITE,
        marginLeft: 12,
    },
    chevronContainer: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    sectionText: {
        fontSize: 15,
        color: SUBDUED,
        lineHeight: 22,
        marginVertical: 12,
    },
    userActionsContainer: {
        marginTop: 16,
    },
    userActionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: WHITE,
        marginBottom: 12,
    },
    userActionButton: {
        marginBottom: 8,
        borderRadius: 10,
        overflow: 'hidden',
    },
    actionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    userActionText: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '500',
        marginLeft: 8,
    },
    footerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    footerButton: {
        flex: 0.48,
        borderRadius: 16,
        overflow: 'hidden',
    },
    footerButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
    },
    footerButtonText: {
        fontSize: 14,
        color: WHITE,
        fontWeight: '500',
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 40,
    },
}); 
