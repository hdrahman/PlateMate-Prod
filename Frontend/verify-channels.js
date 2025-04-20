const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// YouTube API setup
const apiKey = process.env.YOUTUBE_API_KEY;
const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});

// Read the youtubers.ts file
const youTubersFilePath = path.resolve(__dirname, 'src/data/youtubers.ts');
const fileContents = fs.readFileSync(youTubersFilePath, 'utf8');

// Regular expression to extract channel data
const channelRegex = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*channelId:\s*['"]([^'"]+)['"],/g;

const channels = [];
let match;
while ((match = channelRegex.exec(fileContents)) !== null) {
    channels.push({
        id: match[1],
        name: match[2],
        channelId: match[3]
    });
}

console.log(`Found ${channels.length} channels in the file`);

// Function to verify a channel ID
async function verifyChannelId(channel) {
    try {
        const response = await youtube.channels.list({
            part: 'snippet',
            id: channel.channelId
        });

        if (response.data.items && response.data.items.length > 0) {
            const actualTitle = response.data.items[0].snippet.title;
            console.log(`✅ ${channel.name} (${channel.id}): Channel ID works - Title: ${actualTitle}`);
            return {
                ...channel,
                status: 'valid',
                actualTitle
            };
        } else {
            console.log(`❌ ${channel.name} (${channel.id}): Invalid channel ID`);
            return {
                ...channel,
                status: 'invalid',
                actualTitle: null
            };
        }
    } catch (error) {
        console.error(`❌ ${channel.name} (${channel.id}): Error checking channel ID:`, error.message);
        return {
            ...channel,
            status: 'error',
            error: error.message
        };
    }
}

async function main() {
    console.log('Verifying channel IDs...');

    const results = [];
    // Process channels in batches to avoid rate limiting
    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const result = await verifyChannelId(channel);
        results.push(result);

        // Add a small delay between requests
        if (i < channels.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Report results
    const invalidChannels = results.filter(r => r.status !== 'valid');

    console.log('\n===== SUMMARY =====');
    console.log(`Total channels: ${channels.length}`);
    console.log(`Valid channels: ${results.filter(r => r.status === 'valid').length}`);
    console.log(`Invalid/error channels: ${invalidChannels.length}`);

    if (invalidChannels.length > 0) {
        console.log('\n===== INVALID CHANNELS =====');
        invalidChannels.forEach(channel => {
            console.log(`${channel.name} (${channel.id}): Status: ${channel.status}`);
        });
    }
}

main().catch(err => {
    console.error('Error in main execution:', err);
}); 