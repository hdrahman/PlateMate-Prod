/**
 * Simple EventBus for direct step count updates
 * Replaces complex listener pattern with direct subscription
 * "Decomplicated" approach that mirrors notification system
 */

type StepUpdateCallback = (steps: number) => void;

class StepEventBus {
    private static instance: StepEventBus;
    private subscribers: Set<StepUpdateCallback> = new Set();

    private constructor() {
        console.log('🚌 StepEventBus initialized - direct subscription pattern');
    }

    public static getInstance(): StepEventBus {
        if (!StepEventBus.instance) {
            StepEventBus.instance = new StepEventBus();
        }
        return StepEventBus.instance;
    }

    /**
     * Subscribe to step updates - immediate, no complex initialization
     */
    public subscribe(callback: StepUpdateCallback): () => void {
        this.subscribers.add(callback);
        console.log(`✅ Direct subscriber added (total: ${this.subscribers.size})`);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
            console.log(`🗑️ Direct subscriber removed (total: ${this.subscribers.size})`);
        };
    }

    /**
     * Notify all subscribers directly - no complex logic
     */
    public notifyStepUpdate(steps: number): void {
        if (typeof steps !== 'number' || isNaN(steps)) {
            console.error('❌ Invalid step count for direct notification:', steps);
            return;
        }

        console.log(`📢 Direct step notification: ${steps} steps to ${this.subscribers.size} subscribers`);
        
        this.subscribers.forEach(callback => {
            try {
                callback(steps);
            } catch (error) {
                console.error('❌ Error in direct subscriber callback:', error);
                // Remove faulty subscriber
                this.subscribers.delete(callback);
            }
        });
    }

    /**
     * Get current subscriber count for debugging
     */
    public getSubscriberCount(): number {
        return this.subscribers.size;
    }

    /**
     * Clear all subscribers (for cleanup)
     */
    public clear(): void {
        this.subscribers.clear();
        console.log('🧹 All direct subscribers cleared');
    }
}

export default StepEventBus.getInstance();