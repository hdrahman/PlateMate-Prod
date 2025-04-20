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

// List of invalid channels from our verification
const invalidChannels = [
    { id: '6', name: 'Will Tennyson' },
    { id: '8', name: 'Koboko Fitness' },
    { id: '11', name: 'Abbey Sharp' },
    { id: '14', name: 'Greg Doucette' },
    { id: '15', name: 'Simnett Nutrition' },
    { id: '19', name: 'Remi Cruz' },
    { id: '20', name: 'The Whole Happy Life' },
    { id: '21', name: 'José Zuniga' },
    { id: '22', name: 'Alex Costa' },
    { id: '23', name: 'Real Men Real Style' },
    { id: '24', name: 'He Spoke Style' },
    { id: '25', name: 'BluMaan' },
    { id: '26', name: 'TheGentlemansCove' },
    { id: '28', name: 'TMF Style' },
    { id: '30', name: 'ScentedGent' },
    { id: '35', name: 'Rowena Tsai' },
    { id: '37', name: 'Lavendaire' },
    { id: '38', name: 'Kharma Medic' },
    { id: '40', name: 'Project Better Self' },
    { id: '42', name: 'Dr. Jen Fraboni' },
    { id: '43', name: 'Caroline Jordan' },
    { id: '44', name: 'Breathe and Flow' },
    { id: '47', name: 'The Sleep Doctor' },
    { id: '48', name: 'Huberman Lab' },
    { id: '49', name: 'Psych Hub' }
];

// Function to search for a channel by name
async function searchChannel(name) {
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: name,
            type: 'channel',
            maxResults: 3  // Get up to 3 results to choose from
        });

        if (response.data.items && response.data.items.length > 0) {
            // Return all found channels so we can choose the best match
            return response.data.items.map(item => ({
                channelId: item.snippet.channelId,
                title: item.snippet.title,
                description: item.snippet.description
            }));
        } else {
            console.log(`No channels found for "${name}"`);
            return [];
        }
    } catch (error) {
        console.error(`Error searching for channel "${name}":`, error.message);
        return [];
    }
}

// Search for corrected channel IDs
async function findCorrectChannelIds() {
    const results = {};

    for (let i = 0; i < invalidChannels.length; i++) {
        const channel = invalidChannels[i];
        console.log(`Searching for channel "${channel.name}" (${channel.id})...`);

        const foundChannels = await searchChannel(channel.name);

        if (foundChannels.length > 0) {
            // Show all options with confidence measure (similar name = higher confidence)
            foundChannels.forEach((found, idx) => {
                const similarity = calculateSimilarity(channel.name.toLowerCase(), found.title.toLowerCase());
                console.log(`  [${idx}] "${found.title}" (${found.channelId}) - Similarity: ${(similarity * 100).toFixed(1)}%`);
            });

            // Choose the one with the highest name similarity
            const bestMatch = foundChannels.reduce((best, current) => {
                const currentSimilarity = calculateSimilarity(channel.name.toLowerCase(), current.title.toLowerCase());
                const bestSimilarity = best ? calculateSimilarity(channel.name.toLowerCase(), best.title.toLowerCase()) : 0;
                return currentSimilarity > bestSimilarity ? current : best;
            }, null);

            if (bestMatch) {
                results[channel.id] = {
                    originalName: channel.name,
                    bestMatch: {
                        title: bestMatch.title,
                        channelId: bestMatch.channelId,
                        similarity: calculateSimilarity(channel.name.toLowerCase(), bestMatch.title.toLowerCase())
                    }
                };

                console.log(`  Best match: "${bestMatch.title}" (${bestMatch.channelId})\n`);
            } else {
                results[channel.id] = { originalName: channel.name, bestMatch: null };
                console.log(`  No suitable match found\n`);
            }
        } else {
            results[channel.id] = { originalName: channel.name, bestMatch: null };
            console.log(`  No matches found\n`);
        }

        // Add a delay to avoid rate limiting
        if (i < invalidChannels.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    return results;
}

// Simple similarity measure for strings (0-1 where 1 is identical)
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    // Check for exact includes
    if (longer.includes(shorter)) return 0.9;
    if (shorter.includes(longer)) return 0.9;

    // Check for partial matches
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);

    let matchCount = 0;
    for (const word1 of words1) {
        if (word1.length < 3) continue; // Skip very short words
        for (const word2 of words2) {
            if (word2.length < 3) continue;
            if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
                matchCount++;
                break;
            }
        }
    }

    return Math.min(0.8, matchCount / Math.max(words1.length, words2.length));
}

// Update the youtubers.ts file with corrected channel IDs
function updateYouTubersFile(updates) {
    const filePath = path.resolve(__dirname, 'src/data/youtubers.ts');
    let fileContent = fs.readFileSync(filePath, 'utf8');

    // Count how many updates we'll make
    const validUpdates = Object.values(updates)
        .filter(update => update.bestMatch && update.bestMatch.similarity > 0.2);

    console.log(`\nApplying ${validUpdates.length} updates to youtubers.ts file...`);

    // Apply each update
    Object.entries(updates).forEach(([id, data]) => {
        if (data.bestMatch && data.bestMatch.similarity > 0.2) {
            const regex = new RegExp(`id:\\s*['"]${id}['"][^}]+channelId:\\s*['"][^'"]+['"]`, 'g');
            const replacement = `id: '${id}'` +
                fileContent.match(regex)[0].substring(fileContent.match(regex)[0].indexOf(','), fileContent.match(regex)[0].lastIndexOf('channelId:')) +
                `channelId: '${data.bestMatch.channelId}'`;

            fileContent = fileContent.replace(regex, replacement);
            console.log(`  Updated ${data.originalName} (${id}) to use channel ID: ${data.bestMatch.channelId}`);
        }
    });

    // Write the updated file
    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`\nSaved updated youtubers.ts file!`);
}

// Main function
async function main() {
    console.log('Starting channel ID correction process...');

    const updates = await findCorrectChannelIds();
    updateYouTubersFile(updates);

    console.log('\nProcess complete!');
}

main().catch(err => {
    console.error('Error in main execution:', err);
}); 