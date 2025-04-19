import axios from 'axios';
import { YOUTUBE_API_KEY } from '@env';

// You need to add your YouTube API key in your .env file
// YOUTUBE_API_KEY=your_api_key_here
const API_KEY = YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Add mock data for development
const MOCK_VIDEOS = [
    {
        id: 'video1',
        title: 'How to Build Muscle - The TRUTH About Muscle Building',
        thumbnailUrl: 'https://i.ytimg.com/vi/uuMck3jOWWQ/hqdefault.jpg',
        channelTitle: 'Example Channel',
        publishedAt: new Date().toISOString(),
        description: 'Learn the fundamentals of muscle building in this comprehensive guide.',
    },
    {
        id: 'video2',
        title: '10-Minute Home Workout That Actually Works',
        thumbnailUrl: 'https://i.ytimg.com/vi/CBWQGb4LyAM/hqdefault.jpg',
        channelTitle: 'Example Channel',
        publishedAt: new Date().toISOString(),
        description: 'A quick workout you can do at home with no equipment.',
    },
    {
        id: 'video3',
        title: 'What I Eat in a Day for Optimal Health',
        thumbnailUrl: 'https://i.ytimg.com/vi/qH__o17xHls/hqdefault.jpg',
        channelTitle: 'Example Channel',
        publishedAt: new Date().toISOString(),
        description: 'A full day of healthy, balanced eating explained.',
    }
];

export interface YouTuber {
    id: string;
    name: string;
    channelId: string;
    description: string;
    category: string;
    subcategory?: string;
}

export interface YouTubeVideo {
    id: string;
    title: string;
    thumbnailUrl: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
}

// Function to get channel details
export const getChannelDetails = async (channelId: string) => {
    try {
        const response = await axios.get(`${BASE_URL}/channels`, {
            params: {
                part: 'snippet,statistics',
                id: channelId,
                key: API_KEY,
            },
        });

        return response.data.items[0];
    } catch (error) {
        console.error('Error fetching channel details:', error);
        throw error;
    }
};

// Function to get channel videos
export const getChannelVideos = async (channelId: string, maxResults = 5) => {
    // Return mock data if no API key is provided
    if (!API_KEY || API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        console.log('Using mock video data - please set a valid YouTube API key in .env');
        return MOCK_VIDEOS;
    }

    try {
        // First get the uploads playlist ID
        const channelResponse = await axios.get(`${BASE_URL}/channels`, {
            params: {
                part: 'contentDetails',
                id: channelId,
                key: API_KEY,
            },
        });

        const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

        // Then get the videos from that playlist
        const videosResponse = await axios.get(`${BASE_URL}/playlistItems`, {
            params: {
                part: 'snippet,contentDetails',
                playlistId: uploadsPlaylistId,
                maxResults: maxResults,
                key: API_KEY,
            },
        });

        return videosResponse.data.items.map((item: any) => ({
            id: item.contentDetails.videoId,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            description: item.snippet.description,
        }));
    } catch (error) {
        console.error('Error fetching channel videos:', error);
        // Fall back to mock data if there's an error
        console.log('Falling back to mock video data due to API error');
        return MOCK_VIDEOS;
    }
};

// Function to search for a channel by name
export const searchChannel = async (channelName: string) => {
    try {
        const response = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: channelName,
                type: 'channel',
                maxResults: 1,
                key: API_KEY,
            },
        });

        if (response.data.items.length > 0) {
            return response.data.items[0].snippet.channelId;
        }
        return null;
    } catch (error) {
        console.error('Error searching for channel:', error);
        throw error;
    }
}; 