import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    FlatList,
    RefreshControl,
    TextInput,
    Alert,
    ActivityIndicator,
    Dimensions,
    Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFeatureRequests } from '../hooks/useFeatureRequests';
import { toggleFeatureUpvote, FeatureRequest } from '../api/features';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../utils/config';

const { width } = Dimensions.get('window');

// Status colors for badges
const STATUS_CONFIG = {
    submitted: { color: '#FFD700', icon: 'time-outline', label: 'Submitted' },
    in_review: { color: '#FF9500', icon: 'search-outline', label: 'In Review' },
    in_progress: { color: '#007AFF', icon: 'build-outline', label: 'In Progress' },
    completed: { color: '#34C759', icon: 'checkmark-circle-outline', label: 'Completed' },
    rejected: { color: '#FF3B30', icon: 'close-circle-outline', label: 'Rejected' }
};

// Tab types
type TabType = 'leaderboard' | 'my-activity';

const FeatureRequestCard: React.FC<{
    request: FeatureRequest;
    onUpvote: (id: string) => void;
    isUpvoting: boolean;
    showRank?: boolean;
    rank?: number;
}> = ({ request, onUpvote, isUpvoting, showRank = false, rank }) => {
    const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];

    const handleUpvote = useCallback(() => {
        if (!isUpvoting) {
            onUpvote(request.id);
        }
    }, [request.id, onUpvote, isUpvoting]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    return (
        <View style={styles.cardContainer}>
            <LinearGradient
                colors={['#1E1E1E', '#2A2A2A']}
                style={styles.card}
            >
                {/* Rank badge for leaderboard */}
                {showRank && rank && (
                    <View style={[styles.rankBadge, getRankBadgeStyle(rank)]}>
                        <Text style={[styles.rankText, getRankTextStyle(rank)]}>
                            #{rank}
                        </Text>
                    </View>
                )}

                {/* Header with status and date */}
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                        <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                        </Text>
                    </View>
                    <Text style={styles.dateText}>{formatDate(request.created_at)}</Text>
                </View>

                {/* Title and description */}
                <Text style={styles.cardTitle} numberOfLines={2}>{request.title}</Text>
                <Text style={styles.cardDescription} numberOfLines={3}>
                    {request.description}
                </Text>

                {/* Footer with author and prominent vote button */}
                <View style={styles.cardFooter}>
                    <View style={styles.authorContainer}>
                        <Ionicons name="person-outline" size={14} color="#888" />
                        <Text style={styles.authorText}>{request.author_name}</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.voteButton,
                            request.user_upvoted && styles.voteButtonActive,
                            isUpvoting && styles.voteButtonDisabled
                        ]}
                        onPress={handleUpvote}
                        disabled={isUpvoting}
                    >
                        {isUpvoting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons
                                    name={request.user_upvoted ? "arrow-up" : "arrow-up-outline"}
                                    size={20}
                                    color={request.user_upvoted ? "#FFF" : "#9B00FF"}
                                />
                                <Text style={[
                                    styles.voteCount,
                                    request.user_upvoted && styles.voteCountActive
                                ]}>
                                    {request.upvotes}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
};

// Helper functions for rank styling
const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return { backgroundColor: '#FFD700' }; // Gold
    if (rank === 2) return { backgroundColor: '#C0C0C0' }; // Silver
    if (rank === 3) return { backgroundColor: '#CD7F32' }; // Bronze
    return { backgroundColor: '#555' };
};

const getRankTextStyle = (rank: number) => {
    if (rank <= 3) return { color: '#000', fontWeight: '700' as const };
    return { color: '#FFF', fontWeight: '600' as const };
};

