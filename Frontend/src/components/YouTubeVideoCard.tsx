import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { YouTubeVideo } from '../api/youtube';

interface YouTubeVideoCardProps {
    video: YouTubeVideo;
}

const { width } = Dimensions.get('window');
const VIDEO_CARD_WIDTH = width * 0.75;  // Slightly narrower for better fit

const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({ video }) => {
    if (!video || !video.id) {
        return null; // Don't render invalid videos
    }

    const openYouTubeVideo = () => {
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
        Linking.openURL(youtubeUrl).catch(err =>
            console.error('Error opening YouTube video:', err)
        );
    };

    // Function to format the published date
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Unknown date';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Unknown date';
        }
    };

    // Function to truncate text if it's too long
    const truncateText = (text: string, maxLength: number) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    };

    return (
        <TouchableOpacity style={styles.container} onPress={openYouTubeVideo} activeOpacity={0.8}>
            <Image
                source={{ uri: video.thumbnailUrl || 'https://via.placeholder.com/480x360?text=No+Thumbnail' }}
                style={styles.thumbnail}
                resizeMode="cover"
                defaultSource={{ uri: 'https://via.placeholder.com/480x360?text=Loading...' }}
            />
            <View style={styles.infoContainer}>
                <Text style={styles.title}>{truncateText(video.title || 'Untitled Video', 40)}</Text>
                <Text style={styles.channelTitle}>{video.channelTitle || 'Unknown Channel'}</Text>
                <Text style={styles.publishedDate}>Published: {formatDate(video.publishedAt)}</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: VIDEO_CARD_WIDTH,
        backgroundColor: '#222222',
        borderRadius: 10,
        marginRight: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    thumbnail: {
        width: '100%',
        height: 180,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    infoContainer: {
        padding: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 6,
    },
    channelTitle: {
        fontSize: 14,
        color: '#BBBBBB',
        marginBottom: 4,
    },
    publishedDate: {
        fontSize: 12,
        color: '#888888',
    },
});

export default YouTubeVideoCard; 