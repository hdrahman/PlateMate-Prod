/**
 * YouTube API functionality has been disabled for this release.
 * This service is not currently available.
 */

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

// Function to get channel details - DISABLED
export const getChannelDetails = async (channelId: string) => {
    console.warn('⚠️ YouTube API is disabled in this release');
    throw new Error('YouTube functionality is not available in this release');
};

// Function to get channel videos - DISABLED
export const getChannelVideos = async (channelId: string, maxResults = 5) => {
    console.warn('⚠️ YouTube API is disabled in this release');
    return [];
};

// Function to search for a channel by name - DISABLED
export const searchChannel = async (channelName: string) => {
    console.warn('⚠️ YouTube API is disabled in this release');
    return null;
}; 