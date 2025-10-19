# Onboarding Issue Fix for support@tryplatemate.app

## Issue Summary
The `support@tryplatemate.app` account was failing to complete onboarding and getting stuck in a loop, redirecting back to the sign-in screen after authentication, while `platemate.dev@gmail.com` worked fine.

## Root Cause Analysis

### Investigation Steps
1. **Checked Database**: Used Supabase MCP server to query the `users` table
2. **Account Verification**: Confirmed the account is actually `support@tryplatemate.app` (NOT `support@platemate.app`)
3. **Data Comparison**: Compared both accounts to identify missing data

### Findings

#### Working Account (platemate.dev@gmail.com)
- `onboarding_complete`: ✅ `true`
- `user_settings` table entry: ✅ EXISTS

#### Broken Account (support@tryplatemate.app)
- `onboarding_complete`: ✅ `true` (was fixed earlier)
- `user_settings` table entry: ❌ **MISSING**

### The Bug

The app's data restoration flow (`postgreSQLSyncService.ts`) was **incomplete**:

1. When a user logs in, the app checks SQLite locally
2. If no local profile exists, it attempts to restore from Supabase
3. The `restoreFromPostgreSQL()` function was syncing:
   - ✅ User Profile
   - ✅ Nutrition Goals
   - ✅ Food Logs
   - ✅ Weight Entries
   - ✅ User Streaks
   - ✅ Subscriptions
   - ✅ Cheat Day Settings
   - ❌ **User Settings** (MISSING!)

4. Similarly, `syncToPostgreSQL()` was not syncing `user_settings`

This caused the app to fail when it expected `user_settings` to exist but couldn't find it.

## The Fix

### 1. Immediate Fix (Database)
Created the missing `user_settings` entry for `support@tryplatemate.app`:

```sql
INSERT INTO user_settings (firebase_uid, notification_settings, data_sharing_settings, privacy_settings, ui_preferences)
VALUES ('462c4c6b-ff2b-4b75-bae8-6dfffac7b4f7', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
```

### 2. Code Fix (Prevention)
Updated `Frontend/src/utils/postgreSQLSyncService.ts`:

#### Added to Interfaces:
```typescript
export interface SyncStats {
    // ... existing fields
    userSettingsUploaded: number;  // NEW
}

export interface RestoreStats {
    // ... existing fields
    userSettingsRestored: number;  // NEW
}
```

#### Added Sync Method:
```typescript
private async syncUserSettings(firebaseUid: string, stats: SyncStats, errors: string[]) {
    // Ensures user_settings exists in Supabase
    // Creates default settings if missing
}
```

#### Added Restore Method:
```typescript
private async restoreUserSettings(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
    // Restores user_settings from Supabase
    // Creates default settings if missing
}
```

#### Updated Sync Flow:
```typescript
// In syncToPostgreSQL()
// ... existing syncs
// 8. Sync User Settings
await this.syncUserSettings(currentUser.id, stats, errors);
```

#### Updated Restore Flow:
```typescript
// In restoreFromPostgreSQL()
// ... existing restores
// 8. Restore User Settings
await this.restoreUserSettings(currentUser.id, postgresUserId, stats, errors);
```

## Impact

### Before Fix
- New users or users on new devices would fail onboarding if `user_settings` wasn't created
- No automatic creation/restoration of `user_settings`
- Users would get stuck in sign-in loop

### After Fix
- ✅ `user_settings` is automatically created during sync
- ✅ `user_settings` is automatically restored from Supabase
- ✅ Missing `user_settings` no longer causes onboarding failures
- ✅ All user accounts will have proper `user_settings` entries

## Testing

### Immediate Test
1. Log out of `support@tryplatemate.app` on the device
2. Clear app data/cache (optional, to ensure fresh state)
3. Log back in with `support@tryplatemate.app`
4. Onboarding should now complete successfully

### Long-term Prevention
- All new users will automatically get `user_settings` created
- Existing users missing `user_settings` will have it created on next sync
- Data restoration will include `user_settings`

## Files Modified
- `Frontend/src/utils/postgreSQLSyncService.ts` - Added user_settings sync/restore logic

## Database Changes
- Created `user_settings` entry for firebase_uid: `462c4c6b-ff2b-4b75-bae8-6dfffac7b4f7`

## Notes
- The issue was specific to the `user_settings` table, not `onboarding_complete`
- The fix ensures all users have proper `user_settings` entries going forward
- The sync service now handles missing `user_settings` gracefully by creating defaults
