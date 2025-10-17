# VIP User Quick Reference
**Fast commands for managing VIP users via Supabase SQL Editor**

---

## 🚀 Quick Start

### 1️⃣ Apply Migration (One Time Only)
Run the SQL in `Backend/migrations/create_vip_users_table.sql` in Supabase SQL Editor.

---

## 📝 Common Commands

### Grant VIP Access
```sql
-- Single user
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES ('user-firebase-uid-here', 'user@example.com', 'friend', 'admin');

-- Multiple users
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES 
    ('uid-1', 'friend1@example.com', 'friend', 'admin'),
    ('uid-2', 'family@example.com', 'family', 'admin');
```

### Revoke VIP (Soft Delete)
```sql
UPDATE vip_users SET is_active = false WHERE email = 'user@example.com';
```

### Restore VIP
```sql
UPDATE vip_users SET is_active = true WHERE email = 'user@example.com';
```

### Remove VIP (Permanent)
```sql
DELETE FROM vip_users WHERE email = 'user@example.com';
```

### List All Active VIPs
```sql
SELECT email, reason, granted_at
FROM vip_users
WHERE is_active = true
ORDER BY granted_at DESC;
```

### Find User's Firebase UID
```sql
SELECT firebase_uid, email, first_name, last_name
FROM users
WHERE email = 'user@example.com';
```

---

## 👑 VIP Reason Examples
- `'founder'` - App founder/owner
- `'friend'` - Personal friend
- `'family'` - Family member
- `'beta_tester'` - Beta tester
- `'team_member'` - Team/staff member
- `'investor'` - App investor

---

## 🎯 One-Command Grant (If you know Firebase UID)
```sql
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES ('abc123xyz', 'friend@email.com', 'friend', 'admin');
```

## 🎯 Two-Step Grant (Find UID first)
```sql
-- Step 1: Find Firebase UID
SELECT firebase_uid FROM users WHERE email = 'friend@email.com';

-- Step 2: Grant VIP (replace 'abc123' with actual UID from step 1)
INSERT INTO vip_users (firebase_uid, email, reason, granted_by)
VALUES ('abc123', 'friend@email.com', 'friend', 'admin');
```

---

## 📊 Monitoring

### Count Active VIPs
```sql
SELECT COUNT(*) FROM vip_users WHERE is_active = true;
```

### VIPs by Type
```sql
SELECT reason, COUNT(*) as count
FROM vip_users
WHERE is_active = true
GROUP BY reason;
```

---

**Full Guide:** See `VIP_USER_MANAGEMENT_GUIDE.md` for detailed instructions and FAQ.
