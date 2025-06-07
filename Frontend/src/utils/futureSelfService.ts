import { getUserProfileByFirebaseUid } from './database';

export interface FutureSelfMessage {
    message: string;
    type: string;
    createdAt: string;
}

export const getFutureSelfMessage = async (firebaseUid: string): Promise<FutureSelfMessage | null> => {
    try {
        const profile = await getUserProfileByFirebaseUid(firebaseUid);

        if (profile?.future_self_message) {
            return {
                message: profile.future_self_message,
                type: profile.future_self_message_type || 'custom',
                createdAt: profile.future_self_message_created_at || new Date().toISOString(),
            };
        }

        return null;
    } catch (error) {
        console.error('Error getting future self message:', error);
        return null;
    }
};

export const hasFutureSelfMessage = async (firebaseUid: string): Promise<boolean> => {
    try {
        const profile = await getUserProfileByFirebaseUid(firebaseUid);
        return !!(profile?.future_self_message);
    } catch (error) {
        console.error('Error checking future self message:', error);
        return false;
    }
};

// Helper function to get motivational quotes based on message type
export const getMotivationalQuotesByType = (type: string): string[] => {
    const quotes = {
        tough_times: [
            "Remember why you started this journey.",
            "Every small step counts, even when it feels hard.",
            "You are stronger than you think.",
            "Progress, not perfection, is the goal.",
        ],
        temptation: [
            "You deserve to feel amazing every day.",
            "Choose what's right for your future self.",
            "Remember how good you feel when you stick to your goals.",
            "You've worked too hard to give up now.",
        ],
        progress: [
            "Look how far you've come!",
            "Every healthy choice led to this moment.",
            "Be proud of your dedication.",
            "You're building something incredible.",
        ],
        motivation: [
            "You are capable of incredible things.",
            "Your health journey is about proving to yourself what you can achieve.",
            "Every day is a new opportunity to take care of yourself.",
            "You're not just changing your body, you're changing your life.",
        ],
        custom: [
            "You've got this!",
            "Stay strong and keep going.",
            "Remember your why.",
            "You're worth every effort you put in.",
        ],
    };

    return quotes[type as keyof typeof quotes] || quotes.custom;
}; 