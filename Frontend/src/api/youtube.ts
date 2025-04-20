import axios from 'axios';
import { YOUTUBE_API_KEY } from '@env';

// You need to add your YouTube API key in your .env file
// YOUTUBE_API_KEY=your_api_key_here
const API_KEY = YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

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

        if (response.data?.items?.length > 0) {
            return response.data.items[0];
        }
        throw new Error("Channel not found");
    } catch (error) {
        console.error('Error fetching channel details:', error);
        throw error;
    }
};

// Function to get channel videos
export const getChannelVideos = async (channelId: string, maxResults = 5) => {
    if (!channelId) {
        console.error('Invalid channel ID provided');
        return [];
    }

    if (!API_KEY) {
        console.error('No YouTube API key provided in environment variables');
        return [];
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

        // Check if channel data exists and has the expected structure
        if (!channelResponse.data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads) {
            console.error('Channel data is missing uploads playlist ID');
            return [];
        }

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

        // Check if video data exists and has the expected structure
        if (!videosResponse.data?.items) {
            console.error('No videos found in playlist');
            return [];
        }

        // Map the video data to our interface format with proper null/undefined checks
        return videosResponse.data.items.map((item: any) => {
            // Ensure all properties exist before accessing them
            if (!item?.snippet || !item?.contentDetails?.videoId) {
                return null;
            }

            // Get the best available thumbnail or fallback to a placeholder
            let thumbnailUrl = 'https://via.placeholder.com/480x360?text=No+Thumbnail';
            if (item.snippet.thumbnails) {
                if (item.snippet.thumbnails.high?.url) {
                    thumbnailUrl = item.snippet.thumbnails.high.url;
                } else if (item.snippet.thumbnails.medium?.url) {
                    thumbnailUrl = item.snippet.thumbnails.medium.url;
                } else if (item.snippet.thumbnails.default?.url) {
                    thumbnailUrl = item.snippet.thumbnails.default.url;
                }
            }

            return {
                id: item.contentDetails.videoId,
                title: item.snippet.title || 'Untitled Video',
                thumbnailUrl,
                channelTitle: item.snippet.channelTitle || 'Unknown Channel',
                publishedAt: item.snippet.publishedAt || new Date().toISOString(),
                description: item.snippet.description || 'No description available',
            };
        }).filter(Boolean); // Remove any null items
    } catch (error) {
        console.error('Error fetching channel videos:', error);
        return [];
    }
};

// Function to search for a channel by name
export const searchChannel = async (channelName: string) => {
    if (!channelName || !API_KEY) {
        return null;
    }

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

        if (response.data?.items?.length > 0 && response.data.items[0]?.snippet?.channelId) {
            return response.data.items[0].snippet.channelId;
        }
        return null;
    } catch (error) {
        console.error('Error searching for channel:', error);
        return null;
    }
}; 