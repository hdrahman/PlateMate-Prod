import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StatusBar as RNStatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
    const navigation = useNavigation<any>();
    const { resetPassword } = useAuth();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async () => {
        // Validation
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);

        try {
            await resetPassword(newPassword);

            Alert.alert(
                'Success',
                'Your password has been reset successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Navigate to Auth screen (login)
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Auth' }],
                            });
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('Reset password error:', error);

            let errorMessage = 'Failed to reset password. Please try again.';

            if (error.message?.includes('session')) {
                errorMessage = 'Your reset link has expired. Please request a new one.';
            } else if (error.message?.includes('weak password')) {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView
            style={styles.container}
            edges={['top']}
        >
            <RNStatusBar barStyle="light-content" />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Create New Password</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="lock-closed-outline" size={60} color="#9B00FF" />
                </View>

                <Text style={styles.title}>Choose a New Password</Text>
                <Text style={styles.subtitle}>
                    Create a strong password to secure your account.
                </Text>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNewPassword}
                            placeholder="Enter new password"
                            placeholderTextColor="#888"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowNewPassword(!showNewPassword)}
                        >
                            <Ionicons
                                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                size={24}
                                color="#FFF"
                            />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.helperText}>Password must be at least 8 characters</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor="#888"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            <Ionicons
                                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                size={24}
                                color="#FFF"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={handleResetPassword}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                            <Text style={styles.resetButtonText}>Reset Password</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.securityNote}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#9B00FF" />
                    <Text style={styles.securityNoteText}>
                        Your password is encrypted and secure
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingHorizontal: 16,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 24,
    },
    iconContainer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 24,
    },
    title: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: '#AAA',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        color: '#FFF',
        fontSize: 16,
        marginBottom: 8,
        fontWeight: '500',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    passwordInput: {
        flex: 1,
        color: '#FFF',
        height: 50,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 10,
    },
    helperText: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    resetButton: {
        backgroundColor: '#9B00FF',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: 8,
    },
    buttonIcon: {
        marginRight: 8,
    },
    resetButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    securityNoteText: {
        color: '#AAA',
        fontSize: 14,
        marginLeft: 8,
    },
});