const TabButton: React.FC<{
    title: string;
    isActive: boolean;
    onPress: () => void;
    count?: number;
}> = ({ title, isActive, onPress, count }) => (
    <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={onPress}
    >
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
            {title}
            {count !== undefined && ` (${count})`}
        </Text>
        {isActive && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
);

const FeatureRequestsScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    // State
    const [activeTab, setActiveTab] = useState<TabType>('leaderboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [upvotingIds, setUpvotingIds] = useState<Set<string>>(new Set());

    // Hook for leaderboard data (sorted by upvotes)
    const {
        requests: allRequests,
        isLoading: isLoadingAll,
        isRefreshing: isRefreshingAll,
        error: errorAll,
        networkStatus,
        refresh: refreshAll,
        loadMore: loadMoreAll,
        handleUpvoteChange
    } = useFeatureRequests({
        autoRefresh: true,
        cacheEnabled: true
    });

    // Hook for user's activity (submitted + upvoted)
    const {
        requests: myRequests,
        isLoading: isLoadingMy,
        isRefreshing: isRefreshingMy,
        error: errorMy,
        refresh: refreshMy,
        loadMore: loadMoreMy
    } = useFeatureRequests({
        status: 'my-requests',
        autoRefresh: true,
        cacheEnabled: false
    });

    // Sort requests by upvotes for leaderboard
    const leaderboardRequests = useMemo(() => {
        return [...allRequests].sort((a, b) => b.upvotes - a.upvotes);
    }, [allRequests]);

    // Filter requests by search query
    const getFilteredRequests = useCallback((requests: FeatureRequest[]) => {
        if (!searchQuery.trim()) return requests;

        const query = searchQuery.toLowerCase();
        return requests.filter(request =>
            request.title.toLowerCase().includes(query) ||
            request.description.toLowerCase().includes(query) ||
            request.author_name.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    // Get current data based on active tab
    const currentRequests = useMemo(() => {
        const baseRequests = activeTab === 'leaderboard' ? leaderboardRequests : myRequests;
        return getFilteredRequests(baseRequests);
    }, [activeTab, leaderboardRequests, myRequests, getFilteredRequests]);

    const isLoading = activeTab === 'leaderboard' ? isLoadingAll : isLoadingMy;
    const isRefreshing = activeTab === 'leaderboard' ? isRefreshingAll : isRefreshingMy;
    const error = activeTab === 'leaderboard' ? errorAll : errorMy;

    // Handle upvote
    const handleUpvote = useCallback(async (requestId: string) => {
        if (!user || upvotingIds.has(requestId)) return;

        setUpvotingIds(prev => new Set(prev).add(requestId));

        try {
            const result = await toggleFeatureUpvote(requestId);
            handleUpvoteChange(requestId, result.upvoted);
        } catch (error) {
            console.error('Error toggling upvote:', error);
            Alert.alert(
                'Error',
                'Failed to update vote. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setUpvotingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    }, [user, upvotingIds, handleUpvoteChange]);

    // Handle refresh
    const handleRefresh = useCallback(() => {
        if (activeTab === 'leaderboard') {
            refreshAll();
        } else {
            refreshMy();
        }
    }, [activeTab, refreshAll, refreshMy]);

    // Handle load more
    const handleLoadMore = useCallback(() => {
        if (activeTab === 'leaderboard') {
            loadMoreAll();
        } else {
            loadMoreMy();
        }
    }, [activeTab, loadMoreAll, loadMoreMy]);

    // Render item
    const renderItem = useCallback(({ item, index }: { item: FeatureRequest; index: number }) => (
        <FeatureRequestCard
            request={item}
            onUpvote={handleUpvote}
            isUpvoting={upvotingIds.has(item.id)}
            showRank={activeTab === 'leaderboard' && !searchQuery}
            rank={activeTab === 'leaderboard' && !searchQuery ? index + 1 : undefined}
        />
    ), [handleUpvote, upvotingIds, activeTab, searchQuery]);

    // Render empty state
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons
                name={activeTab === 'leaderboard' ? "trophy-outline" : "folder-outline"}
                size={64}
                color="#555"
            />
            <Text style={styles.emptyStateTitle}>
                {searchQuery
                    ? 'No matching requests'
                    : activeTab === 'leaderboard'
                        ? 'No feature requests yet'
                        : 'No activity yet'
                }
            </Text>
            <Text style={styles.emptyStateSubtitle}>
                {searchQuery
                    ? 'Try adjusting your search terms'
                    : activeTab === 'leaderboard'
                        ? 'Be the first to suggest a new feature!'
                        : 'Submit your first feature request or upvote others!'
                }
            </Text>
        </View>
    );

    const renderDebugPanel = () => {
        if (!error || networkStatus) return null;

        return (
            <View style={styles.debugPanel}>
                <Text style={styles.debugTitle}>🔧 Debug Information</Text>
                <Text style={styles.debugText}>Backend URL: {BACKEND_URL}</Text>
                <Text style={styles.debugText}>Network Status: {networkStatus ? 'Online' : 'Offline'}</Text>
                <Text style={styles.debugText}>Error: {error}</Text>
                <TouchableOpacity
                    style={styles.debugButton}
                    onPress={() => {
                        // Test backend health
                        fetch(`${BACKEND_URL}/health/routes`)
                            .then(res => res.json())
                            .then(data => {
                                Alert.alert('Backend Status', `Routes available: ${data.total_routes}\nFeature requests: ${data.feature_requests_available ? 'Available' : 'Not Found'}`);
                            })
                            .catch(err => {
                                Alert.alert('Backend Error', `Cannot connect to backend: ${err.message}`);
                            });
                    }}
                >
                    <Text style={styles.debugButtonText}>Test Backend</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Render header
    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Search bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={24} color="#888" />
                <TextInput
                    style={styles.searchInput}
                    placeholder={`Search ${activeTab === 'leaderboard' ? 'leaderboard' : 'your activity'}...`}
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-outline" size={24} color="#888" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Tab navigation */}
            <View style={styles.tabContainer}>
                <TabButton
                    title="Leaderboard"
                    isActive={activeTab === 'leaderboard'}
                    onPress={() => setActiveTab('leaderboard')}
                    count={leaderboardRequests.length}
                />
                <TabButton
                    title="My Activity"
                    isActive={activeTab === 'my-activity'}
                    onPress={() => setActiveTab('my-activity')}
                    count={myRequests.length}
                />
            </View>

            {/* Connection status */}
            {!networkStatus && (
                <View style={styles.offlineIndicator}>
                    <Ionicons name="cloud-offline-outline" size={16} color="#FF9500" />
                    <Text style={styles.offlineText}>Offline - showing cached data</Text>
                </View>
            )}

            {/* Leaderboard header */}
            {activeTab === 'leaderboard' && !searchQuery && leaderboardRequests.length > 0 && (
                <View style={styles.leaderboardHeader}>
                    <Ionicons name="trophy" size={24} color="#FFD700" />
                    <Text style={styles.leaderboardTitle}>Feature Request Leaderboard</Text>
                    <Text style={styles.leaderboardSubtitle}>Most upvoted requests by the community</Text>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Feature Requests</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Error state */}
            {error && !isLoading && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Content */}
            <FlatList
                data={currentRequests}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={!isLoading ? renderEmptyState : null}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#9B00FF"
                        colors={["#9B00FF"]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.listContainer,
                    currentRequests.length === 0 && !isLoading && styles.emptyListContainer
                ]}
                ListFooterComponent={
                    isLoading && currentRequests.length > 0 ? (
                        <View style={styles.loadingMore}>
                            <ActivityIndicator size="small" color="#9B00FF" />
                        </View>
                    ) : null
                }
            />

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreateFeatureRequest')}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#9B00FF', '#7B2CBF']}
                    style={styles.fabGradient}
                >
                    <Ionicons name="add" size={32} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Loading overlay for initial load */}
            {isLoading && currentRequests.length === 0 && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#9B00FF" />
                    <Text style={styles.loadingText}>
                        Loading {activeTab === 'leaderboard' ? 'leaderboard' : 'your activity'}...
                    </Text>
                </View>
            )}

            {renderDebugPanel()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    headerRight: {
        width: 38, // Same width as back button to center title
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        marginLeft: 12,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        position: 'relative',
    },
    tabButtonActive: {
        backgroundColor: '#9B00FF',
    },
    tabButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    tabButtonTextActive: {
        color: '#FFF',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#9B00FF',
        borderRadius: 1,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF950020',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 16,
    },
    offlineText: {
        color: '#FF9500',
        fontSize: 12,
        marginLeft: 8,
    },
    leaderboardHeader: {
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 8,
    },
    leaderboardTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
    },
    leaderboardSubtitle: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
    },
    emptyListContainer: {
        flex: 1,
    },
    cardContainer: {
        marginBottom: 16,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
        position: 'relative',
    },
    rankBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    rankText: {
        fontSize: 12,
        fontWeight: '700',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginRight: 40, // Space for rank badge
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
    dateText: {
        color: '#888',
        fontSize: 12,
    },
    cardTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
        lineHeight: 24,
    },
    cardDescription: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    authorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    authorText: {
        color: '#888',
        fontSize: 12,
        marginLeft: 6,
    },
    voteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#9B00FF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        minWidth: 70,
        justifyContent: 'center',
    },
    voteButtonActive: {
        backgroundColor: '#9B00FF',
        borderColor: '#9B00FF',
    },
    voteButtonDisabled: {
        opacity: 0.6,
    },
    voteCount: {
        color: '#9B00FF',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 6,
    },
    voteCountActive: {
        color: '#FFF',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 64,
    },
    emptyStateTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateSubtitle: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    errorContainer: {
        backgroundColor: '#FF3B3020',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FF3B30',
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 14,
        marginBottom: 8,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        alignSelf: 'center',
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFF',
        fontSize: 16,
        marginTop: 16,
    },
    loadingMore: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        elevation: 8,
        shadowColor: '#9B00FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    fabGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    debugPanel: {
        backgroundColor: '#1E1E1E',
        padding: 16,
        borderRadius: 8,
        margin: 16,
    },
    debugTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    debugText: {
        color: '#888',
        fontSize: 14,
        marginBottom: 8,
    },
    debugButton: {
        backgroundColor: '#9B00FF',
        padding: 12,
        borderRadius: 8,
        alignSelf: 'flex-end',
    },
    debugButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default FeatureRequestsScreen; 