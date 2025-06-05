# Database Locking Fix for Image Upload

## Problem Description
When uploading images to calculate calories and macros, the API returns a response successfully, but the data doesn't get stored in the local SQLite database. Instead, users see an error saying "table being locked."

## Root Cause Analysis
The issue was caused by **concurrent database operations** happening simultaneously:

1. **Multiple async operations**: Image upload API returns multiple food items, and `addMultipleFoodLogs` tries to insert them in a transaction
2. **Food Log Context polling**: The `FoodLogContext` actively polls the database every 5 seconds for changes
3. **Database notifications**: Every database operation triggers notifications that cause more reads
4. **Streak checking**: After adding food logs, the system tries to update user streaks

These concurrent operations caused SQLite table locking conflicts.

## Solutions Applied

### 1. Enhanced SQLite Configuration
**File**: `Frontend/src/utils/database.ts`

Added optimized PRAGMA settings in the database initialization:

```typescript
// Enable WAL mode for better performance and concurrency
await db.execAsync('PRAGMA journal_mode = WAL');

// Add additional SQLite optimizations to prevent locking
await db.execAsync('PRAGMA synchronous = NORMAL');
await db.execAsync('PRAGMA cache_size = 10000');
await db.execAsync('PRAGMA temp_store = MEMORY');
await db.execAsync('PRAGMA busy_timeout = 30000'); // 30 second timeout for locked database
```

**Benefits**:
- **WAL mode**: Allows concurrent readers while writing
- **busy_timeout**: 30-second timeout prevents immediate lock failures
- **synchronous = NORMAL**: Better performance while maintaining integrity
- **cache_size**: Larger cache reduces disk I/O
- **temp_store = MEMORY**: Faster temporary storage

### 2. Improved Transaction Handling
**File**: `Frontend/src/utils/database.ts` - `addMultipleFoodLogs` function

**Changes**:
- Use `BEGIN IMMEDIATE TRANSACTION` instead of `BEGIN TRANSACTION`
- Move streak checking outside the transaction
- Add timeout for database notifications to prevent blocking
- Better error handling with proper rollback

```typescript
// Start transaction with immediate mode for better locking behavior
await db.runAsync('BEGIN IMMEDIATE TRANSACTION');

// ... insert operations ...

// Commit transaction
await db.runAsync('COMMIT');

// Do streak checking outside transaction to avoid lock conflicts
try {
    await checkAndUpdateStreak(firebaseUserId);
} catch (streakError) {
    console.warn('⚠️ Failed to update streak, but food logs were saved:', streakError);
}

// Use setTimeout to avoid blocking and potential deadlocks
setTimeout(async () => {
    try {
        await notifyDatabaseChanged();
    } catch (notifyError) {
        console.warn('⚠️ Failed to notify database listeners:', notifyError);
    }
}, 100);
```

### 3. Reduced Database Polling Frequency
**File**: `Frontend/src/utils/databaseWatcher.ts`

Reduced polling interval from 5 seconds to 10 seconds:

```typescript
const POLLING_INTERVAL = 10000; // 10 seconds, reduced frequency to prevent database locking conflicts
```

## Testing the Fix

### Manual Testing Steps
1. **Upload an image** for calorie calculation using the camera feature
2. **Check the food log** to verify the data was stored properly
3. **Monitor console logs** for any "table locked" or database errors
4. **Verify nutritional data** appears correctly in the meal planner

### Expected Results
- ✅ No "table being locked" errors
- ✅ Food data gets saved to the local database
- ✅ Nutritional information displays correctly
- ✅ No performance degradation

### Test Script
Run the test script to verify all fixes are applied:

```bash
node test_db_fix.js
```

## Technical Details

### Why These Changes Work

1. **WAL Mode**: Write-Ahead Logging allows multiple readers during writes, eliminating most read/write conflicts
2. **IMMEDIATE Transactions**: Acquires exclusive lock immediately, preventing deadlocks from lock escalation
3. **Busy Timeout**: Gives operations time to complete instead of failing immediately
4. **Asynchronous Notifications**: Prevents blocking the main transaction with secondary operations
5. **Reduced Polling**: Less frequent database checks reduce the chance of conflicts

### Monitoring and Maintenance

- Monitor console logs for any remaining database warnings
- Check SQLite WAL file size occasionally (should auto-checkpoint)
- Consider further optimizations if high-concurrency issues arise

## Rollback Plan
If issues arise, revert these files:
- `Frontend/src/utils/database.ts`
- `Frontend/src/utils/databaseWatcher.ts`

Remove the test files:
- `test_db_fix.js`
- `DATABASE_LOCKING_FIX.md`

## Future Improvements
1. Consider using a connection pool for high-concurrency scenarios
2. Implement retry logic with exponential backoff for critical operations
3. Monitor database performance metrics
4. Consider migrating to a more robust database solution for production 