# PlateMate PostgreSQL Online Backup Schema

## Overview
PlateMate's online backup system uses PostgreSQL for cross-device synchronization of essential user data only. This document outlines the streamlined schema structure focused on what users actually need when switching devices, excluding temporary and potentially sensitive data.

## Database Information
- **Database Type**: PostgreSQL 15+
- **Recommended Providers**: Supabase, Neon, or AWS RDS
- **Authentication**: Firebase UID integration
- **Storage Strategy**: Essential data only (PostgreSQL) + External Storage (S3/R2) for media references
- **Estimated Cost**: $20-40/month per 1000 active users (reduced from removing unnecessary data)

## Data Classification Strategy

### TIER 1: CRITICAL SYNC DATA
**Must sync across devices - users would be upset if lost**
- User profiles & onboarding data (all preferences, goals, personal info)
- Food logs (complete nutritional history - this is the core value)
- Weight history & progress tracking (critical for motivation)
- Subscription status (affects app functionality)
- User streaks (important for gamification/motivation)

### TIER 2: IMPORTANT SYNC DATA
**Should sync for better user experience**  
- Nutrition goals (separate table for easier management)
- Cheat day configurations (user preferences)

### TIER 3: OPTIONAL/QUESTIONABLE DATA
**May be device-specific or not critical for cross-device experience**
- Daily step counts (often synced from device health apps like Apple Health/Google Fit)
- Exercise logs (may sync from fitness apps like MyFitnessPal, Strava, etc.)

### EXCLUDED: TEMPORARY/LOCAL DATA
**Should NOT be synced - security risks or device-specific**
- API tokens (security risk, expire and refresh locally)
- Sync logs (device-specific sync state)
- Last synced timestamps (device-specific metadata)

### TIER 4: EXTERNAL STORAGE REFERENCES
**Large files stored externally, only URLs in database**
- Food images (image_url field in food_logs)
- Future self voice/video messages (media URLs in users table)
- Profile photos & recipe images

## Storage Architecture

### PostgreSQL Database (Primary Storage)
Stores all structured data with references to external media files.

### External Storage (AWS S3/Cloudflare R2)
Stores large media files with lifecycle policies for cost optimization.

**File Structure:**
```
platemate-media/
├── users/{firebase_uid}/
│   ├── future-self/
│   │   ├── voice/{message_id}.m4a
│   │   └── video/{message_id}.mp4
│   ├── food-photos/{year}/{month}/{food_log_id}.jpg
│   └── profile/avatar.jpg
└── recipes/fallback-images/{category}/{image_name}.jpg
```

## PostgreSQL Schema

### 1. users
Core user profile and preference data (maps to SQLite user_profiles table).

**Columns:**
- `id`: UUID PRIMARY KEY (PostgreSQL generated)
- `firebase_uid`: VARCHAR(128) UNIQUE NOT NULL (links to Firebase Auth)
- `email`: VARCHAR(255) UNIQUE NOT NULL
- `first_name`: VARCHAR(100) NOT NULL
- `last_name`: VARCHAR(100)
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Profile Data:**
- `date_of_birth`: DATE
- `gender`: VARCHAR(20)
- `height`: DECIMAL(5,2) (maps to SQLite height field)
- `weight`: DECIMAL(5,2) (current weight, maps to SQLite weight field)
- `target_weight`: DECIMAL(5,2)
- `starting_weight`: DECIMAL(5,2)
- `age`: INTEGER
- `location`: VARCHAR(100)
- `timezone`: VARCHAR(50) DEFAULT 'UTC'

**Goals & Preferences:**
- `activity_level`: VARCHAR(20) CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'))
- `fitness_goal`: VARCHAR(30)
- `weight_goal`: VARCHAR(20) CHECK (weight_goal IN ('lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'))
- `daily_calorie_target`: INTEGER
- `protein_goal`: INTEGER
- `carb_goal`: INTEGER  
- `fat_goal`: INTEGER
- `unit_preference`: VARCHAR(10) DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial'))
- `use_metric_system`: BOOLEAN DEFAULT TRUE
- `preferred_language`: VARCHAR(5) DEFAULT 'en'
- `dark_mode`: BOOLEAN DEFAULT FALSE

**Health & Lifestyle:**
- `dietary_restrictions`: TEXT
- `food_allergies`: TEXT
- `cuisine_preferences`: TEXT
- `health_conditions`: TEXT
- `diet_type`: VARCHAR(30)
- `nutrient_focus`: TEXT
- `weekly_workouts`: INTEGER
- `step_goal`: INTEGER
- `water_goal`: INTEGER
- `sleep_goal`: INTEGER
- `workout_frequency`: INTEGER
- `sleep_quality`: VARCHAR(20)
- `stress_level`: VARCHAR(20)
- `eating_pattern`: VARCHAR(30)

