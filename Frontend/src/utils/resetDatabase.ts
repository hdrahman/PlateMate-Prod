import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_VERSION_KEY = 'DB_VERSION';

export const resetDatabaseVersion = async () => {
    try {
        await AsyncStorage.removeItem(DB_VERSION_KEY);
        console.log('✅ Database version reset - migrations will run on next app start');
    } catch (error) {
        console.error('❌ Error resetting database version:', error);
    }
};

export const getCurrentDatabaseVersion = async () => {
    try {
        const version = await AsyncStorage.getItem(DB_VERSION_KEY);
        return version ? parseInt(version) : 1;
    } catch (error) {
        console.error('❌ Error getting database version:', error);
        return 1;
    }
}; 