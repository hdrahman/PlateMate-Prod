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
                <Text style={styles.youtuberName}>{youtuber.name}</Text>
                <Text style={styles.youtuberDescription}>{youtuber.description}</Text>
                {youtuber.subcategory && (
                    <View style={styles.subcategoryBadge}>
                        <Text style={styles.subcategoryText}>{youtuber.subcategory}</Text>
                    </View>
                )}
            </View>

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
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15,
    },
    header: {
        marginBottom: 15,
    },
    youtuberName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    youtuberDescription: {
        fontSize: 16,
        color: '#BBBBBB',
        marginBottom: 10,
    },
    subcategoryBadge: {
        backgroundColor: '#333333',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    subcategoryText: {
        color: '#FF9500',
        fontSize: 12,
        fontWeight: '600',
    },
    videosContainer: {
        paddingRight: 15,
    },
    loader: {
        marginTop: 30,
    },
    errorText: {
        color: '#FF5E3A',
        textAlign: 'center',
        marginTop: 30,
        fontSize: 16,
    },
    emptyText: {
        color: '#BBBBBB',
        textAlign: 'center',
        marginTop: 30,
        fontSize: 16,
    },
});

export default YouTuberTab; 