**Motivation & Future Self:**
- `motivations`: TEXT
- `why_motivation`: TEXT
- `projected_completion_date`: DATE
- `estimated_metabolic_age`: INTEGER
- `estimated_duration_weeks`: INTEGER
- `future_self_message`: TEXT
- `future_self_message_type`: VARCHAR(20)
- `future_self_message_created_at`: TIMESTAMP WITH TIME ZONE

**Notifications:**
- `push_notifications_enabled`: BOOLEAN DEFAULT TRUE
- `email_notifications_enabled`: BOOLEAN DEFAULT TRUE
- `sms_notifications_enabled`: BOOLEAN DEFAULT FALSE
- `marketing_emails_enabled`: BOOLEAN DEFAULT TRUE
- `sync_data_offline`: BOOLEAN DEFAULT TRUE

**Status:**
- `onboarding_complete`: BOOLEAN DEFAULT FALSE

### 2. nutrition_goals
User nutrition targets and daily goals (maps to SQLite nutrition_goals table).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `target_weight`: DECIMAL(5,2)
- `daily_calorie_goal`: INTEGER NOT NULL
- `protein_goal`: INTEGER NOT NULL
- `carb_goal`: INTEGER NOT NULL
- `fat_goal`: INTEGER NOT NULL
- `weight_goal`: VARCHAR(20) CHECK (weight_goal IN ('lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'))
- `activity_level`: VARCHAR(20) CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'))
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 3. user_weights
Historical weight tracking for progress monitoring (maps to SQLite user_weights table).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `weight`: DECIMAL(5,2) NOT NULL CHECK (weight > 0)
- `recorded_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 4. food_logs
Comprehensive food logging with nutritional data (maps to SQLite food_logs table).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `meal_id`: INTEGER NOT NULL

**Food Identification:**
- `food_name`: VARCHAR(255) NOT NULL
- `brand_name`: VARCHAR(255)
- `meal_type`: VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
- `date`: VARCHAR(50) NOT NULL (ISO date string to match SQLite)

**Quantity Information:**
- `quantity`: VARCHAR(50) (stored as text to match SQLite)
- `weight`: DECIMAL(8,2)
- `weight_unit`: VARCHAR(20) DEFAULT 'g'

**Macronutrients (matches SQLite field names):**
- `calories`: INTEGER NOT NULL CHECK (calories >= 0)
- `proteins`: INTEGER NOT NULL DEFAULT 0
- `carbs`: INTEGER NOT NULL DEFAULT 0
- `fats`: INTEGER NOT NULL DEFAULT 0
- `fiber`: INTEGER DEFAULT 0
- `sugar`: INTEGER DEFAULT 0

**Fat Breakdown:**
- `saturated_fat`: INTEGER DEFAULT 0
- `polyunsaturated_fat`: INTEGER DEFAULT 0
- `monounsaturated_fat`: INTEGER DEFAULT 0
- `trans_fat`: INTEGER DEFAULT 0

**Micronutrients:**
- `cholesterol`: INTEGER DEFAULT 0
- `sodium`: INTEGER DEFAULT 0
- `potassium`: INTEGER DEFAULT 0
- `vitamin_a`: INTEGER DEFAULT 0
- `vitamin_c`: INTEGER DEFAULT 0
- `calcium`: INTEGER DEFAULT 0
- `iron`: INTEGER DEFAULT 0

**Metadata:**
- `healthiness_rating`: INTEGER CHECK (healthiness_rating BETWEEN 1 AND 10)
- `notes`: TEXT
- `image_url`: TEXT NOT NULL
- `file_key`: VARCHAR(255) NOT NULL DEFAULT 'default_file_key'

### 5. user_subscriptions
Premium subscription management and tracking (maps to SQLite user_subscriptions table).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `subscription_status`: VARCHAR(20) NOT NULL DEFAULT 'free'
- `start_date`: VARCHAR(50) NOT NULL (ISO date string to match SQLite)
- `end_date`: VARCHAR(50)
- `trial_ends_at`: VARCHAR(50)
- `canceled_at`: VARCHAR(50)
- `auto_renew`: BOOLEAN DEFAULT FALSE
- `payment_method`: VARCHAR(50)
- `subscription_id`: VARCHAR(255) (matches SQLite field name)
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 6. user_streaks
Gamification and streak tracking for user engagement (maps to SQLite user_streaks table).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `current_streak`: INTEGER DEFAULT 0
- `longest_streak`: INTEGER DEFAULT 0
- `last_activity_date`: VARCHAR(50) (ISO date string to match SQLite)

### 7. exercises (OPTIONAL - May be device-specific)
Exercise and workout tracking (maps to SQLite exercises table).
*Note: Exercise data may sync from fitness apps or be manually entered*

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `exercise_name`: VARCHAR(255) NOT NULL
- `calories_burned`: INTEGER NOT NULL
- `duration`: INTEGER NOT NULL (in minutes)
- `date`: VARCHAR(50) NOT NULL (ISO date string to match SQLite)
- `notes`: TEXT

### 8. steps (OPTIONAL - May be device-specific)
Daily step count tracking (maps to SQLite steps table).
*Note: Steps are often synced from device health apps and may not need cloud backup*

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `date`: VARCHAR(50) NOT NULL (ISO date string to match SQLite)
- `count`: INTEGER NOT NULL DEFAULT 0

**Constraints:**
- UNIQUE(user_id, date)

### 9. cheat_day_settings
Cheat day scheduling and management preferences (maps to SQLite cheat_day_settings table).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `cheat_day_frequency`: INTEGER DEFAULT 7 (Every N days, matches SQLite field name)
- `last_cheat_day`: VARCHAR(50) (ISO date string to match SQLite)
- `next_cheat_day`: VARCHAR(50) (matches SQLite field name)
- `enabled`: BOOLEAN DEFAULT TRUE
- `preferred_day_of_week`: INTEGER CHECK (preferred_day_of_week BETWEEN 0 AND 6)
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()



## Indexes for Performance

### Primary User Lookups
- `idx_users_firebase_uid`: ON users(firebase_uid)
- `idx_users_email`: ON users(email)

### Food Logs (Most Queried Table)
- `idx_food_logs_user_date`: ON food_logs(user_id, date DESC)
- `idx_food_logs_meal_type`: ON food_logs(user_id, meal_type, date DESC)

### Weight History
- `idx_user_weights_user_date`: ON user_weights(user_id, recorded_at DESC)

### Exercise & Activity
- `idx_exercises_user_date`: ON exercises(user_id, date DESC)
- `idx_steps_user_date`: ON steps(user_id, date DESC)



## External Storage Configuration

### S3/R2 Bucket Structure
- **Voice Messages**: AAC compression (~50KB/minute)
- **Video Messages**: H.264 compression (~2-5MB/minute)
- **Food Photos**: WebP format (~100-500KB each)
- **Lifecycle Policies**: Auto-archive after 6 months, delete after 2 years

### Cost Optimization
- **Standard Storage**: Frequently accessed files
- **Infrequent Access**: Files older than 30 days
- **Glacier/Deep Archive**: Files older than 1 year

## Sync Strategy

### Incremental Sync Pattern
```sql
-- Example sync query for modified records
SELECT * FROM food_logs 
WHERE user_id = $1 
  AND (last_synced_at IS NULL OR updated_at > last_synced_at)
