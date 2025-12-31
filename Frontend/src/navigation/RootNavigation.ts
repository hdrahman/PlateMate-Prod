import { createNavigationContainerRef, CommonActions, TabActions } from '@react-navigation/native';

// Keep this in a separate module so any part of the app can navigate without
// needing the component-level `navigation` object.
export const navigationRef = createNavigationContainerRef();

// Helper to navigate to the Home screen (for persistent notification tap)
export function navigateToHome() {
  console.log('🏠 navigateToHome called, checking if navigation is ready...');
  if (navigationRef.isReady()) {
    console.log('✅ Navigation is ready, dispatching to Home...');
    navigationRef.dispatch(
      CommonActions.navigate('Main')
    );

    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          TabActions.jumpTo('Home')
        );
        console.log('🎯 Jumped to Home tab');
      }
    }, 50);
  } else {
    console.log('❌ Navigation is NOT ready yet');
  }
}

// Helper to navigate to the Scanner screen (for initial meal reminder tap)
export function navigateToScanner() {
  console.log('📸 navigateToScanner called, checking if navigation is ready...');
  if (navigationRef.isReady()) {
    console.log('✅ Navigation is ready, dispatching to Scanner...');
    navigationRef.dispatch(
      CommonActions.navigate('Scanner', { mode: 'camera' })
    );
    console.log('🎯 Navigated to Scanner with camera mode');
  } else {
    console.log('❌ Navigation is NOT ready yet');
  }
}

// Helper to navigate to the Manual entry screen (for missed meal followup tap)
export function navigateToManualEntry(mealType: string = 'Snack') {
  console.log('✍️ navigateToManualEntry called, checking if navigation is ready...');
  if (navigationRef.isReady()) {
    console.log('✅ Navigation is ready, dispatching to Manual...');
    navigationRef.dispatch(
      CommonActions.navigate('Manual', { mealType, sourcePage: 'notification' })
    );
    console.log(`🎯 Navigated to Manual entry with mealType: ${mealType}`);
  } else {
    console.log('❌ Navigation is NOT ready yet');
  }
}

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