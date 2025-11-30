import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { FeatureRequest, toggleFeatureUpvote } from '../api/features';

interface FeatureRequestCardProps {
    request: FeatureRequest;
    onUpvoteChange?: (requestId: string, newUpvoteStatus: boolean) => void;
    onPress?: () => void;
    isOffline?: boolean;
}

const FeatureRequestCard: React.FC<FeatureRequestCardProps> = ({
    request,
    onUpvoteChange,
    onPress,
    isOffline = false
}) => {
    const [isUpvoting, setIsUpvoting] = useState(false);
    const [userUpvoted, setUserUpvoted] = useState(request.user_upvoted);
    const [upvoteCount, setUpvoteCount] = useState(request.upvotes);
    const { theme, isDarkTheme } = useContext(ThemeContext);

    const handleUpvote = async () => {
        if (isOffline) {
            Alert.alert('Offline', 'Connect to internet to vote on features');
            return;
        }

        if (isUpvoting) return;

        setIsUpvoting(true);
        try {
            const result = await toggleFeatureUpvote(request.id);

            if (result.success) {
                const newUpvoteStatus = result.upvoted;
                setUserUpvoted(newUpvoteStatus);
                setUpvoteCount(prev => newUpvoteStatus ? prev + 1 : prev - 1);

                // Notify parent component
                onUpvoteChange?.(request.id, newUpvoteStatus);

                // Haptic feedback could be added here
            } else {
                Alert.alert('Error', result.message || 'Failed to update vote');
            }
        } catch (error) {
            console.error('Error toggling upvote:', error);
            Alert.alert('Error', 'Failed to update vote. Please try again.');
        } finally {
            setIsUpvoting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted':
                return '#FFD700'; // Gold
            case 'in_review':
                return '#FF8C00'; // Orange
            case 'in_progress':
                return '#00BFFF'; // Deep Sky Blue
            case 'completed':
                return '#32CD32'; // Lime Green
            case 'rejected':
                return '#FF6B6B'; // Red
            default:
                return '#777';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'paper-plane-outline';
            case 'in_review':
                return 'eye-outline';
            case 'in_progress':
                return 'construct-outline';
            case 'completed':
                return 'checkmark-circle-outline';
            case 'rejected':
                return 'close-circle-outline';
            default:
                return 'help-outline';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'Submitted';
            case 'in_review':
                return 'In Review';
            case 'in_progress':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'rejected':
                return 'Rejected';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        } else if (diffInHours < 24 * 7) {
            return `${Math.floor(diffInHours / 24)}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                    <Ionicons
                        name={getStatusIcon(request.status)}
                        size={12}
                        color={getStatusColor(request.status)}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                        {getStatusText(request.status)}
                    </Text>
                </View>
                <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>{formatDate(request.created_at)}</Text>
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>{request.title}</Text>Lines={2}>{request.title}</Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={3}>{request.description}</Text>

            <View style={styles.cardFooter}>
                <View style={styles.authorContainer}>
                    <Ionicons name="person-outline" size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.authorText, { color: theme.colors.textSecondary }]}>{request.author_name}</Text>
                </View>

                <View style={styles.rightSection}>
                    {request.status === 'in_progress' && (
                        <View style={styles.progressIndicator}>
                            <Ionicons name="hammer" size={16} color="#00BFFF" />
                            <Text style={styles.progressText}>In Dev</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.upvoteButton,
                            { backgroundColor: theme.colors.border },
                            userUpvoted && styles.upvotedButton,
                            (isOffline || isUpvoting) && styles.disabledButton
                        ]}
                        onPress={handleUpvote}
                        disabled={isOffline || isUpvoting}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={userUpvoted ? "heart" : "heart-outline"}
                            size={18}
                            color={userUpvoted ? "#FF6B6B" : theme.colors.textSecondary}
                        />
                        <Text style={[
                            styles.upvoteText,
                            { color: theme.colors.textSecondary },
                            userUpvoted && styles.upvotedText
                        ]}>
                            {upvoteCount}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {
        isOffline && (
            <View style={styles.offlineIndicator}>
                <Ionicons name="wifi-outline" size={12} color="#FF6B6B" />
                <Text style={styles.offlineText}>Offline</Text>
            </View>
        )
    }
        </TouchableOpacity >
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        marginHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    dateText: {
        fontSize: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        lineHeight: 20,
    },
    description: {
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 18,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    authorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    authorText: {
        fontSize: 12,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#00BFFF20',
        borderRadius: 8,
    },
    progressText: {
        fontSize: 12,
        color: '#00BFFF',
        fontWeight: '600',
    },
    upvoteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 60,
        justifyContent: 'center',
    },
    upvotedButton: {
        backgroundColor: '#FF6B6B20',
        borderColor: '#FF6B6B',
        borderWidth: 1,
    },
    disabledButton: {
        opacity: 0.5,
    },
    upvoteText: {
        fontSize: 14,
        fontWeight: '600',
    },
    upvotedText: {
        color: '#FF6B6B',
    },
    offlineIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#FF6B6B20',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FF6B6B',
    },
    offlineText: {
        fontSize: 10,
        color: '#FF6B6B',
        fontWeight: '600',
    },
});

export default FeatureRequestCard; 