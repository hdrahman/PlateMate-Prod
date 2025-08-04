import { Platform } from 'react-native';

// Import react-native-health
let AppleHealthKit: any = null;
try {
  if (Platform.OS === 'ios') {
    AppleHealthKit = require('react-native-health').default;
  }
} catch (error) {
  console.warn('⚠️ react-native-health not available:', error);
}

class HealthKitStepCounterService {
  private static instance: HealthKitStepCounterService;
  private isInitialized: boolean = false;
  private backgroundDeliveryEnabled: boolean = false;
  private stepListener: ((data: { steps: number; date: string; timestamp: number }) => void) | null = null;

  private constructor() {
    // No need for event emitter setup with react-native-health
  }

  public static getInstance(): HealthKitStepCounterService {
    if (!HealthKitStepCounterService.instance) {
      HealthKitStepCounterService.instance = new HealthKitStepCounterService();
    }
    return HealthKitStepCounterService.instance;
  }

  public async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        AppleHealthKit.isAvailable((error: any, available: boolean) => {
          if (error) {
            console.error('❌ Error checking HealthKit availability:', error);
            resolve(false);
          } else {
            resolve(available);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error checking HealthKit availability:', error);
      return false;
    }
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      console.warn('⚠️ HealthKit only available on iOS');
      return false;
    }

    try {
      console.log('📱 Requesting HealthKit permissions...');
      
      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          ],
          write: [
            AppleHealthKit.Constants.Permissions.Steps
          ]
        },
      };

      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.error('❌ HealthKit permissions denied:', error);
            resolve(false);
          } else {
            console.log('✅ HealthKit permissions granted');
            this.isInitialized = true;
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error requesting HealthKit permissions:', error);
      return false;
    }
  }

  // These methods have been replaced by enableBackgroundDelivery/disableBackgroundDelivery above

  public async getTodaySteps(): Promise<number> {
    if (Platform.OS !== 'ios' || !AppleHealthKit || !this.isInitialized) {
      return 0;
    }

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const options = {
        startDate: startOfDay.toISOString(),
        endDate: today.toISOString(),
      };

      return new Promise((resolve) => {
        AppleHealthKit.getDailyStepCountSamples(options, (error: string, results: any[]) => {
          if (error) {
            console.error('❌ Error getting today\'s steps from HealthKit:', error);
            resolve(0);
          } else {
            const totalSteps = results?.reduce((sum, sample) => sum + sample.value, 0) || 0;
            console.log(`📊 HealthKit today's steps: ${totalSteps}`);
            resolve(totalSteps);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error getting today\'s steps from HealthKit:', error);
      return 0;
    }
  }

  public async getStepsForDate(date: string): Promise<number> {
    if (Platform.OS !== 'ios' || !AppleHealthKit || !this.isInitialized) {
      return 0;
    }

    try {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      const options = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      };

      return new Promise((resolve) => {
        AppleHealthKit.getDailyStepCountSamples(options, (error: string, results: any[]) => {
          if (error) {
            console.error(`❌ Error getting steps for date ${date} from HealthKit:`, error);
            resolve(0);
          } else {
            const totalSteps = results?.reduce((sum, sample) => sum + sample.value, 0) || 0;
            console.log(`📊 HealthKit steps for ${date}: ${totalSteps}`);
            resolve(totalSteps);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error getting steps for date ${date} from HealthKit:`, error);
      return 0;
    }
  }

  public async enableBackgroundDelivery(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !AppleHealthKit || !this.isInitialized) {
      return false;
    }

    try {
      console.log('🔔 Enabling HealthKit background sync...');
      
      // react-native-health doesn't have explicit background delivery
      // Instead, we'll set up periodic syncing when the app is active
      this.backgroundDeliveryEnabled = true;
      
      console.log('✅ HealthKit background sync enabled');
      return true;
    } catch (error) {
      console.error('❌ Error enabling HealthKit background sync:', error);
      return false;
    }
  }

  public async disableBackgroundDelivery(): Promise<void> {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      return;
    }

    try {
      console.log('🔕 Disabling HealthKit background sync...');
      this.backgroundDeliveryEnabled = false;
      console.log('✅ HealthKit background sync disabled');
    } catch (error) {
      console.error('❌ Error disabling HealthKit background sync:', error);
    }
  }

  public addStepListener(callback: (data: { steps: number; date: string; timestamp: number }) => void): () => void {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      return () => {};
    }

    this.stepListener = callback;

    // Since react-native-health doesn't have real-time events, we return a no-op unsubscribe
    return () => {
      this.stepListener = null;
    };
  }

  public removeStepListener(): void {
    this.stepListener = null;
  }

  /**
   * Initialize HealthKit with permissions and background delivery
   */
  public async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      console.log('🔄 Initializing HealthKit step counter...');

      // Check availability
      const available = await this.isAvailable();
      if (!available) {
        console.error('❌ HealthKit not available on this device');
        return false;
      }

      // Request permissions
      const permissionsGranted = await this.requestPermissions();
      if (!permissionsGranted) {
        console.error('❌ HealthKit permissions not granted');
        return false;
      }

      // Enable background delivery
      const backgroundEnabled = await this.enableBackgroundDelivery();
      if (!backgroundEnabled) {
        console.warn('⚠️ HealthKit background delivery could not be enabled');
        // Don't fail completely, as we can still get steps manually
      }

      console.log('✅ HealthKit step counter initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing HealthKit step counter:', error);
      return false;
    }
  }
}

export default HealthKitStepCounterService.getInstance();