import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

interface NativeStepCounterModule {
  startStepCounting(): Promise<boolean>;
  stopStepCounting(): Promise<void>;
  getCurrentSteps(): Promise<number>;
  isStepCounterAvailable(): Promise<boolean>;
  resetDailyBaseline(): Promise<void>;
  setStepBaseline(baseline: number): Promise<void>;
  getStepBaseline(): Promise<number>;
}

// Only available on Android
let NativeStepCounter: NativeStepCounterModule | null = null;

try {
  if (Platform.OS === 'android') {
    console.log('🔍 Attempting to load NativeStepCounter module...');
    console.log('Available NativeModules:', Object.keys(NativeModules));
    
    NativeStepCounter = NativeModules.NativeStepCounter;
    
    if (NativeStepCounter) {
      console.log('✅ NativeStepCounter module loaded successfully');
    } else {
      console.error('❌ NativeStepCounter module not found in NativeModules');
    }
  }
} catch (error) {
  console.error('❌ Error loading NativeStepCounter module:', error);
  NativeStepCounter = null;
}

class NativeStepCounterService {
  private static instance: NativeStepCounterService;
  private eventEmitter: NativeEventEmitter | null = null;
  private stepListener: ((data: { steps: number; timestamp: number }) => void) | null = null;

  private constructor() {
    console.log('🔧 NativeStepCounterService constructor called');
    console.log('Platform.OS:', Platform.OS);
    console.log('NativeStepCounter module exists:', !!NativeStepCounter);
    
    if (Platform.OS === 'android' && NativeStepCounter) {
      try {
        console.log('🔧 Creating NativeEventEmitter...');
        this.eventEmitter = new NativeEventEmitter(NativeStepCounter);
        console.log('✅ NativeEventEmitter created successfully');
      } catch (error) {
        console.error('❌ Failed to create NativeEventEmitter:', error);
        this.eventEmitter = null;
      }
    } else {
      console.log('ℹ️ NativeEventEmitter not created - not Android or module missing');
    }
  }

  public static getInstance(): NativeStepCounterService {
    if (!NativeStepCounterService.instance) {
      NativeStepCounterService.instance = new NativeStepCounterService();
    }
    return NativeStepCounterService.instance;
  }

  public async isAvailable(): Promise<boolean> {
    console.log('🔍 NativeStepCounter.isAvailable() called');
    console.log('Platform.OS:', Platform.OS);
    console.log('NativeStepCounter module:', NativeStepCounter ? 'AVAILABLE' : 'NOT AVAILABLE');
    
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      console.log('❌ Native step counter not available - platform or module missing');
      return false;
    }

    try {
      console.log('🔄 Calling native isStepCounterAvailable...');
      const result = await NativeStepCounter.isStepCounterAvailable();
      console.log('✅ Native isStepCounterAvailable result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking step counter availability:', error);
      return false;
    }
  }

  public async startStepCounting(): Promise<boolean> {
    console.log('🔍 NativeStepCounter.startStepCounting() called');
    
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      console.warn('⚠️ Native step counter only available on Android');
      return false;
    }

    try {
      console.log('🚀 Starting native step counting...');
      const success = await NativeStepCounter.startStepCounting();
      console.log('🔍 Native startStepCounting result:', success);
      
      if (success) {
        console.log('✅ Native step counting started successfully');
      } else {
        console.error('❌ Failed to start native step counting');
      }

      return success;
    } catch (error) {
      console.error('❌ Error starting native step counting:', error);
      return false;
    }
  }

  public async stopStepCounting(): Promise<void> {
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      return;
    }

    try {
      console.log('🛑 Stopping native step counting...');
      await NativeStepCounter.stopStepCounting();
      console.log('✅ Native step counting stopped');
    } catch (error) {
      console.error('❌ Error stopping native step counting:', error);
    }
  }

  public async getCurrentSteps(): Promise<number> {
    console.log('🔍 NativeStepCounter.getCurrentSteps() called');
    
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      console.log('❌ getCurrentSteps - platform or module not available');
      return 0;
    }

    try {
      console.log('🔄 Calling native getCurrentSteps...');
      const steps = await NativeStepCounter.getCurrentSteps();
      console.log('📊 Native getCurrentSteps result:', steps);
      return steps || 0;
    } catch (error) {
      console.error('❌ Error getting current steps:', error);
      return 0;
    }
  }

  public async resetDailyBaseline(): Promise<void> {
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      console.warn('⚠️ resetDailyBaseline - platform or module not available');
      return;
    }

    try {
      console.log('📅 Resetting daily step baseline...');
      await NativeStepCounter.resetDailyBaseline();
      console.log('✅ Daily step baseline reset successfully');
    } catch (error) {
      console.error('❌ Error resetting daily baseline:', error);
    }
  }

  public async setStepBaseline(baseline: number): Promise<void> {
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      return;
    }

    try {
      await NativeStepCounter.setStepBaseline(baseline);
    } catch (error) {
      console.error('❌ Error setting step baseline:', error);
    }
  }

  public async getStepBaseline(): Promise<number> {
    if (Platform.OS !== 'android' || !NativeStepCounter) {
      return 0;
    }

    try {
      return await NativeStepCounter.getStepBaseline();
    } catch (error) {
      console.error('❌ Error getting step baseline:', error);
      return 0;
    }
  }

  public addStepListener(callback: (data: { steps: number; timestamp: number }) => void): () => void {
    if (Platform.OS !== 'android' || !this.eventEmitter) {
      return () => {};
    }

    this.stepListener = callback;
    const subscription = this.eventEmitter.addListener('onStepCountChanged', callback);

    return () => {
      subscription.remove();
      this.stepListener = null;
    };
  }

  public removeStepListener(): void {
    if (this.stepListener && this.eventEmitter) {
      this.eventEmitter.removeAllListeners('onStepCountChanged');
      this.stepListener = null;
    }
  }
}

export default NativeStepCounterService.getInstance();