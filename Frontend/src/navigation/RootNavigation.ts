import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

// Keep this in a separate module so any part of the app can navigate without
// needing the component-level `navigation` object.
export const navigationRef = createNavigationContainerRef();

// Helper to navigate to the FoodLog screen and trigger a UI refresh.
export function navigateToFoodLog() {
  console.log('🏃‍♂️ navigateToFoodLog called, checking if navigation is ready...');
  if (navigationRef.isReady()) {
    console.log('✅ Navigation is ready, dispatching to FoodLog...');
    const refreshTimestamp = Date.now();

    // Since FoodLog is now a tab screen within Main, we need to navigate to Main first,
    // then use jumpTo to switch to the FoodLog tab
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: {
          screen: 'FoodLog',
          params: { refresh: refreshTimestamp },
        },
      })
    );
    console.log('🎯 Navigation dispatched to FoodLog tab with refresh:', refreshTimestamp);
  } else {
    console.log('❌ Navigation is NOT ready yet');
  }
} 