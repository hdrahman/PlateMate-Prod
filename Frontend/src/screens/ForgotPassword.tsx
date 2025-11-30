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

export default function ForgotPassword() {
    const navigation = useNavigation<any>();
    const { resetPasswordForEmail } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSendResetEmail = async () => {
        // Validation
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setIsLoading(true);

        try {
            await resetPasswordForEmail(email.trim().toLowerCase());
            setEmailSent(true);
            Alert.alert(
                'Check Your Email',
                'If an account exists with this email, you will receive password reset instructions.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack()
                    }
                ]
            );
        } catch (error: any) {
            console.error('Forgot password error:', error);

            // Always show a generic message for security reasons
            // Don't reveal if the email exists in the system
            Alert.alert(
                'Email Sent',
                'If an account exists with this email, you will receive password reset instructions.'
            );
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Reset Password</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="mail-outline" size={60} color={theme.colors.primary} />
                </View>

                <Text style={[styles.title, { color: theme.colors.text }]}>Forgot Your Password?</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                    No worries! Enter your email address and we'll send you a link to reset your password.
                </Text>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Email Address</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                        <Ionicons
                            name="mail-outline"
                            size={20}
                            color={theme.colors.textSecondary}
                            style={styles.inputIcon}
                        />
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter your email"
                            placeholderTextColor={theme.colors.textSecondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            autoCorrect={false}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: theme.colors.primary }, emailSent && styles.sendButtonDisabled]}
                    onPress={handleSendResetEmail}
                    disabled={isLoading || emailSent}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                    ) : (
                        <>
                            <Ionicons name="send-outline" size={20} color={theme.colors.text} style={styles.buttonIcon} />
                            <Text style={[styles.sendButtonText, { color: theme.colors.text }]}>Send Reset Link</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.backToLoginButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.backToLoginText, { color: theme.colors.primary }]}>Back to Sign In</Text>
                </TouchableOpacity>
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
        height: 60,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
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
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 15,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
    },
    sendButton: {
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#555',
    },
    buttonIcon: {
        marginRight: 8,
    },
    sendButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    backToLoginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        paddingVertical: 12,
    },
    backToLoginText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 6,
    },
});
