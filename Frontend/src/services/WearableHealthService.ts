/**
 * WearableHealthService - Unified cross-platform service for wearable health data
 * 
 * Supports:
 * - iOS: Apple HealthKit (Apple Watch, iPhone sensors)
 * - Android: Health Connect (Wear OS, Samsung Galaxy Watch, Fitbit, etc.)
 * 
 * Data types collected:
 * - Steps, Heart Rate, Active Calories, Workouts, Sleep, Distance
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const WEARABLE_SETTINGS_KEY = 'WEARABLE_HEALTH_SETTINGS';
const WEARABLE_LAST_SYNC_KEY = 'WEARABLE_LAST_SYNC';
const WEARABLE_CONNECTION_KEY = 'WEARABLE_CONNECTION_STATUS';

// Types for health data
export interface HealthDataPoint {
    type: 'steps' | 'heart_rate' | 'active_calories' | 'distance' | 'sleep' | 'workout';
    value: number;
    unit: string;
    startDate: Date;
    endDate: Date;
    source: string;
    metadata?: Record<string, any>;
}

export interface WorkoutData {
    type: string;
    startDate: Date;
    endDate: Date;
    duration: number; // minutes
    calories: number;
    distance?: number;
    source: string;
}

export interface SleepData {
    startDate: Date;
    endDate: Date;
    duration: number; // hours
    stages?: {
        awake: number;
        light: number;
        deep: number;
        rem: number;
    };
    source: string;
}

export interface WearableSettings {
    enabled: boolean;
    syncSteps: boolean;
    syncHeartRate: boolean;
    syncCalories: boolean;
    syncWorkouts: boolean;
    syncSleep: boolean;
    syncDistance: boolean;
    autoSync: boolean;
    syncIntervalMinutes: number;
    preferWearableOverPhone: boolean;
}

export interface ConnectionStatus {
    isConnected: boolean;
    platform: 'apple_health' | 'health_connect' | null;
    lastSyncTime: Date | null;
    permissionsGranted: string[];
    availableDataTypes: string[];
}

// Default settings
const DEFAULT_SETTINGS: WearableSettings = {
    enabled: false,
    syncSteps: true,
    syncHeartRate: true,
    syncCalories: true,
    syncWorkouts: true,
    syncSleep: true,
    syncDistance: true,
    autoSync: true,
    syncIntervalMinutes: 15,
    preferWearableOverPhone: true,
};

// Lazy load platform-specific modules
let AppleHealthKit: any = null;
let HealthConnect: any = null;

class WearableHealthService {
    private static instance: WearableHealthService;
    private settings: WearableSettings = DEFAULT_SETTINGS;
    private connectionStatus: ConnectionStatus = {
        isConnected: false,
        platform: null,
        lastSyncTime: null,
        permissionsGranted: [],
        availableDataTypes: [],
    };
    private isInitialized = false;
    private listeners: Set<(status: ConnectionStatus) => void> = new Set();

    private constructor() {}

    public static getInstance(): WearableHealthService {
        if (!WearableHealthService.instance) {
            WearableHealthService.instance = new WearableHealthService();
        }
        return WearableHealthService.instance;
    }

    /**
     * Initialize the service and load platform-specific modules
     */
    public async initialize(): Promise<boolean> {
        if (this.isInitialized) return true;

        try {
            console.log('🏥 WearableHealthService: Initializing...');

            // Load saved settings
            await this.loadSettings();
            await this.loadConnectionStatus();

            // Load platform-specific module
            if (Platform.OS === 'ios') {
                await this.initializeAppleHealth();
            } else if (Platform.OS === 'android') {
                await this.initializeHealthConnect();
            }

            this.isInitialized = true;
            console.log('✅ WearableHealthService: Initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ WearableHealthService: Initialization failed:', error);
            return false;
        }
    }

    /**
     * Initialize Apple HealthKit for iOS
     */
    private async initializeAppleHealth(): Promise<void> {
        try {
            // Dynamically import to avoid errors on Android
            const healthKitModule = require('react-native-health');
            AppleHealthKit = healthKitModule.default || healthKitModule;
            
            // Check if HealthKit is available
            const isAvailable = await new Promise<boolean>((resolve) => {
                AppleHealthKit.isAvailable((error: any, available: boolean) => {
                    resolve(!error && available);
                });
            });

            if (isAvailable) {
                this.connectionStatus.availableDataTypes = [
                    'steps', 'heart_rate', 'active_calories', 'workouts', 'sleep', 'distance'
                ];
                console.log('✅ Apple HealthKit is available');
            } else {
                console.warn('⚠️ Apple HealthKit is not available on this device');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load Apple HealthKit module:', error);
        }
    }

    /**
     * Initialize Health Connect for Android
     */
    private async initializeHealthConnect(): Promise<void> {
        try {
            // Dynamically import to avoid errors on iOS
            HealthConnect = require('react-native-health-connect');
            
            // Check SDK availability
            const sdkStatus = await HealthConnect.getSdkStatus();
            
            if (sdkStatus === HealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
                await HealthConnect.initialize();
                this.connectionStatus.availableDataTypes = [
                    'steps', 'heart_rate', 'active_calories', 'workouts', 'sleep', 'distance'
                ];
                console.log('✅ Health Connect is available and initialized');
            } else if (sdkStatus === HealthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
                console.warn('⚠️ Health Connect requires update');
            } else {
                console.warn('⚠️ Health Connect is not available');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load Health Connect module:', error);
        }
    }

    /**
     * Request permissions for health data access
     */
    public async requestPermissions(): Promise<boolean> {
        try {
            if (Platform.OS === 'ios') {
                return await this.requestAppleHealthPermissions();
            } else if (Platform.OS === 'android') {
                return await this.requestHealthConnectPermissions();
            }
            return false;
        } catch (error) {
            console.error('❌ Error requesting permissions:', error);
            return false;
        }
    }

    private async requestAppleHealthPermissions(): Promise<boolean> {
        if (!AppleHealthKit) {
            console.warn('⚠️ AppleHealthKit not loaded');
            return false;
        }

        const permissions = {
            permissions: {
                read: [
                    AppleHealthKit.Constants?.Permissions?.Steps || 'Steps',
                    AppleHealthKit.Constants?.Permissions?.HeartRate || 'HeartRate',
                    AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned || 'ActiveEnergyBurned',
                    AppleHealthKit.Constants?.Permissions?.Workout || 'Workout',
                    AppleHealthKit.Constants?.Permissions?.SleepAnalysis || 'SleepAnalysis',
                    AppleHealthKit.Constants?.Permissions?.DistanceWalkingRunning || 'DistanceWalkingRunning',
                ],
                write: [],
            },
        };

        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(permissions, (error: any) => {
                if (error) {
                    console.error('❌ Apple HealthKit permission error:', error);
                    resolve(false);
                } else {
                    this.connectionStatus.isConnected = true;
                    this.connectionStatus.platform = 'apple_health';
                    this.connectionStatus.permissionsGranted = [
                        'steps', 'heart_rate', 'active_calories', 'workouts', 'sleep', 'distance'
                    ];
                    this.saveConnectionStatus();
                    this.notifyListeners();
                    console.log('✅ Apple HealthKit permissions granted');
                    resolve(true);
                }
            });
        });
    }

    private async requestHealthConnectPermissions(): Promise<boolean> {
        if (!HealthConnect) {
            console.warn('⚠️ HealthConnect not loaded');
            return false;
        }

        try {
            const permissions = [
                { accessType: 'read', recordType: 'Steps' },
                { accessType: 'read', recordType: 'HeartRate' },
                { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
                { accessType: 'read', recordType: 'TotalCaloriesBurned' },
                { accessType: 'read', recordType: 'ExerciseSession' },
                { accessType: 'read', recordType: 'SleepSession' },
                { accessType: 'read', recordType: 'Distance' },
            ];

            const granted = await HealthConnect.requestPermission(permissions);
            
            if (granted && granted.length > 0) {
                this.connectionStatus.isConnected = true;
                this.connectionStatus.platform = 'health_connect';
                this.connectionStatus.permissionsGranted = granted.map((p: any) => p.recordType.toLowerCase());
                this.saveConnectionStatus();
                this.notifyListeners();
                console.log('✅ Health Connect permissions granted:', granted);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Health Connect permission error:', error);
            return false;
        }
    }

    /**
     * Disconnect from health service
     */
    public async disconnect(): Promise<void> {
        this.connectionStatus.isConnected = false;
        this.connectionStatus.platform = null;
        this.connectionStatus.permissionsGranted = [];
        this.settings.enabled = false;
        
        await this.saveSettings();
        await this.saveConnectionStatus();
        this.notifyListeners();
        
        console.log('🔌 Disconnected from health service');
    }

    /**
     * Get steps for a date range
     */
    public async getSteps(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        try {
            if (Platform.OS === 'ios') {
                return await this.getAppleHealthSteps(startDate, endDate);
            } else if (Platform.OS === 'android') {
                return await this.getHealthConnectSteps(startDate, endDate);
            }
            return [];
        } catch (error) {
            console.error('❌ Error getting steps:', error);
            return [];
        }
    }

    private async getAppleHealthSteps(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        if (!AppleHealthKit || !this.connectionStatus.isConnected) return [];

        return new Promise((resolve) => {
            const options = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                includeManuallyAdded: false,
            };

            AppleHealthKit.getDailyStepCountSamples(options, (error: any, results: any[]) => {
                if (error) {
                    console.error('❌ Error fetching Apple Health steps:', error);
                    resolve([]);
                    return;
                }

                const dataPoints: HealthDataPoint[] = (results || []).map((sample) => ({
                    type: 'steps',
                    value: sample.value,
                    unit: 'count',
                    startDate: new Date(sample.startDate),
                    endDate: new Date(sample.endDate),
                    source: sample.sourceName || 'Apple Health',
                }));

                resolve(dataPoints);
            });
        });
    }

    private async getHealthConnectSteps(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        if (!HealthConnect || !this.connectionStatus.isConnected) return [];

        try {
            const result = await HealthConnect.readRecords('Steps', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });

            return (result.records || []).map((record: any) => ({
                type: 'steps',
                value: record.count,
                unit: 'count',
                startDate: new Date(record.startTime),
                endDate: new Date(record.endTime),
                source: record.metadata?.dataOrigin?.packageName || 'Health Connect',
            }));
        } catch (error) {
            console.error('❌ Error fetching Health Connect steps:', error);
            return [];
        }
    }

    /**
     * Get heart rate data for a date range
     */
    public async getHeartRate(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        try {
            if (Platform.OS === 'ios') {
                return await this.getAppleHealthHeartRate(startDate, endDate);
            } else if (Platform.OS === 'android') {
                return await this.getHealthConnectHeartRate(startDate, endDate);
            }
            return [];
        } catch (error) {
            console.error('❌ Error getting heart rate:', error);
            return [];
        }
    }

    private async getAppleHealthHeartRate(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        if (!AppleHealthKit || !this.connectionStatus.isConnected) return [];

        return new Promise((resolve) => {
            const options = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                ascending: false,
                limit: 100,
            };

            AppleHealthKit.getHeartRateSamples(options, (error: any, results: any[]) => {
                if (error) {
                    console.error('❌ Error fetching Apple Health heart rate:', error);
                    resolve([]);
                    return;
                }

                const dataPoints: HealthDataPoint[] = (results || []).map((sample) => ({
                    type: 'heart_rate',
                    value: sample.value,
                    unit: 'bpm',
                    startDate: new Date(sample.startDate),
                    endDate: new Date(sample.endDate),
                    source: sample.sourceName || 'Apple Health',
                }));

                resolve(dataPoints);
            });
        });
    }

    private async getHealthConnectHeartRate(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        if (!HealthConnect || !this.connectionStatus.isConnected) return [];

        try {
            const result = await HealthConnect.readRecords('HeartRate', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });

            const dataPoints: HealthDataPoint[] = [];
            for (const record of result.records || []) {
                for (const sample of record.samples || []) {
                    dataPoints.push({
                        type: 'heart_rate',
                        value: sample.beatsPerMinute,
                        unit: 'bpm',
                        startDate: new Date(sample.time),
                        endDate: new Date(sample.time),
                        source: record.metadata?.dataOrigin?.packageName || 'Health Connect',
                    });
                }
            }

            return dataPoints;
        } catch (error) {
            console.error('❌ Error fetching Health Connect heart rate:', error);
            return [];
        }
    }

    /**
     * Get active calories for a date range
     */
    public async getActiveCalories(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        try {
            if (Platform.OS === 'ios') {
                return await this.getAppleHealthActiveCalories(startDate, endDate);
            } else if (Platform.OS === 'android') {
                return await this.getHealthConnectActiveCalories(startDate, endDate);
            }
            return [];
        } catch (error) {
            console.error('❌ Error getting active calories:', error);
            return [];
        }
    }

    private async getAppleHealthActiveCalories(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        if (!AppleHealthKit || !this.connectionStatus.isConnected) return [];

        return new Promise((resolve) => {
            const options = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            };

            AppleHealthKit.getActiveEnergyBurned(options, (error: any, results: any[]) => {
                if (error) {
                    console.error('❌ Error fetching Apple Health active calories:', error);
                    resolve([]);
                    return;
                }

                const dataPoints: HealthDataPoint[] = (results || []).map((sample) => ({
                    type: 'active_calories',
                    value: sample.value,
                    unit: 'kcal',
                    startDate: new Date(sample.startDate),
                    endDate: new Date(sample.endDate),
                    source: sample.sourceName || 'Apple Health',
                }));

                resolve(dataPoints);
            });
        });
    }

    private async getHealthConnectActiveCalories(startDate: Date, endDate: Date): Promise<HealthDataPoint[]> {
        if (!HealthConnect || !this.connectionStatus.isConnected) return [];

        try {
            const result = await HealthConnect.readRecords('ActiveCaloriesBurned', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });

            return (result.records || []).map((record: any) => ({
                type: 'active_calories',
                value: record.energy?.inKilocalories || 0,
                unit: 'kcal',
                startDate: new Date(record.startTime),
                endDate: new Date(record.endTime),
                source: record.metadata?.dataOrigin?.packageName || 'Health Connect',
            }));
        } catch (error) {
            console.error('❌ Error fetching Health Connect active calories:', error);
            return [];
        }
    }

    /**
     * Get workouts for a date range
     */
    public async getWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
        try {
            if (Platform.OS === 'ios') {
                return await this.getAppleHealthWorkouts(startDate, endDate);
            } else if (Platform.OS === 'android') {
                return await this.getHealthConnectWorkouts(startDate, endDate);
            }
            return [];
        } catch (error) {
            console.error('❌ Error getting workouts:', error);
            return [];
        }
    }

    private async getAppleHealthWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
        if (!AppleHealthKit || !this.connectionStatus.isConnected) return [];

        return new Promise((resolve) => {
            const options = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            };

            AppleHealthKit.getSamples(
                {
                    ...options,
                    type: 'Workout',
                },
                (error: any, results: any[]) => {
                    if (error) {
                        console.error('❌ Error fetching Apple Health workouts:', error);
                        resolve([]);
                        return;
                    }

                    const workouts: WorkoutData[] = (results || []).map((workout) => ({
                        type: workout.activityName || 'Unknown',
                        startDate: new Date(workout.start),
                        endDate: new Date(workout.end),
                        duration: workout.duration / 60, // Convert to minutes
                        calories: workout.calories || 0,
                        distance: workout.distance,
                        source: workout.sourceName || 'Apple Health',
                    }));

                    resolve(workouts);
                }
            );
        });
    }

    private async getHealthConnectWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
        if (!HealthConnect || !this.connectionStatus.isConnected) return [];

        try {
            const result = await HealthConnect.readRecords('ExerciseSession', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });

            return (result.records || []).map((record: any) => {
                const start = new Date(record.startTime);
                const end = new Date(record.endTime);
                const durationMs = end.getTime() - start.getTime();

                return {
                    type: record.exerciseType?.toString() || 'Unknown',
                    startDate: start,
                    endDate: end,
                    duration: durationMs / 60000, // Convert to minutes
                    calories: 0, // Would need separate query for calories
                    source: record.metadata?.dataOrigin?.packageName || 'Health Connect',
                };
            });
        } catch (error) {
            console.error('❌ Error fetching Health Connect workouts:', error);
            return [];
        }
    }

    /**
     * Get sleep data for a date range
     */
    public async getSleep(startDate: Date, endDate: Date): Promise<SleepData[]> {
        try {
            if (Platform.OS === 'ios') {
                return await this.getAppleHealthSleep(startDate, endDate);
            } else if (Platform.OS === 'android') {
                return await this.getHealthConnectSleep(startDate, endDate);
            }
            return [];
        } catch (error) {
            console.error('❌ Error getting sleep data:', error);
            return [];
        }
    }

    private async getAppleHealthSleep(startDate: Date, endDate: Date): Promise<SleepData[]> {
        if (!AppleHealthKit || !this.connectionStatus.isConnected) return [];

        return new Promise((resolve) => {
            const options = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            };

            AppleHealthKit.getSleepSamples(options, (error: any, results: any[]) => {
                if (error) {
                    console.error('❌ Error fetching Apple Health sleep:', error);
                    resolve([]);
                    return;
                }

                const sleepData: SleepData[] = (results || []).map((sample) => {
                    const start = new Date(sample.startDate);
                    const end = new Date(sample.endDate);
                    const durationHours = (end.getTime() - start.getTime()) / 3600000;

                    return {
                        startDate: start,
                        endDate: end,
                        duration: durationHours,
                        source: sample.sourceName || 'Apple Health',
                    };
                });

                resolve(sleepData);
            });
        });
    }

    private async getHealthConnectSleep(startDate: Date, endDate: Date): Promise<SleepData[]> {
        if (!HealthConnect || !this.connectionStatus.isConnected) return [];

        try {
            const result = await HealthConnect.readRecords('SleepSession', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
            });

            return (result.records || []).map((record: any) => {
                const start = new Date(record.startTime);
                const end = new Date(record.endTime);
                const durationHours = (end.getTime() - start.getTime()) / 3600000;

                return {
                    startDate: start,
                    endDate: end,
                    duration: durationHours,
                    source: record.metadata?.dataOrigin?.packageName || 'Health Connect',
                };
            });
        } catch (error) {
            console.error('❌ Error fetching Health Connect sleep:', error);
            return [];
        }
    }

    /**
     * Get today's step count with deduplication
     */
    public async getTodaySteps(): Promise<{ steps: number; source: string }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();

        const stepData = await this.getSteps(today, now);
        
        if (stepData.length === 0) {
            return { steps: 0, source: 'none' };
        }

        // Deduplicate and sum steps from different sources
        const { totalSteps, primarySource } = this.deduplicateAndSum(stepData);

        return {
            steps: totalSteps,
            source: primarySource,
        };
    }

    /**
     * Deduplicate step data from multiple sources
     * Uses time-based deduplication to prevent double-counting
     */
    private deduplicateAndSum(dataPoints: HealthDataPoint[]): { totalSteps: number; primarySource: string } {
        if (dataPoints.length === 0) {
            return { totalSteps: 0, primarySource: 'none' };
        }

        // Group by source
        const bySource: Record<string, HealthDataPoint[]> = {};
        for (const point of dataPoints) {
            const source = point.source;
            if (!bySource[source]) {
                bySource[source] = [];
            }
            bySource[source].push(point);
        }

        // Calculate total for each source
        const sourceTotals: Record<string, number> = {};
        for (const [source, points] of Object.entries(bySource)) {
            // Sort by start date
            points.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
            
            // Sum non-overlapping intervals
            let total = 0;
            let lastEndTime = 0;
            
            for (const point of points) {
                const startTime = point.startDate.getTime();
                const endTime = point.endDate.getTime();
                
                if (startTime >= lastEndTime) {
                    // No overlap, add full value
                    total += point.value;
                    lastEndTime = endTime;
                } else if (endTime > lastEndTime) {
                    // Partial overlap, estimate non-overlapping portion
                    const overlapRatio = (endTime - lastEndTime) / (endTime - startTime);
                    total += Math.round(point.value * overlapRatio);
                    lastEndTime = endTime;
                }
                // Fully contained in previous interval, skip
            }
            
            sourceTotals[source] = total;
        }

        // Prefer wearable sources over phone
        const wearableSources = ['Apple Watch', 'Wear OS', 'Galaxy Watch', 'Fitbit', 'Garmin'];
        let primarySource = 'phone';
        let maxSteps = 0;

        for (const [source, total] of Object.entries(sourceTotals)) {
            const isWearable = wearableSources.some(ws => source.toLowerCase().includes(ws.toLowerCase()));
            
            if (isWearable && total > 0) {
                primarySource = source;
                maxSteps = Math.max(maxSteps, total);
            } else if (!isWearable && maxSteps === 0) {
                primarySource = source;
                maxSteps = total;
            }
        }

        return { totalSteps: maxSteps, primarySource };
    }

    /**
     * Sync all health data and return summary
     */
    public async syncAll(): Promise<{
        steps: number;
        heartRateAvg: number;
        activeCalories: number;
        workoutMinutes: number;
        sleepHours: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();

        const [stepsData, heartRateData, caloriesData, workoutsData, sleepData] = await Promise.all([
            this.getSteps(today, now),
            this.getHeartRate(today, now),
            this.getActiveCalories(today, now),
            this.getWorkouts(today, now),
            this.getSleep(today, now),
        ]);

        // Calculate step total
        const { totalSteps } = this.deduplicateAndSum(stepsData);

        // Calculate average heart rate
        const heartRates = heartRateData.map(d => d.value).filter(v => v > 0);
        const heartRateAvg = heartRates.length > 0 
            ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
            : 0;

        // Sum active calories
        const activeCalories = caloriesData.reduce((sum, d) => sum + d.value, 0);

        // Sum workout duration
        const workoutMinutes = workoutsData.reduce((sum, w) => sum + w.duration, 0);

        // Sum sleep duration
        const sleepHours = sleepData.reduce((sum, s) => sum + s.duration, 0);

        // Update last sync time
        this.connectionStatus.lastSyncTime = new Date();
        await this.saveConnectionStatus();
        this.notifyListeners();

        return {
            steps: totalSteps,
            heartRateAvg,
            activeCalories: Math.round(activeCalories),
            workoutMinutes: Math.round(workoutMinutes),
            sleepHours: Math.round(sleepHours * 10) / 10,
        };
    }

    // Settings management
    public async loadSettings(): Promise<WearableSettings> {
        try {
            const saved = await AsyncStorage.getItem(WEARABLE_SETTINGS_KEY);
            if (saved) {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('❌ Error loading wearable settings:', error);
        }
        return this.settings;
    }

    public async saveSettings(): Promise<void> {
        try {
            await AsyncStorage.setItem(WEARABLE_SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error('❌ Error saving wearable settings:', error);
        }
    }

    public getSettings(): WearableSettings {
        return { ...this.settings };
    }

    public async updateSettings(updates: Partial<WearableSettings>): Promise<void> {
        this.settings = { ...this.settings, ...updates };
        await this.saveSettings();
    }

    // Connection status management
    private async loadConnectionStatus(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem(WEARABLE_CONNECTION_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.connectionStatus = {
                    ...this.connectionStatus,
                    ...parsed,
                    lastSyncTime: parsed.lastSyncTime ? new Date(parsed.lastSyncTime) : null,
                };
            }
        } catch (error) {
            console.error('❌ Error loading connection status:', error);
        }
    }

    private async saveConnectionStatus(): Promise<void> {
        try {
            await AsyncStorage.setItem(WEARABLE_CONNECTION_KEY, JSON.stringify(this.connectionStatus));
        } catch (error) {
            console.error('❌ Error saving connection status:', error);
        }
    }

    public getConnectionStatus(): ConnectionStatus {
        return { ...this.connectionStatus };
    }

    public isConnected(): boolean {
        return this.connectionStatus.isConnected;
    }

    public getPlatform(): string | null {
        return this.connectionStatus.platform;
    }

    // Listeners for status changes
    public addListener(callback: (status: ConnectionStatus) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(): void {
        const status = this.getConnectionStatus();
        this.listeners.forEach(callback => callback(status));
    }
}

// Export singleton instance
export default WearableHealthService.getInstance();
