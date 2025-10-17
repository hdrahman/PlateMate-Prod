# VIP User Management Guide
**Free Lifetime Premium Access for Founders, Friends, Family & Testers**

---

## 🎯 Overview

The VIP system allows you to grant **free lifetime premium access** to specific users (yourself, friends, family, testers) without requiring them to pay for a subscription. VIP users are managed entirely through the **Supabase Dashboard** - no code changes or API calls needed.

---

## ✅ What's Implemented

### Database Table: `vip_users`
Located in Supabase with the following structure:
- `id` - UUID (auto-generated)
- `firebase_uid` - User's Firebase UID (required)
- `email` - User's email for easier identification (required)
- `reason` - Why they have VIP status (e.g., "founder", "friend", "family", "tester")
- `granted_by` - Who granted the status (e.g., "admin")
- `granted_at` - Timestamp when VIP was granted (auto-set)
- `is_active` - Boolean for soft revocation (default: true)

### Backend Integration
- ✅ VIP check runs **before** RevenueCat validation (highest priority)
- ✅ VIP users bypass all premium checks automatically
- ✅ VIP users get unlimited uploads (no daily limits)
- ✅ VIP status works retroactively for existing accounts
- ✅ Changes take effect within ~2 minutes (cache timeout)

### Security
- ✅ Server-side validation only (users cannot tamper)
- ✅ No frontend changes needed (fully transparent)
- ✅ Row Level Security (RLS) enabled on table
- ✅ Only accessible via Supabase dashboard or service role

---

## 🚀 Setup Instructions

### Step 1: Apply Migration

1. Open **Supabase Dashboard** → Your Project
2. Go to **SQL Editor**
3. Click **"New Query"**
4. Copy the entire contents of `Backend/migrations/create_vip_users_table.sql`
5. Paste into SQL Editor
6. Click **"Run"** to create the table

✅ The `vip_users` table is now created!

---

## 📝 Managing VIP Users

### Method 1: Table Editor (Easiest - Recommended)

#### **Grant VIP Access:**

1. Go to **Supabase Dashboard** → **Table Editor**
2. Select **`vip_users`** table
3. Click **"Insert" → "Insert row"**
4. Fill in:
   - `firebase_uid`: User's Firebase UID (get from `users` table)
   - `email`: User's email address
   - `reason`: Why they're VIP (e.g., "founder", "friend", "family")
   - `granted_by`: "admin" (or your name)
   - `is_active`: ✅ checked (true)
5. Click **"Save"**

**✅ Done!** User will have premium access next time they open the app.

#### **Revoke VIP Access (Soft Delete - Recommended):**

1. Go to **Table Editor** → **`vip_users`**
2. Find the user's row
3. Click on the row to edit
4. Uncheck `is_active` (set to false)
5. Click **"Save"**

**✅ Done!** User loses premium access within ~2 minutes.

#### **Restore VIP Access:**

1. Find the user's row in `vip_users`
2. Check `is_active` (set to true)
3. Click **"Save"**

#### **Permanently Remove VIP:**

1. Find the user's row
2. Click the **trash icon** to delete the row
3. Confirm deletion

---

### Method 2: SQL Editor (For Bulk Operations)

#### **Grant VIP Access:**

```sql
-- Add VIP user by email
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES ('user-firebase-uid-here', 'friend@example.com', 'friend', 'admin');

-- Add multiple VIP users at once
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES 
    ('uid-1', 'friend1@example.com', 'friend', 'admin'),
    ('uid-2', 'friend2@example.com', 'family', 'admin'),
    ('uid-3', 'tester@example.com', 'tester', 'admin');
```

#### **Revoke VIP Access:**

```sql
-- Soft delete (recommended - keeps history)
UPDATE vip_users 
SET is_active = false 
WHERE email = 'friend@example.com';

-- Or by firebase_uid
UPDATE vip_users 
SET is_active = false 
WHERE firebase_uid = 'user-firebase-uid-here';
```

#### **Restore VIP Access:**

```sql
UPDATE vip_users 
SET is_active = true 
WHERE email = 'friend@example.com';
```

#### **Permanently Remove VIP:**

```sql
DELETE FROM vip_users 
WHERE email = 'friend@example.com';
```

#### **List All VIP Users:**

```sql
-- Active VIPs only
SELECT firebase_uid, email, reason, granted_by, granted_at
FROM vip_users
WHERE is_active = true
ORDER BY granted_at DESC;

-- All VIPs (including revoked)
SELECT firebase_uid, email, reason, is_active, granted_at
FROM vip_users
ORDER BY granted_at DESC;
```

#### **Find User's Firebase UID by Email:**

```sql
SELECT firebase_uid, email, first_name, last_name
FROM users
WHERE email = 'friend@example.com';
```

---

## 🔍 How to Get a User's Firebase UID

You need the user's Firebase UID to add them as VIP. Two ways to get it:

### Option 1: From Supabase Dashboard
1. Go to **Table Editor** → **`users`** table
2. Search for the user's email in the filter
3. Copy their `firebase_uid` column value

### Option 2: Via SQL
```sql
SELECT firebase_uid, email, first_name, last_name
FROM users
WHERE email = 'user@example.com';
```

