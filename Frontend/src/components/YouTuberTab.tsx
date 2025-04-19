import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { YouTuber, YouTubeVideo, getChannelVideos } from '../api/youtube';
import YouTubeVideoCard from './YouTubeVideoCard';

interface YouTuberTabProps {
    youtuber: YouTuber;
}

const YouTuberTab: React.FC<YouTuberTabProps> = ({ youtuber }) => {
    const [videos, setVideos] = useState<YouTubeVideo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                setLoading(true);
                const fetchedVideos = await getChannelVideos(youtuber.channelId);
                setVideos(fetchedVideos);
                setError(null);
            } catch (err) {
                console.error(`Error fetching videos for ${youtuber.name}:`, err);
                setError(`Couldn't load videos for ${youtuber.name}. Please try again later.`);
            } finally {
                setLoading(false);
            }
        };

        fetchVideos();
    }, [youtuber.channelId]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={styles.youtuberName}>{youtuber.name}</Text>
                    {youtuber.subcategory && (
                        <View style={styles.subcategoryBadge}>
                            <Text style={styles.subcategoryText}>{youtuber.subcategory}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.youtuberDescription}>{youtuber.description}</Text>
            </View>

            <View style={styles.contentContainer}>
                {loading ? (
                    <ActivityIndicator size="large" color="#FF9500" style={styles.loader} />
                ) : error ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : videos.length === 0 ? (
                    <Text style={styles.emptyText}>No videos available</Text>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.videosContainer}
                    >
                        {videos.map((video) => (
                            <YouTubeVideoCard key={video.id} video={video} />
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 10,
    },
    header: {
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 5,
    },
    youtuberName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginRight: 10,
    },
    youtuberDescription: {
        fontSize: 14,
        color: '#BBBBBB',
        marginBottom: 5,
    },
    contentContainer: {
        minHeight: 180,
    },
    subcategoryBadge: {
        backgroundColor: '#333333',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 5,
    },
    subcategoryText: {
        color: '#FF9500',
        fontSize: 12,
        fontWeight: '600',
    },
    videosContainer: {
        paddingRight: 10,
    },
    loader: {
        marginTop: 20,
    },
    errorText: {
        color: '#FF5E3A',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    },
    emptyText: {
        color: '#BBBBBB',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    },
});

export default YouTuberTab; 