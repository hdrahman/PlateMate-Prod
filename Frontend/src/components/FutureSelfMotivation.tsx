import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../ThemeContext';
import { getFutureSelfMessage, getMotivationalQuotesByType, FutureSelfMessage } from '../utils/futureSelfService';

interface FutureSelfMotivationProps {
    visible: boolean;
    onClose: () => void;
    motivationType?: 'tough_times' | 'temptation' | 'progress' | 'motivation';
}

const { width, height } = Dimensions.get('window');

const FutureSelfMotivation: React.FC<FutureSelfMotivationProps> = ({
    visible,
    onClose,
    motivationType = 'motivation'
}) => {
    const { user } = useAuth();
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const [futureSelfMessage, setFutureSelfMessage] = useState<FutureSelfMessage | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showQuotes, setShowQuotes] = useState(false);

    useEffect(() => {
        if (visible && user) {
            loadFutureSelfMessage();
        }
    }, [visible, user]);

    const loadFutureSelfMessage = async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            const message = await getFutureSelfMessage(user.uid);
            setFutureSelfMessage(message);
        } catch (error) {
            console.error('Error loading future self message:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getMotivationalTitle = () => {
        switch (motivationType) {
            case 'tough_times':
                return 'When Times Get Tough';
            case 'temptation':
                return 'Overcome Temptation';
            case 'progress':
                return 'Celebrate Your Progress';
            default:
                return 'Daily Motivation';
        }
    };

    const getMotivationalIcon = () => {
        switch (motivationType) {
            case 'tough_times':
                return 'shield-outline';
            case 'temptation':
                return 'flash-outline';
            case 'progress':
                return 'trophy-outline';
            default:
                return 'heart-outline';
        }
    };

    const getGradientColors = () => {
        switch (motivationType) {
            case 'tough_times':
                return ['#FF6B6B', '#FF8E53'];
            case 'temptation':
                return ['#4ECDC4', '#44A08D'];
            case 'progress':
                return ['#FFD700', '#FFA500'];
            default:
                return ['#667eea', '#764ba2'];
        }
    };

    const quotes = getMotivationalQuotesByType(futureSelfMessage?.type || motivationType);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: isDarkTheme ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.7)' }]}>
                <View style={[styles.container, { backgroundColor: theme.colors.cardBackground }]}>
                    <LinearGradient
                        colors={[theme.colors.background, theme.colors.cardBackground]}
                        style={styles.background}
                    />

                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Ionicons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.title, { color: theme.colors.text }]}>{getMotivationalTitle()}</Text>
                        </View>

                        {/* Main Message Card */}
                        {!isLoading && futureSelfMessage && (
                            <View style={styles.messageCard}>
                                <LinearGradient
                                    colors={getGradientColors()}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.messageGradient}
                                >
                                    <View style={styles.messageHeader}>
                                        <Ionicons name="mail" size={32} color="#fff" />
                                        <Text style={styles.messageTitle}>Message from Past You</Text>
                                    </View>

                                    <View style={styles.messageContent}>
                                        <Text style={styles.messageText}>"{futureSelfMessage.message}"</Text>
                                        <Text style={styles.messageDate}>
                                            Written on {new Date(futureSelfMessage.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </View>
                        )}

                        {/* Backup Motivational Quotes */}
                        <View style={styles.quotesSection}>
                            <TouchableOpacity
                                style={[styles.quotesToggle, { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}15` }]}
                                onPress={() => setShowQuotes(!showQuotes)}
                            >
                                <Ionicons
                                    name={getMotivationalIcon() as any}
                                    size={20}
                                    color={theme.colors.primary}
                                />
                                <Text style={[styles.quotesToggleText, { color: theme.colors.primary }]}>
                                    {showQuotes ? 'Hide' : 'Show'} Additional Motivation
                                </Text>
                                <Ionicons
                                    name={showQuotes ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            </TouchableOpacity>

                            {showQuotes && (
                                <View style={styles.quotesContainer}>
                                    {quotes.map((quote, index) => (
                                        <View key={index} style={[styles.quoteCard, { backgroundColor: `${theme.colors.text}15` }]}>
                                            <Text style={[styles.quoteText, { color: theme.colors.text }]}>"{quote}"</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.feelBetterButton} onPress={onClose}>
                                <LinearGradient
                                    colors={["#0074dd", "#5c00dd"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                    <Text style={styles.buttonText}>I Feel Better</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {!futureSelfMessage && !isLoading && (
                            <View style={styles.noMessageContainer}>
                                <Ionicons name="heart-outline" size={48} color={theme.colors.textSecondary} />
                                <Text style={[styles.noMessageTitle, { color: theme.colors.text }]}>No Personal Message Yet</Text>
                                <Text style={[styles.noMessageText, { color: theme.colors.textSecondary }]}>
                                    You can create a personal motivation message in your profile settings
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width * 0.9,
        maxHeight: height * 0.8,
        borderRadius: 20,
        overflow: 'hidden',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    closeButton: {
        marginRight: 16,
        padding: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        flex: 1,
    },
    messageCard: {
        marginBottom: 24,
        borderRadius: 16,
        overflow: 'hidden',
    },
    messageGradient: {
        padding: 20,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    messageTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 12,
    },
    messageContent: {
        marginTop: 8,
    },
    messageText: {
        fontSize: 16,
        color: '#fff',
        lineHeight: 24,
        fontStyle: 'italic',
        marginBottom: 12,
    },
    messageDate: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'right',
    },
    quotesSection: {
        marginBottom: 24,
    },
    quotesToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
    },
    quotesToggleText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    quotesContainer: {
        marginTop: 16,
    },
    quoteCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    quoteText: {
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    actionButtons: {
        gap: 12,
    },
    feelBetterButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    noMessageContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    noMessageTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    noMessageText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default FutureSelfMotivation; 