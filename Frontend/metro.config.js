const { getDefaultConfig } = require('expo/metro-config');

// Create the default Metro config
const defaultConfig = getDefaultConfig(__dirname);

// This is the fix mentioned in GitHub issue #30870
// https://github.com/expo/expo/issues/30870
defaultConfig.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = defaultConfig; 