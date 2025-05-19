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

interface DataSharingOption {
    id: string;
    title: string;
    description: string;
    enabled: boolean;
}

export default function DataSharing() {
    const navigation = useNavigation<any>();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [dataSharingOptions, setDataSharingOptions] = useState<DataSharingOption[]>([
        {
            id: 'activity_tracking',
            title: 'Activity Tracking',
            description: 'Share your activity data to help improve recommendations',
            enabled: true
        },
        {
            id: 'meal_analytics',
            title: 'Meal Analytics',
            description: 'Allow anonymous analysis of your meal choices to improve food recognition',
            enabled: true
        },
        {
            id: 'usage_statistics',
            title: 'Usage Statistics',
            description: 'Share app usage data to help us improve the user experience',
            enabled: true
        },
        {
            id: 'personalized_ads',
            title: 'Personalized Ads',
            description: 'Allow personalized ads based on your preferences',
            enabled: false
        },
        {
            id: 'third_party_sharing',
            title: 'Third-Party Data Sharing',
            description: 'Share data with trusted partners to enhance services',
            enabled: false
        }
    ]);

    useEffect(() => {
        // Simulate fetching user data sharing preferences
        const fetchDataSharingPreferences = async () => {
            try {
                // In a real app, you would fetch from a backend service
                // For demonstration, we'll just add a delay to simulate fetching
                await new Promise(resolve => setTimeout(resolve, 1000));

                // In a real app, you would update the state with fetched preferences
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching data sharing preferences:', error);
                setIsLoading(false);
            }
        };

        fetchDataSharingPreferences();
    }, []);

    const toggleOption = (id: string) => {
        setDataSharingOptions(prevOptions =>
            prevOptions.map(option =>
                option.id === id
                    ? { ...option, enabled: !option.enabled }
                    : option
            )
        );
    };

    const saveSettings = async () => {
        setIsSaving(true);

        try {
            // Simulate API call to save settings
            await new Promise(resolve => setTimeout(resolve, 1000));

            // In a real app, you would save to a backend service
            // Example:
            // const response = await fetch('api/user/data-sharing', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify(dataSharingOptions)
            // });

            Alert.alert('Success', 'Data sharing preferences updated successfully');
        } catch (error) {
            console.error('Error saving data sharing preferences:', error);
            Alert.alert('Error', 'Failed to update data sharing preferences. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9B00FF" />
                    <Text style={styles.loadingText}>Loading preferences...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Data Sharing</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.infoContainer}>
                    <Ionicons name="shield-checkmark-outline" size={40} color="#9B00FF" />
                    <Text style={styles.infoTitle}>Your Privacy Matters</Text>
                    <Text style={styles.infoText}>
                        Control how PlateMate uses your data. We prioritize your privacy
                        and allow you to customize what information is shared.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Sharing Options</Text>

                    {dataSharingOptions.map((option) => (
                        <View key={option.id} style={styles.optionItem}>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>{option.title}</Text>
                                <Text style={styles.optionDescription}>{option.description}</Text>
                            </View>
                            <Switch
                                value={option.enabled}
                                onValueChange={() => toggleOption(option.id)}
                                trackColor={{ false: '#444', true: '#9B00FF' }}
                                thumbColor={option.enabled ? '#FFF' : '#AAA'}
                            />
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveSettings}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Preferences</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.privacyPolicyButton}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                    <Text style={styles.privacyPolicyButtonText}>View Full Privacy Policy</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#FFF',
        fontSize: 16,
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
    infoContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    infoTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 10,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 15,
        color: '#CCC',
        textAlign: 'center',
        lineHeight: 22,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#9B00FF',
        marginBottom: 15,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    optionTextContainer: {
        flex: 1,
        marginRight: 10,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFF',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 14,
        color: '#AAA',
    },
    saveButton: {
        backgroundColor: '#9B00FF',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    privacyPolicyButton: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    privacyPolicyButtonText: {
        color: '#9B00FF',
        fontSize: 16,
        textDecorationLine: 'underline',
    }
}); 