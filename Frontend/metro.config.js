const { getDefaultConfig } = require('expo/metro-config');

// Create the default Metro config
const defaultConfig = getDefaultConfig(__dirname);

// This is the fix mentioned in GitHub issue #30870
// https://github.com/expo/expo/issues/30870
defaultConfig.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

// Fix for undici "Body is unusable" error in Expo CLI
// Force Node.js to use legacy fetch polyfill instead of undici
defaultConfig.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
defaultConfig.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = defaultConfig; 