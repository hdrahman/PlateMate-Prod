const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotifeeAndroid(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults.manifest;

        // Add permissions
        if (!androidManifest['uses-permission']) {
            androidManifest['uses-permission'] = [];
        }

        const permissions = [
            {
                $: {
                    'android:name': 'android.permission.VIBRATE',
                },
            },
            {
                $: {
                    'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED',
                },
            },
            {
                $: {
                    'android:name': 'android.permission.SCHEDULE_EXACT_ALARM',
                },
            },
            {
                $: {
                    'android:name': 'android.permission.POST_NOTIFICATIONS',
                },
            },
            {
                $: {
                    'android:name': 'android.permission.FOREGROUND_SERVICE',
                },
            },
            {
                $: {
                    'android:name': 'android.permission.FOREGROUND_SERVICE_HEALTH',
                },
            },
        ];

        // Add permissions that don't already exist
        permissions.forEach((permission) => {
            const permissionName = permission.$['android:name'];
            const existingPermission = androidManifest['uses-permission'].find(
                (p) => p.$['android:name'] === permissionName
            );

            if (!existingPermission) {
                androidManifest['uses-permission'].push(permission);
            }
        });

        // Add the foreground service to the application
        const application = androidManifest.application[0];

        if (!application.service) {
            application.service = [];
        }

        const foregroundService = {
            $: {
                'android:name': 'app.notifee.core.ForegroundService',
                'android:foregroundServiceType': 'health',
                'android:exported': 'false',
            },
        };

        // Check if the service already exists
        const existingService = application.service.find(
            (s) => s.$['android:name'] === 'app.notifee.core.ForegroundService'
        );

        if (!existingService) {
            application.service.push(foregroundService);
        }

        return config;
    });
}; 