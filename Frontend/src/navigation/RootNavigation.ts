import { createNavigationContainerRef, CommonActions, TabActions } from '@react-navigation/native';

// Keep this in a separate module so any part of the app can navigate without
// needing the component-level `navigation` object.
export const navigationRef = createNavigationContainerRef();

// Helper to navigate to the FoodLog screen and trigger a UI refresh.
export function navigateToFoodLog() {
  console.log('🏃‍♂️ navigateToFoodLog called, checking if navigation is ready...');
  if (navigationRef.isReady()) {
    console.log('✅ Navigation is ready, dispatching to FoodLog...');
    const refreshTimestamp = Date.now();

    // Navigate to Main first to ensure we're in the tab navigator
    navigationRef.dispatch(
      CommonActions.navigate('Main')
    );
    
    // Then jump to the FoodLog tab specifically
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          TabActions.jumpTo('FoodLog', { refresh: refreshTimestamp })
        );
        console.log('🎯 Jumped to FoodLog tab with refresh:', refreshTimestamp);
      }
    }, 50);
  } else {
    console.log('❌ Navigation is NOT ready yet');
  }
} 