ORDER BY logged_at DESC;
```

### Conflict Resolution Rules
- **Nutrition Goals**: Server wins (critical for accuracy)
- **Food Logs**: Last modified timestamp wins
- **User Preferences**: Client wins (better UX)
- **Subscription Data**: Server always wins

### Sync Frequency
- **Critical Data**: Real-time push on change
- **Important Data**: Every app launch + background sync
- **Analytics**: Batch upload every 24 hours

## Security & Privacy

### Row Level Security (RLS)
All tables implement RLS policies ensuring users can only access their own data.

### Media File Security
- Pre-signed URLs with 1-hour expiration
- Firebase Auth token validation required
- Encryption at rest and in transit

### Data Retention
- **Active Users**: Full data retention
- **Inactive Users (6+ months)**: Archive old media files
- **Deleted Accounts**: Complete data purge within 30 days

## Cost Analysis

### Monthly Cost Projection (per 1000 active users)
- **PostgreSQL Hosting**: $15-30 (Supabase/Neon)
- **Database Storage**: $5-15 (structured data)
- **S3/R2 Storage**: $10-20 (media files)
- **Data Transfer**: $5-15 (sync traffic)
- **Total Estimated**: $35-80/month

### Cost Optimization Features
- Automatic media compression
- Lifecycle policies for old content
- Delta sync (only changed data)
- CDN caching for static content

## Implementation Phases

### Phase 1: Core Sync (Weeks 1-2)
- User profiles and nutrition goals
- Food logs (nutritional data only)
- Weight history tracking

### Phase 2: Enhanced Features (Weeks 3-4)
- Exercise logs and step tracking
- User preferences and settings
- Subscription management

### Phase 3: Media Integration (Weeks 5-6)
- Future self message upload/download
- Food photo reference system
- Profile picture sync

### Phase 4: Analytics & Optimization (Weeks 7-8)
- User behavior tracking
- Performance optimization
- Advanced analytics queries

## Key Benefits

### For Users
- Seamless cross-device experience
- Data backup and recovery
- Faster app performance (cached data)
- Never lose progress when switching devices

### For Business
- Rich user behavior analytics
- Subscription conversion insights
- Scalable architecture for growth
- Professional data management
- 80%+ cost savings vs full database storage

## Migration Considerations

### From SQLite to PostgreSQL Sync
- Maintain existing offline-first architecture
- Add sync layer without disrupting core functionality
- Gradual migration of user data
- Fallback to local data if sync fails

### Data Mapping
- Firebase UID remains primary user identifier
- Preserve existing data relationships
- Add sync metadata to existing structures
- Maintain backward compatibility

This schema provides enterprise-level backup and sync capabilities while maintaining cost efficiency and your preferred offline-first approach. 