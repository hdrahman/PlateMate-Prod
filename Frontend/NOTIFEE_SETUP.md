# Setting Up Notifee for PlateMate

Notifee is a library that allows us to create and manage notifications in our React Native app. It requires native module integration, which means it won't work in the standard Expo Go app.

## Error: "notifee native module not found"

If you're seeing this error, it means you're trying to use Notifee features in an environment that doesn't have the native modules installed (like Expo Go).

## Solution: Create a Development Build

To use Notifee, you need to create a development build of the app that includes the native modules:

1. Make sure you have EAS CLI installed:
   ```
   npm install -g eas-cli
   ```

2. Log in to your Expo account:
   ```
   eas login
   ```

3. Build a development client for Android:
   ```
   npm run build-dev
   ```
   
   This will start the build process on EAS servers. When complete, you'll get a link to download the APK.

4. Install the APK on your Android device.

5. Start the development server with the dev client flag:
   ```
   npm run start-notifee
   ```

6. Open the development build app on your device and connect to the development server.

## Troubleshooting

### Java Version Issues

Notifee requires Java JDK 11 or higher. The EAS build configuration in `eas.json` already specifies:

```json
"android": {
    "image": "ubuntu-18.04-jdk-11-ndk-r19c"
}
```

### Expo Plugin Issues

If you encounter plugin-related errors, make sure the `notifee.plugin.js` file is correctly configured and added to your `app.json` plugins array.

### Native Module Not Found Even After Development Build

If you're still getting the "native module not found" error after creating a development build:

1. Make sure you're running the app from the development build, not Expo Go
2. Check that you're using the correct start command: `npm run start-notifee`
3. Verify that the Notifee plugin is correctly configured in your `app.json`
4. Try clearing the cache with `expo start -c` before running the dev client

## Additional Resources

- [Notifee Documentation](https://notifee.app/react-native/docs/overview)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/) 