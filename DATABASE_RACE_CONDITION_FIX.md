# Database Race Condition Fix

## Problem Analysis

Your PlateMate application was experiencing **database is locked** errors due to a classic race condition in expo-sqlite. This issue was identified in the recent [expo-sqlite GitHub issue #33754](https://github.com/expo/expo/issues/33754).

### Root Cause

The problem occurred when multiple database operations tried to initialize the database simultaneously:

1. **App startup**: Database initialization in `App.js`
2. **Food logging**: Multiple food entries being added via `addMultipleFoodLogs`
3. **Background sync**: Automatic syncing operations
4. **Database polling**: FoodLogContext and other watchers querying the database
5. **Streak updates**: User activity tracking
6. **Profile updates**: User profile modifications

When these operations happened concurrently during app startup, multiple `openDatabaseAsync` calls would create competing database connections, leading to SQLite lock conflicts.

## Solution Applied

### 1. Database Singleton Pattern

**File**: `Frontend/src/utils/database.ts`

Implemented a proper singleton pattern to ensure only one database connection exists:

```typescript
// Database singleton and initialization tracking
let db: SQLite.SQLiteDatabase;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let isInitializing = false;

// Get or initialize the database with proper singleton pattern
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    // If database is already initialized, return it
    if (db && global.dbInitialized) {
        return db;
    }

    // If initialization is in progress, wait for it
    if (dbInitPromise) {
        return dbInitPromise;
    }

    // Start initialization
    dbInitPromise = initDatabase();
    return dbInitPromise;
};
```

### 2. Initialization Protection

Added safeguards to prevent multiple concurrent initializations:

```typescript
export const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    try {
        // Prevent multiple concurrent initializations
        if (isInitializing) {
            throw new Error('Database initialization already in progress');
        }

        isInitializing = true;
        // ... database setup code ...
        
        // Reset flags on completion
        global.dbInitialized = true;
        isInitializing = false;
        dbInitPromise = null;
        
        return db;
    } catch (error) {
        // Reset on error
        global.dbInitialized = false;
        isInitializing = false;
        dbInitPromise = null;
        throw error;
    }
};
```

### 3. Function Updates

Updated all database functions to use the singleton pattern:

```typescript
// Before (causes race conditions)
export const addFoodLog = async (foodLog: any) => {
    if (!db || !global.dbInitialized) {
        // Multiple functions could trigger initialization simultaneously
        await initDatabase();
    }
    // ... rest of function
};

// After (singleton pattern)
export const addFoodLog = async (foodLog: any) => {
    const database = await getDatabase(); // Always returns the same instance
    // ... rest of function
};
```

### 4. App.js Update

**File**: `Frontend/App.js`

Updated the main app initialization to use the singleton:

```javascript
// Before
import { initDatabase } from './src/utils/database';
await initDatabase();

// After  
import { getDatabase } from './src/utils/database';
await getDatabase();
```

## Key Benefits

### 1. **Eliminates Race Conditions**
- Only one database initialization can happen at a time
- Concurrent operations wait for the same initialization promise
- No more competing database connections

### 2. **Maintains Existing SQLite Optimizations**
- All existing PRAGMA settings remain in place:
  - `PRAGMA journal_mode = WAL` (Write-Ahead Logging)
  - `PRAGMA busy_timeout = 30000` (30-second timeout)
  - `PRAGMA synchronous = NORMAL` (Performance optimization)
  - `PRAGMA cache_size = 10000` (Large cache)

### 3. **Backwards Compatible**
- All existing function calls continue to work
- No changes needed in React components
- Existing error handling remains intact

### 4. **Performance Improvements**
- Eliminates redundant database connections
- Reduces initialization overhead
- Maintains single connection pooling

## What This Fixes

✅ **Database locked errors** during app startup  
✅ **Race conditions** in `addMultipleFoodLogs`  
✅ **Concurrent initialization** attempts  
✅ **Multiple database connections** competing for locks  
✅ **Transaction conflicts** during food logging  

## Monitoring

To verify the fix is working, monitor your logs for:

- ✅ Single "Database initialized successfully" message on app start
- ✅ No more "database is locked" errors
- ✅ Successful food logging operations
- ✅ Proper transaction handling

## Rollback Plan

If any issues arise, you can quickly rollback by:

1. Reverting `Frontend/src/utils/database.ts` to use direct `initDatabase()` calls
2. Reverting `Frontend/App.js` to import `initDatabase`
3. The existing database optimizations and transaction handling remain in place

## Technical Details

This fix addresses the specific race condition identified in [expo-sqlite issue #33754](https://github.com/expo/expo/issues/33754) where:

> "When sending an async request, the `getDbAsync` function is called, which opens an async request and sets the `db` property. But if a new AsyncStorage request is sent before the first `getDbAsync` is resolved, the `db` property is not yet set and a new `getDbAsync` will be executed, returning another instance of the db connection."

Our singleton pattern ensures that all concurrent database access attempts use the same initialization promise, eliminating this race condition entirely. 