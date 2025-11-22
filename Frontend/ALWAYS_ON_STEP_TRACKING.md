# PlateMate Always-On Step Tracking

This document describes the implementation of always-on step tracking using `react-native-background-actions` to ensure step counting continues even when the app is completely closed.

## Overview

The PlateMate app now includes a robust step tracking system that combines:
1. **Standard Background Tracking**: Uses `expo-background-fetch` and `expo-task-manager` for periodic background syncing
2. **Always-On Persistent Tracking**: Uses `react-native-background-actions` to maintain a continuous background service
3. **iOS Core Motion Integration**: Leverages iOS Core Motion (CMPedometer) via expo-sensors for optimal battery usage and accuracy
4. **Android Sensor Integration**: Direct access to device step sensors with proper permissions

## Architecture

### Core Components

1. **PersistentStepTracker** (`src/services/PersistentStepTracker.ts`)
   - Manages the always-on background service
   - Runs continuously even when app is closed
   - Shows persistent notification on Android
   - Handles iOS background time limitations

2. **BackgroundStepTracker** (`src/services/BackgroundStepTracker.ts`)
   - Enhanced to integrate with PersistentStepTracker
   - Manages sensor access and data synchronization
   - Handles app state changes and battery optimization

3. **Settings Integration** (`src/screens/Settings.tsx`)
   - User-controllable toggle for always-on step tracking
   - Clear explanations of battery/notification impact

## Features

### Always-On Step Tracking
- **Continuous Operation**: Keeps tracking steps even when app is force-closed
- **Battery Optimized**: Syncs every 30 seconds to balance accuracy with battery life
- **Persistent Notification**: Shows current step count in notification (Android)
- **Daily Reset**: Automatically resets step count at midnight
- **Database Sync**: Keeps SQLite database updated with latest step counts

### Platform-Specific Behavior

#### Android
- Uses `react-native-background-actions` for true background execution
- Shows persistent notification (cannot be disabled by OS requirement)
- Requires `ACTIVITY_RECOGNITION` permission for step counting
- Optionally uses `BODY_SENSORS` permission for improved accuracy

#### iOS
- Leverages iOS background task system
- Uses Core Motion (CMPedometer) via `expo-sensors`
- Periodic background fetch for step count updates
- Handles iOS background time limitations with expiration callbacks

## User Experience

### Settings Toggle
Users can enable/disable always-on step tracking from:
**Settings > Fitness Tracking > Always-On Step Tracking**

### Notifications
- **Android**: Shows persistent notification with current step count
- **iOS**: No persistent notification, but continues tracking in background

### Battery Impact
- Minimal battery impact due to 30-second sync intervals
- Optimized for foreground/background app states
- Uses device sensors efficiently

## Implementation Details

### Background Service Configuration
```typescript
const options = {
    taskName: 'PlateMate Step Tracker',
    taskTitle: 'PlateMate Step Tracking',
    taskDesc: 'Tracking your steps throughout the day',
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#FF00F5', // PlateMate pink
    linkingURI: 'platemate://home',
    parameters: {
        delay: 30000, // 30 seconds
    },
};
```

### Data Flow
1. Background service reads step count from device sensors
2. Compares with last known count to detect changes
3. Updates SQLite database with new step count
4. Updates notification with current count (Android)
5. Notifies app listeners if app is active

### Error Handling
- Graceful degradation when sensors are unavailable
- Continues running even if individual sync operations fail
- Automatic retry mechanism for database operations
- Comprehensive logging for debugging

## Setup & Configuration

### Required Dependencies
The following packages are already included in the project:
- `react-native-background-actions` (^4.0.1)
- `expo-sensors` (^14.1.4)
- `expo-task-manager` (^13.1.6)
- `expo-background-fetch` (^13.1.6)

### Permissions
The app automatically requests necessary permissions:
- **Android**: `ACTIVITY_RECOGNITION`, `BODY_SENSORS` (optional)
- **iOS**: Motion & Fitness permissions via system dialogs

### Initialization
The service is automatically initialized when the app starts if:
1. Step tracking was previously enabled
2. Device sensors are available
3. Required permissions are granted

## Testing

### To Test Always-On Step Tracking:
1. Enable "Always-On Step Tracking" in Settings
2. Close the app completely (swipe away from recent apps)
3. Walk around for a few minutes
4. Open the app and verify step count has increased
5. Check that notification shows current count (Android)

### Debugging
Enable verbose logging by checking the console for:
- `📊 Background sync: X steps updated`
- `✅ Persistent step tracking service started`
- `🔄 Starting persistent step tracking background service`

## Troubleshooting

### Common Issues

1. **Steps not counting when app is closed**
   - Verify always-on tracking is enabled in Settings
   - Check that required permissions are granted
   - Ensure device supports step counting sensors

2. **Battery drain concerns**
   - Monitor battery usage in device settings
   - Reduce sync frequency if needed (modify `syncInterval`)
   - Consider using only when device is charging

3. **Notification issues (Android)**
   - Notification is required by Android for background services
   - Cannot be disabled without stopping the service
   - Tapping notification opens the app

### Performance Monitoring
The service includes built-in performance monitoring:
- Step count change detection to minimize database writes
- Background/foreground optimization
- Memory usage optimization with proper cleanup

## Future Enhancements

Potential improvements for future versions:
1. **Adaptive Sync Intervals**: Adjust sync frequency based on movement patterns
2. **Geofencing Integration**: Enhanced tracking in specific locations
3. **Machine Learning**: Improved step detection accuracy
4. **Health Data Export**: Integration with other health platforms
5. **Advanced Analytics**: Step patterns and trends analysis

## Privacy & Security

- All step data is stored locally in SQLite database
- No step data is transmitted to external servers without explicit user consent
- Users can disable tracking at any time through Settings
- Data is automatically purged according to app's data retention policies
