import React, { useState, useEffect } from 'react';
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
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <LinearGradient
                        colors={['#000000', '#1a1a1a']}
                        style={styles.background}
                    />

                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.title}>{getMotivationalTitle()}</Text>
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
                                style={styles.quotesToggle}
                                onPress={() => setShowQuotes(!showQuotes)}
                            >
                                <Ionicons
                                    name={getMotivationalIcon() as any}
                                    size={20}
                                    color="#FFD700"
                                />
                                <Text style={styles.quotesToggleText}>
                                    {showQuotes ? 'Hide' : 'Show'} Additional Motivation
                                </Text>
                                <Ionicons
                                    name={showQuotes ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#FFD700"
                                />
                            </TouchableOpacity>

                            {showQuotes && (
                                <View style={styles.quotesContainer}>
                                    {quotes.map((quote, index) => (
                                        <View key={index} style={styles.quoteCard}>
                                            <Text style={styles.quoteText}>"{quote}"</Text>
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
                                <Ionicons name="heart-outline" size={48} color="#666" />
                                <Text style={styles.noMessageTitle}>No Personal Message Yet</Text>
                                <Text style={styles.noMessageText}>
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
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
        color: '#fff',
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
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    quotesToggleText: {
        flex: 1,
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    quotesContainer: {
        marginTop: 16,
    },
    quoteCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    quoteText: {
        color: '#fff',
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
        color: '#fff',
        marginTop: 16,
        marginBottom: 8,
    },
    noMessageText: {
        fontSize: 14,
        color: '#aaa',
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default FutureSelfMotivation; 