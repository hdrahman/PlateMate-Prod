import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { fixOnboardingDataIssues, validateOnboardingData } from '../utils/fixOnboardingData';
import { debugDatabaseSchema, debugUserProfile, debugNutritionGoals } from '../utils/debugDatabase';

const DebugOnboarding: React.FC = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>('');

    const handleDebugDatabase = async () => {
        if (!user) {
            Alert.alert('Error', 'No user logged in');
            return;
        }

        setIsLoading(true);
        setDebugInfo('');

        try {
            let info = '🔍 DATABASE DEBUG REPORT\n\n';

            // Check database schema
            const schema = await debugDatabaseSchema();
            info += '📋 Database Schema:\n';
            info += `- fitness_goal column: ${schema.hasFitnessGoal ? '✅' : '❌'}\n`;
            info += `- weight_goal column: ${schema.hasWeightGoal ? '✅' : '❌'}\n`;
            info += `- daily_calorie_target column: ${schema.hasDailyCalorieTarget ? '✅' : '❌'}\n\n`;

            // Check user profile
            const profile = await debugUserProfile(user.uid);
            info += '👤 User Profile:\n';
            if (profile) {
                const profileData = profile as any;
                info += `- fitness_goal: ${profileData.fitness_goal || 'NULL'}\n`;
                info += `- weight_goal: ${profileData.weight_goal || 'NULL'}\n`;
                info += `- daily_calorie_target: ${profileData.daily_calorie_target || 'NULL'}\n`;
                info += `- onboarding_complete: ${profileData.onboarding_complete ? 'YES' : 'NO'}\n\n`;
            } else {
                info += '❌ No profile found\n\n';
            }

            // Check nutrition goals
            const nutritionGoals = await debugNutritionGoals(user.uid);
            info += '🎯 Nutrition Goals:\n';
            if (nutritionGoals) {
                const goalsData = nutritionGoals as any;
                info += `- daily_calorie_goal: ${goalsData.daily_calorie_goal || 'NULL'}\n`;
                info += `- weight_goal: ${goalsData.weight_goal || 'NULL'}\n`;
                info += `- target_weight: ${goalsData.target_weight || 'NULL'}\n\n`;
            } else {
                info += '❌ No nutrition goals found\n\n';
            }

            // Validate data
            const isValid = await validateOnboardingData(user.uid);
            info += `🔍 Data Validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}\n`;

            setDebugInfo(info);
        } catch (error) {
            console.error('Debug error:', error);
            Alert.alert('Debug Error', `Failed to debug database: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFixData = async () => {
        if (!user) {
            Alert.alert('Error', 'No user logged in');
            return;
        }

        Alert.alert(
            'Fix Onboarding Data',
            'This will reset the database version to force migrations and fix missing data. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Fix',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const success = await fixOnboardingDataIssues(user.uid);
                            if (success) {
                                Alert.alert('Success', 'Onboarding data has been fixed! Please restart the app.');
                            } else {
                                Alert.alert('Error', 'Failed to fix onboarding data. Check console logs.');
                            }
                        } catch (error) {
                            console.error('Fix error:', error);
                            Alert.alert('Error', `Failed to fix data: ${error}`);
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Please log in to use debug tools</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>🔧 Onboarding Debug Tools</Text>
            <Text style={styles.subtitle}>User: {user.email}</Text>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.debugButton]}
                    onPress={handleDebugDatabase}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? '🔄 Debugging...' : '🔍 Debug Database'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.fixButton]}
                    onPress={handleFixData}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? '🔄 Fixing...' : '🔧 Fix Data Issues'}
                    </Text>
                </TouchableOpacity>
            </View>

            {debugInfo ? (
                <View style={styles.debugOutput}>
                    <Text style={styles.debugText}>{debugInfo}</Text>
                </View>
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#000',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginBottom: 30,
    },
    buttonContainer: {
        gap: 15,
        marginBottom: 30,
    },
    button: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    debugButton: {
        backgroundColor: '#2196F3',
    },
    fixButton: {
        backgroundColor: '#FF6B6B',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    debugOutput: {
        backgroundColor: '#1C1C1E',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    debugText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'monospace',
        lineHeight: 18,
    },
    errorText: {
        color: '#FF6B6B',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 50,
    },
});

export default DebugOnboarding; 