import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    Alert,
    StatusBar,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Auth } from '../utils/firebase';
import {
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'firebase/auth';

export default function DeleteAccount() {
    const navigation = useNavigation<any>();
    const { user, signOut } = useAuth();

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const handleConfirmDelete = () => {
        if (!password) {
            Alert.alert('Error', 'Please enter your password to continue');
            return;
        }

        Alert.alert(
            'Confirm Account Deletion',
            'This action is irreversible. All your data will be permanently deleted. Are you sure you want to delete your account?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: handleDeleteAccount
                }
            ]
        );
    };

    const handleDeleteAccount = async () => {
        if (!user || !user.email) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        setIsLoading(true);

        try {
            // Re-authenticate the user
            const credential = EmailAuthProvider.credential(
                user.email,
                password
            );

            await reauthenticateWithCredential(user, credential);

            // Delete the user account
            await deleteUser(user);

            // This would typically also delete user data from Firestore/database
            // For example:
            // const db = firebase.firestore();
            // await db.collection('users').doc(user.uid).delete();

            Alert.alert(
                'Account Deleted',
                'Your account has been successfully deleted.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Sign out and navigate to auth screen
                            signOut();
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('Delete account error:', error);

            // Handle specific error cases
            if (error.code === 'auth/wrong-password') {
                Alert.alert('Error', 'Password is incorrect');
            } else if (error.code === 'auth/too-many-requests') {
                Alert.alert('Error', 'Too many unsuccessful attempts. Please try again later.');
            } else {
                Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Delete Account</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.warningContainer}>
                    <Ionicons name="warning-outline" size={60} color="#FF4C4C" />
                    <Text style={styles.warningTitle}>Delete Your Account</Text>
                    <Text style={styles.warningText}>
                        This action is permanent and cannot be undone. All your data, including
                        saved meals, nutrition logs, and preferences will be permanently deleted.
                    </Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Confirm with your password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            placeholder="Enter your password"
                            placeholderTextColor="#888"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Ionicons
                                name={showPassword ? "eye-off-outline" : "eye-outline"}
                                size={24}
                                color="#FFF"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => setConfirmed(!confirmed)}
                    >
                        {confirmed && (
                            <Ionicons name="checkmark" size={20} color="#FFF" />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>
                        I understand this action is permanent and cannot be undone
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.deleteButton,
                        (!confirmed || !password || isLoading) && styles.disabledButton
                    ]}
                    onPress={handleConfirmDelete}
                    disabled={!confirmed || !password || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.deleteButtonText}>
                            Delete My Account
                        </Text>
                    )}
                </TouchableOpacity>
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
        flex: 1,
    },
    warningContainer: {
        alignItems: 'center',
        marginVertical: 30,
    },
    warningTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FF4C4C',
        marginTop: 10,
        marginBottom: 10,
    },
    warningText: {
        fontSize: 15,
        color: '#CCC',
        textAlign: 'center',
        lineHeight: 22,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        color: '#FFF',
        fontSize: 16,
        marginBottom: 8,
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
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FF4C4C',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    checkboxLabel: {
        color: '#FFF',
        fontSize: 14,
        flex: 1,
    },
    deleteButton: {
        backgroundColor: '#FF4C4C',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#661A1A',
        opacity: 0.7,
    },
    deleteButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
