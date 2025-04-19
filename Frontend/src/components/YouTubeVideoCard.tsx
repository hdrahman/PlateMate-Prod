import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { YouTubeVideo } from '../api/youtube';

interface YouTubeVideoCardProps {
    video: YouTubeVideo;
}

const { width } = Dimensions.get('window');
const VIDEO_CARD_WIDTH = width * 0.75;  // Slightly narrower for better fit

const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({ video }) => {
    const openYouTubeVideo = () => {
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
        Linking.openURL(youtubeUrl);
    };

    // Function to format the published date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    // Function to truncate text if it's too long
    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    };

    return (
        <TouchableOpacity style={styles.container} onPress={openYouTubeVideo} activeOpacity={0.8}>
            <Image
                source={{ uri: video.thumbnailUrl }}
                style={styles.thumbnail}
                resizeMode="cover"
            />
            <View style={styles.infoContainer}>
                <Text style={styles.title}>{truncateText(video.title, 40)}</Text>
                <Text style={styles.channelTitle}>{video.channelTitle}</Text>
                <Text style={styles.publishedDate}>Published: {formatDate(video.publishedAt)}</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: VIDEO_CARD_WIDTH,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        marginRight: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    thumbnail: {
        width: '100%',
        height: 150,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    infoContainer: {
        padding: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
        marginBottom: 6,
    },
    channelTitle: {
        fontSize: 12,
        color: '#BBBBBB',
        marginBottom: 4,
    },
    publishedDate: {
        fontSize: 11,
        color: '#888888',
    },
});

export default YouTubeVideoCard; 