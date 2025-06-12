import 'react-native-gesture-handler/jestSetup';
import { jest } from '@jest/globals';

// Mock React Native modules
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/FontAwesome', () => 'Icon');

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
            setOptions: jest.fn(),
            dispatch: jest.fn(),
        }),
        useRoute: () => ({
            params: {},
        }),
        useFocusEffect: jest.fn(),
    };
});

// Mock React Native Camera
jest.mock('react-native-camera', () => ({
    RNCamera: {
        Constants: {
            FlashMode: {
                torch: 'torch',
            },
            Type: {
                back: 'back',
                front: 'front',
            },
        },
    },
}));

// Mock React Native Image Picker
jest.mock('react-native-image-picker', () => ({
    launchImageLibrary: jest.fn(),
    launchCamera: jest.fn(),
}));

// Mock React Native Chart Kit
jest.mock('react-native-chart-kit', () => ({
    LineChart: 'LineChart',
    BarChart: 'BarChart',
    PieChart: 'PieChart',
    ProgressChart: 'ProgressChart',
    ContributionGraph: 'ContributionGraph',
    StackedBarChart: 'StackedBarChart',
}));

// Mock React Native DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// Mock React Native Permissions
jest.mock('react-native-permissions', () => ({
    check: jest.fn(() => Promise.resolve('granted')),
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: {
        IOS: {
            CAMERA: 'ios.permission.CAMERA',
            PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
        },
        ANDROID: {
            CAMERA: 'android.permission.CAMERA',
            READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
        },
    },
    RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        BLOCKED: 'blocked',
        UNAVAILABLE: 'unavailable',
    },
}));

// Mock React Native Device Info
jest.mock('react-native-device-info', () => ({
    getVersion: jest.fn(() => '1.0.0'),
    getBuildNumber: jest.fn(() => '100'),
    getSystemVersion: jest.fn(() => '14.0'),
    getModel: jest.fn(() => 'iPhone'),
}));

// Mock React Native Gesture Handler
jest.mock('react-native-gesture-handler', () => {
    const View = require('react-native').View;
    return {
        Swipeable: View,
        DrawerLayout: View,
        State: {},
        ScrollView: View,
        Slider: View,
        Switch: View,
        TextInput: View,
        ToolbarAndroid: View,
        ViewPagerAndroid: View,
        DrawerLayoutAndroid: View,
        WebView: View,
        NativeViewGestureHandler: View,
        TapGestureHandler: View,
        FlingGestureHandler: View,
        ForceTouchGestureHandler: View,
        LongPressGestureHandler: View,
        PanGestureHandler: View,
        PinchGestureHandler: View,
        RotationGestureHandler: View,
        RawButton: View,
        BaseButton: View,
        RectButton: View,
        BorderlessButton: View,
        FlatList: View,
        gestureHandlerRootHOC: jest.fn(),
        Directions: {},
    };
});

// Mock Expo modules (if using Expo)
jest.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: {
                apiUrl: 'http://localhost:8000',
            },
        },
    },
}));

// Mock Firebase (if using Firebase SDK directly)
jest.mock('@react-native-firebase/app', () => ({
    default: {
        apps: [],
    },
}));

jest.mock('@react-native-firebase/auth', () => ({
    default: () => ({
        signInWithEmailAndPassword: jest.fn(),
        createUserWithEmailAndPassword: jest.fn(),
        signOut: jest.fn(),
        onAuthStateChanged: jest.fn(),
        currentUser: {
            uid: 'test-uid',
            email: 'test@example.com',
        },
    }),
}));

// Mock React Native NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock React Native Keychain
jest.mock('react-native-keychain', () => ({
    setInternetCredentials: jest.fn(() => Promise.resolve()),
    getInternetCredentials: jest.fn(() => Promise.resolve({ username: 'test', password: 'test' })),
    resetInternetCredentials: jest.fn(() => Promise.resolve()),
}));

// Mock Animated API
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
        ...RN,
        Animated: {
            ...RN.Animated,
            timing: () => ({
                start: jest.fn(),
            }),
            spring: () => ({
                start: jest.fn(),
            }),
            Value: jest.fn(() => ({
                setValue: jest.fn(),
                addListener: jest.fn(),
                removeListener: jest.fn(),
            })),
        },
    };
});

// Mock Alert
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
        ...RN,
        Alert: {
            alert: jest.fn(),
        },
    };
});

// Mock Platform
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
        ...RN,
        Platform: {
            ...RN.Platform,
            OS: 'ios',
            select: jest.fn((obj) => obj.ios),
        },
    };
});

// Mock Linking
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
        ...RN,
        Linking: {
            openURL: jest.fn(() => Promise.resolve()),
            canOpenURL: jest.fn(() => Promise.resolve(true)),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        },
    };
});

// Global test helpers
global.fetch = jest.fn();

// Setup console spy to suppress console logs during tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// Mock timers for animation testing
jest.useFakeTimers();

// Increase timeout for async operations
jest.setTimeout(10000); 