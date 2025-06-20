// Initialize Firebase first - importing from our config file
import './src/utils/firebase/index';

import { registerRootComponent } from 'expo';
import App from './App';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Check if we're running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Only import notifee on Android and when not in Expo Go
let notifee;
let EventType;

if (Platform.OS === 'android' && !isExpoGo) {
    try {
        // Try to import notifee
        const notifeeModule = require('@notifee/react-native');
        notifee = notifeeModule.default;
        EventType = notifeeModule.EventType;

        // Register background handler for notifee
        if (notifee) {
            console.log('Notifee successfully imported in index.js');

            try {
                notifee.onBackgroundEvent(async ({ type, detail }) => {
                    try {
                        const { notification } = detail;

                        if (type === EventType.PRESS) {
                            // User pressed the notification
                            console.log('User pressed notification', notification);
                        }
                    } catch (error) {
                        console.error('Error in background event handler:', error);
                    }
                });
                console.log('Notifee background handler registered successfully');
            } catch (error) {
                console.warn('Failed to register Notifee background handler:', error);
            }
        }
    } catch (error) {
        console.error('Failed to import notifee in index.js:', error.message);
        console.warn('To use Notifee, you need to create a development build with: npm run build-dev');
        console.warn('This is normal when running in Expo Go - permanent notifications will be disabled');
    }
} else if (isExpoGo) {
    console.log('Running in Expo Go - Notifee functionality will be disabled');
}

// Make global variable to indicate if we're in Expo Go
global.isExpoGo = isExpoGo;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
