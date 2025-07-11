import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
    PRIMARY_BG: '#000000',
    CARD_BG: '#1C1C1E',
    WHITE: '#FFFFFF',
    SUBDUED: '#AAAAAA',
    PURPLE_ACCENT: '#AA00FF',
    SUCCESS: '#4CAF50',
    ERROR: '#F44336',
};

const FutureSelfRecordingSimple: React.FC = () => {
    console.log('🎬 FutureSelfRecordingSimple component mounted successfully!');

    const { user } = useAuth();
    const navigation = useNavigation();
    const [textMessage, setTextMessage] = useState<string>('');

    const handleSave = async () => {
        Alert.alert(
            'Success!',
            'Your future self message has been saved (mock). This is a simplified version for testing.',
            [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.PRIMARY_BG} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Future Self Message</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Record a Message to Your Future Self</Text>
                    <Text style={styles.sectionSubtitle}>
                        This is a simplified version for testing navigation.
                    </Text>
                </View>

                {/* Text Message Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Your message:</Text>
                    <TextInput
                        style={styles.textInput}
                        value={textMessage}
                        onChangeText={setTextMessage}
                        placeholder="Write a message to remind yourself why this journey matters..."
                        placeholderTextColor={COLORS.SUBDUED}
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                    />
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.testButton}
                        onPress={() => Alert.alert('Test', 'Button working! Navigation successful.')}
                    >
                        <LinearGradient
                            colors={[COLORS.SUCCESS, '#45a049']}
                            style={styles.buttonGradient}
                        >
                            <Ionicons name="checkmark" size={20} color={COLORS.WHITE} />
                            <Text style={styles.buttonText}>Test Button</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.PRIMARY_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.CARD_BG,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    saveButton: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.PURPLE_ACCENT,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.WHITE,
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 16,
        color: COLORS.SUBDUED,
        lineHeight: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
        marginBottom: 12,
    },
    textInput: {
        backgroundColor: COLORS.CARD_BG,
        borderRadius: 12,
        padding: 16,
        color: COLORS.WHITE,
        fontSize: 16,
        minHeight: 120,
    },
    testButton: {
        borderRadius: 50,
        overflow: 'hidden',
        alignSelf: 'center',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    buttonText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.WHITE,
    },
    bottomSpacer: {
        height: 40,
    },
});

export default FutureSelfRecordingSimple;