---

## ⚙️ How It Works

### Priority Order for Premium Validation:

1. **VIP Check** (Highest Priority)
   - Check if user exists in `vip_users` with `is_active = true`
   - If yes → Grant premium immediately (tier: `vip_lifetime`)
   - If no → Continue to next check

2. **RevenueCat Check**
   - Check for active paid subscription or trial
   - Return appropriate tier based on subscription type

### VIP Users Get:
✅ All premium features unlocked  
✅ Unlimited food photo uploads  
✅ No subscription prompts or paywalls  
✅ Works across all devices (tied to account)  
✅ Lifetime access (unless revoked)  

### Regular Users:
- Normal trial + subscription flow continues
- No changes to existing behavior

---

## 🧪 Testing the VIP System

### Test Scenario 1: Grant VIP to Existing User

1. Find a test user's email/Firebase UID
2. Add them to `vip_users` table via Supabase dashboard
3. Have them close and reopen the app (or wait ~2 min for cache refresh)
4. Verify they can access premium features
5. Check logs for: `👑 VIP user detected: {firebase_uid}`

### Test Scenario 2: Revoke VIP Access

1. Set `is_active = false` for the test user in `vip_users`
2. Wait ~2 minutes for cache to expire
3. Have them try accessing premium features
4. Verify they're blocked (should see subscription prompt)

### Test Scenario 3: VIP User Uploads

1. Grant VIP to a test user
2. Have them upload multiple food photos in a row
3. Verify no upload limits are enforced
4. Check logs for: `👑 VIP unlimited uploads granted to {firebase_uid}`

---

## 📊 Monitoring & Logs

### Backend Logs to Watch For:

**VIP Detected:**
```
👑 VIP user detected: abc123 (reason: founder)
👑 VIP access granted to abc123 - Reason: friend
👑 VIP unlimited uploads granted to abc123
```

**VIP Check Failed:**
```
Error checking VIP status for abc123: [error details]
```

### Query VIP Statistics:

```sql
-- Count active VIPs
SELECT COUNT(*) as active_vips
FROM vip_users
WHERE is_active = true;

-- VIPs by reason
SELECT reason, COUNT(*) as count
FROM vip_users
WHERE is_active = true
GROUP BY reason;

-- Recent VIP grants
SELECT email, reason, granted_by, granted_at
FROM vip_users
WHERE granted_at > NOW() - INTERVAL '30 days'
ORDER BY granted_at DESC;
```

---

## 🔒 Security Notes

- ✅ **VIP status is server-side only** - users cannot tamper with it
- ✅ **No API endpoints exposed** - only Supabase dashboard access
- ✅ **RLS policies enabled** - users can only view their own VIP status
- ✅ **Service role required** - only admins can modify vip_users table
- ✅ **Soft deletion supported** - revoke without losing history

---

## 📞 Common Use Cases

### Use Case 1: Grant VIP to Yourself
```sql
-- Replace with your actual email and Firebase UID
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES ('your-firebase-uid', 'your@email.com', 'founder', 'admin');
```

### Use Case 2: Grant VIP to Friends/Family
```sql
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES 
    ('friend-uid-1', 'friend1@email.com', 'friend', 'admin'),
    ('friend-uid-2', 'friend2@email.com', 'family', 'admin');
```

### Use Case 3: Grant VIP to Testers
```sql
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES 
    ('tester-uid-1', 'tester1@email.com', 'beta_tester', 'admin'),
    ('tester-uid-2', 'tester2@email.com', 'beta_tester', 'admin');
```

### Use Case 4: Temporarily Revoke VIP (Testing)
```sql
-- Revoke
UPDATE vip_users SET is_active = false WHERE email = 'tester@email.com';

-- Restore later
UPDATE vip_users SET is_active = true WHERE email = 'tester@email.com';
```

---

## ❓ FAQ

**Q: Does VIP work for existing users with accounts already created?**  
A: Yes! VIP checks happen on every premium validation. Add them to the table and they get premium immediately.

**Q: Can I revoke VIP access later?**  
A: Yes, two ways: (1) Soft delete by setting `is_active = false`, or (2) Hard delete by removing the row.

**Q: How long until VIP changes take effect?**  
A: Within ~2 minutes due to caching. User may need to close/reopen app.

**Q: Will VIP users show up in RevenueCat dashboard?**  
A: No, they bypass RevenueCat entirely. They're only tracked in Supabase `vip_users` table.

**Q: What if I accidentally delete a VIP user?**  
A: Soft deletion (`is_active = false`) is recommended to keep history. You can restore by setting it back to true.

**Q: Can I have multiple VIP entries for the same user?**  
A: No, there's a unique constraint on `firebase_uid`. You'll get an error if you try.

**Q: What happens if the VIP table query fails?**  
A: System defaults to non-VIP (fail safely) and checks RevenueCat instead.

---

## 🎉 You're All Set!

Your VIP system is now ready to use. Simply:

1. ✅ Apply the migration to create the table
2. ✅ Add users via Supabase dashboard
3. ✅ Test with your own account
4. ✅ Add friends/family as needed

**No code changes needed going forward - manage everything through Supabase!** 👑
