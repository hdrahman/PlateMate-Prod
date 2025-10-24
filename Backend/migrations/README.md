# Database Migrations

## Running Migrations on Render

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `add_subscription_versioning.sql`
4. Click **Run**

### Option 2: Via psql (if you have it installed locally)
```bash
# Get your DATABASE_URL from Supabase dashboard (Settings > Database > Connection string > URI)
psql "YOUR_DATABASE_URL" -f Backend/migrations/add_subscription_versioning.sql
```

### Option 3: Via Python Script
```python
import os
from supabase import create_client

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

with open("Backend/migrations/add_subscription_versioning.sql", "r") as f:
    sql = f.read()
    
# Note: Supabase Python client doesn't support raw SQL execution
# Use Supabase dashboard SQL Editor instead
```

## Migration: add_subscription_versioning.sql

**Purpose**: Adds optimistic locking to prevent race conditions in subscription updates

**What it does**:
- Adds `version` column to `user_subscriptions` table
- Creates index for performance
- Adds automatic `updated_at` trigger
- All existing rows get `version = 1`

**Safe to run**: Yes - uses `IF NOT EXISTS` checks, won't break existing data

**Testing after migration**:
```bash
# Verify version column exists
psql "YOUR_DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='version';"

# Should return: version | integer
```
