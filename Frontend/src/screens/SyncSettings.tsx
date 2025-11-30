import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Switch
} from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { postgreSQLSyncService, SyncResult, RestoreResult } from '../utils/postgreSQLSyncService';
import { useAuth } from '../context/AuthContext';

const SyncSettings: React.FC = () => {
    const { theme, isDarkTheme } = useContext(ThemeContext);
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
    const [lastRestoreResult, setLastRestoreResult] = useState<RestoreResult | null>(null);
    const [syncStatus, setSyncStatus] = useState<{
        lastSyncTime: Date | null;
        isSyncing: boolean;
        syncEnabled: boolean;
    }>({
        lastSyncTime: null,
        isSyncing: false,
        syncEnabled: true
    });

    useEffect(() => {
        updateSyncStatus();
    }, []);

    const updateSyncStatus = () => {
        const status = postgreSQLSyncService.getSyncStatus();
        setSyncStatus(status);
    };

    const handleManualSync = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to sync data');
            return;
        }

        setIsLoading(true);
        try {
            const result = await postgreSQLSyncService.triggerManualSync();
            setLastSyncResult(result);

            if (result.success) {
                Alert.alert(
                    'Sync Completed',
                    `Successfully synced:\n• ${result.stats.usersUploaded} user profiles\n• ${result.stats.foodLogsUploaded} food logs\n• ${result.stats.weightsUploaded} weight entries\n• ${result.stats.streaksUploaded} streaks\n• ${result.stats.nutritionGoalsUploaded} nutrition goals\n• ${result.stats.subscriptionsUploaded} subscriptions\n• ${result.stats.cheatDaySettingsUploaded} cheat day settings`
                );
            } else {
                Alert.alert(
                    'Sync Failed',
                    `Sync completed with ${result.errors.length} errors:\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`
                );
            }
        } catch (error: any) {
            Alert.alert('Sync Error', error.message || 'Failed to sync data');
        } finally {
            setIsLoading(false);
            updateSyncStatus();
        }
    };

    const handleManualRestore = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to restore data');
            return;
        }

        Alert.alert(
            'Confirm Restore',
            'This will restore data from PostgreSQL. Any local changes may be overwritten. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Restore',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const result = await postgreSQLSyncService.restoreFromPostgreSQL();
                            setLastRestoreResult(result);

                            if (result.success) {
                                Alert.alert(
                                    'Restore Completed',
                                    `Successfully restored:\n• ${result.stats.usersRestored} user profiles\n• ${result.stats.foodLogsRestored} food logs\n• ${result.stats.weightsRestored} weight entries\n• ${result.stats.streaksRestored} streaks\n• ${result.stats.nutritionGoalsRestored} nutrition goals\n• ${result.stats.subscriptionsRestored} subscriptions\n• ${result.stats.cheatDaySettingsRestored} cheat day settings`
                                );
                            } else {
                                Alert.alert(
                                    'Restore Failed',
                                    `Restore completed with ${result.errors.length} errors:\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`
                                );
                            }
                        } catch (error: any) {
                            Alert.alert('Restore Error', error.message || 'Failed to restore data');
                        } finally {
                            setIsLoading(false);
                            updateSyncStatus();
                        }
                    }
                }
            ]
        );
    };

    const handleToggleAutoSync = (enabled: boolean) => {
        if (enabled) {
            postgreSQLSyncService.enableAutoSync();
        } else {
            postgreSQLSyncService.disableAutoSync();
        }
        updateSyncStatus();
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Never';
        return date.toLocaleString();
    };

    const formatStats = (stats: any) => {
        if (!stats) return 'No data';

        const items = [];
        if (stats.usersUploaded || stats.usersRestored) items.push(`${stats.usersUploaded || stats.usersRestored} users`);
        if (stats.foodLogsUploaded || stats.foodLogsRestored) items.push(`${stats.foodLogsUploaded || stats.foodLogsRestored} food logs`);
        if (stats.weightsUploaded || stats.weightsRestored) items.push(`${stats.weightsUploaded || stats.weightsRestored} weights`);
        if (stats.streaksUploaded || stats.streaksRestored) items.push(`${stats.streaksUploaded || stats.streaksRestored} streaks`);
        if (stats.nutritionGoalsUploaded || stats.nutritionGoalsRestored) items.push(`${stats.nutritionGoalsUploaded || stats.nutritionGoalsRestored} goals`);
        if (stats.subscriptionsUploaded || stats.subscriptionsRestored) items.push(`${stats.subscriptionsUploaded || stats.subscriptionsRestored} subscriptions`);
        if (stats.cheatDaySettingsUploaded || stats.cheatDaySettingsRestored) items.push(`${stats.cheatDaySettingsUploaded || stats.cheatDaySettingsRestored} cheat settings`);

        return items.length > 0 ? items.join(', ') : 'No data processed';
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        scrollView: {
            flex: 1,
            padding: 20,
        },
        header: {
            fontSize: 24,
            fontWeight: 'bold',
            color: theme.colors.text,
            marginBottom: 20,
            textAlign: 'center',
        },
        section: {
            backgroundColor: theme.colors.cardBackground,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            shadowColor: theme.colors.text,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: 12,
        },
        statusRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        statusLabel: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            flex: 1,
        },
        statusValue: {
            fontSize: 14,
            color: theme.colors.text,
            fontWeight: '500',
            flex: 2,
            textAlign: 'right',
        },
        button: {
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 12,
        },
        buttonSecondary: {
            backgroundColor: theme.colors.cardBackground,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        buttonDisabled: {
            backgroundColor: theme.colors.border,
        },
        buttonText: {
            color: theme.colors.background,
            fontSize: 16,
            fontWeight: '600',
        },
        buttonTextSecondary: {
            color: theme.colors.text,
        },
        buttonTextDisabled: {
            color: theme.colors.textSecondary,
        },
        resultSection: {
            marginTop: 8,
            padding: 12,
            backgroundColor: theme.colors.background,
            borderRadius: 8,
        },
        resultSuccess: {
            backgroundColor: isDarkTheme ? 'rgba(76, 175, 80, 0.2)' : '#e7f5e7',
        },
        resultError: {
            backgroundColor: isDarkTheme ? 'rgba(255, 69, 58, 0.2)' : '#fce7e7',
        },
        resultText: {
            fontSize: 12,
            color: theme.colors.textSecondary,
        },
        resultTextSuccess: {
            color: theme.colors.success,
        },
        resultTextError: {
            color: theme.colors.error,
        },
        switchRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        switchLabel: {
            fontSize: 16,
            color: theme.colors.text,
            flex: 1,
        },
        loadingOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        },
        loadingText: {
            color: theme.colors.text,
            marginTop: 10,
            fontSize: 16,
        },
    });

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <Text style={styles.header}>PostgreSQL Sync</Text>

                {/* Sync Status Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sync Status</Text>

                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Last Sync:</Text>
                        <Text style={styles.statusValue}>
                            {formatDate(syncStatus.lastSyncTime)}
                        </Text>
                    </View>

                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Currently Syncing:</Text>
                        <Text style={styles.statusValue}>
                            {syncStatus.isSyncing ? 'Yes' : 'No'}
                        </Text>
                    </View>

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Automatic Sync (24h)</Text>
                        <Switch
                            value={syncStatus.syncEnabled}
                            onValueChange={handleToggleAutoSync}
                            thumbColor={theme.colors.primary}
                            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        />
                    </View>
                </View>

                {/* Manual Controls Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Manual Controls</Text>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            (isLoading || syncStatus.isSyncing) && styles.buttonDisabled
                        ]}
                        onPress={handleManualSync}
                        disabled={isLoading || syncStatus.isSyncing}
                    >
                        <Text style={[
                            styles.buttonText,
                            (isLoading || syncStatus.isSyncing) && styles.buttonTextDisabled
                        ]}>
                            {isLoading ? 'Syncing...' : 'Sync to PostgreSQL'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.buttonSecondary,
                            (isLoading || syncStatus.isSyncing) && styles.buttonDisabled
                        ]}
                        onPress={handleManualRestore}
                        disabled={isLoading || syncStatus.isSyncing}
                    >
                        <Text style={[
                            styles.buttonText,
                            styles.buttonTextSecondary,
                            (isLoading || syncStatus.isSyncing) && styles.buttonTextDisabled
                        ]}>
                            {isLoading ? 'Restoring...' : 'Restore from PostgreSQL'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Last Sync Result */}
                {lastSyncResult && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Last Sync Result</Text>
                        <View style={[
                            styles.resultSection,
                            lastSyncResult.success ? styles.resultSuccess : styles.resultError
                        ]}>
                            <Text style={[
                                styles.resultText,
                                lastSyncResult.success ? styles.resultTextSuccess : styles.resultTextError
                            ]}>
                                Status: {lastSyncResult.success ? 'Success' : 'Failed'}
                            </Text>
                            <Text style={[
                                styles.resultText,
                                lastSyncResult.success ? styles.resultTextSuccess : styles.resultTextError
                            ]}>
                                Data: {formatStats(lastSyncResult.stats)}
                            </Text>
                            {lastSyncResult.stats.lastSyncTime && (
                                <Text style={[
                                    styles.resultText,
                                    lastSyncResult.success ? styles.resultTextSuccess : styles.resultTextError
                                ]}>
                                    Time: {new Date(lastSyncResult.stats.lastSyncTime).toLocaleString()}
                                </Text>
                            )}
                            {lastSyncResult.errors.length > 0 && (
                                <Text style={[styles.resultText, styles.resultTextError]}>
                                    Errors: {lastSyncResult.errors.slice(0, 2).join(', ')}
                                    {lastSyncResult.errors.length > 2 && '...'}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {/* Last Restore Result */}
                {lastRestoreResult && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Last Restore Result</Text>
                        <View style={[
                            styles.resultSection,
                            lastRestoreResult.success ? styles.resultSuccess : styles.resultError
                        ]}>
                            <Text style={[
                                styles.resultText,
                                lastRestoreResult.success ? styles.resultTextSuccess : styles.resultTextError
                            ]}>
                                Status: {lastRestoreResult.success ? 'Success' : 'Failed'}
                            </Text>
                            <Text style={[
                                styles.resultText,
                                lastRestoreResult.success ? styles.resultTextSuccess : styles.resultTextError
                            ]}>
                                Data: {formatStats(lastRestoreResult.stats)}
                            </Text>
                            {lastRestoreResult.errors.length > 0 && (
                                <Text style={[styles.resultText, styles.resultTextError]}>
                                    Errors: {lastRestoreResult.errors.slice(0, 2).join(', ')}
                                    {lastRestoreResult.errors.length > 2 && '...'}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {/* Info Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>How It Works</Text>
                    <Text style={[styles.resultText, { color: theme.colors.textSecondary }]}>
                        • Your data is stored locally in SQLite for offline access{'\n'}
                        • Automatic sync backs up changes to PostgreSQL every 24 hours{'\n'}
                        • If you log in on a new device, data is restored from PostgreSQL{'\n'}
                        • Manual sync pushes all local changes immediately{'\n'}
                        • Manual restore pulls all data from PostgreSQL (overwrites local)
                    </Text>
                </View>
            </ScrollView>

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.text} />
                    <Text style={styles.loadingText}>
                        {syncStatus.isSyncing ? 'Syncing data...' : 'Processing...'}
                    </Text>
                </View>
            )}
        </View>
    );
};

export default SyncSettings; 