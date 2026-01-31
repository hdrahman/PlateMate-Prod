import React, { useState, useContext } from 'react';
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
import { ThemeContext } from '../ThemeContext';

export default function ResetPassword() {
    const navigation = useNavigation<any>();
    const { resetPassword } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);

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

        // Validate password contains lowercase, uppercase, and number
        if (!/[a-z]/.test(newPassword)) {
            Alert.alert('Error', 'Password must contain at least one lowercase letter');
            return;
        }

        if (!/[A-Z]/.test(newPassword)) {
            Alert.alert('Error', 'Password must contain at least one uppercase letter');
            return;
        }

        if (!/[0-9]/.test(newPassword)) {
            Alert.alert('Error', 'Password must contain at least one number');
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
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            edges={['top']}
        >
            <RNStatusBar barStyle={isDarkTheme ? "light-content" : "dark-content"} />

            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create New Password</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="lock-closed-outline" size={60} color={theme.colors.primary} />
                </View>

                <Text style={[styles.title, { color: theme.colors.text }]}>Choose a New Password</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    Create a strong password to secure your account.
                </Text>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>New Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.passwordInput, { color: theme.colors.text }]}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNewPassword}
                            placeholder="Enter new password"
                            placeholderTextColor={theme.colors.textSecondary}
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
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Password must be at least 8 characters</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Confirm New Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <TextInput
                            style={[styles.passwordInput, { color: theme.colors.text }]}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor={theme.colors.textSecondary}
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
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.resetButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleResetPassword}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.text} style={styles.buttonIcon} />
                            <Text style={[styles.resetButtonText, { color: theme.colors.text }]}>Reset Password</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={[styles.securityNote, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
                    <Text style={[styles.securityNoteText, { color: theme.colors.textSecondary }]}>
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
    },
    headerTitle: {
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
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
        fontWeight: '500',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
    },
    passwordInput: {
        flex: 1,
        height: 50,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 10,
    },
    helperText: {
        fontSize: 12,
        marginTop: 4,
    },
    resetButton: {
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
        borderRadius: 8,
        borderWidth: 1,
    },
    securityNoteText: {
        fontSize: 14,
        marginLeft: 8,
    },
});
