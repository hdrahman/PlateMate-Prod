import { NativeModules, Platform } from 'react-native';

export const testNativeStepCounter = async () => {
  console.log('🧪 Testing Native Step Counter Module...');
  console.log('Platform:', Platform.OS);
  
  if (Platform.OS !== 'android') {
    console.log('❌ Not on Android, skipping test');
    return;
  }
  
  const { NativeStepCounter } = NativeModules;
  console.log('NativeStepCounter module:', NativeStepCounter ? 'FOUND' : 'NOT FOUND');
  
  if (!NativeStepCounter) {
    console.log('❌ NativeStepCounter module not available');
    console.log('Available native modules:', Object.keys(NativeModules));
    return;
  }
  
  console.log('Available methods:', Object.keys(NativeStepCounter));
  
  try {
    console.log('🔍 Testing isStepCounterAvailable...');
    const available = await NativeStepCounter.isStepCounterAvailable();
    console.log('✅ Step counter available:', available);
    
    if (available) {
      console.log('🔍 Testing getCurrentSteps...');
      const steps = await NativeStepCounter.getCurrentSteps();
      console.log('✅ Current steps:', steps);
      
      console.log('🔍 Testing startStepCounting...');
      const started = await NativeStepCounter.startStepCounting();
      console.log('✅ Step counting started:', started);
    }
  } catch (error) {
    console.error('❌ Error testing native module:', error);
  }
};

// Auto-run test in dev mode
if (__DEV__) {
  setTimeout(() => {
    testNativeStepCounter();
  }, 2000);
}