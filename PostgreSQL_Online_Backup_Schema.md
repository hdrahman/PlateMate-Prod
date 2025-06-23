# PlateMate PostgreSQL Online Backup Schema

## Overview
PlateMate's online backup system uses PostgreSQL for cross-device synchronization and external storage (S3/R2) for media files. This document outlines the complete schema structure, storage strategy, and implementation approach for cost-effective online backup.

## Database Information
- **Database Type**: PostgreSQL 15+
- **Recommended Providers**: Supabase, Neon, or AWS RDS
- **Authentication**: Firebase UID integration
- **Storage Strategy**: Hybrid (PostgreSQL + External Storage)
- **Estimated Cost**: $35-70/month per 1000 active users

## Data Classification Strategy

### TIER 1: CRITICAL SYNC DATA
**Must sync across devices - users would be upset if lost**
- User profiles & onboarding data
- Nutrition goals & daily targets  
- Food logs (nutritional data only)
- Weight history & progress tracking
- Subscription status & user streaks

### TIER 2: IMPORTANT SYNC DATA
**Should sync for better user experience**
- Exercise logs & daily steps
- User preferences & settings
- Cheat day configurations

### TIER 3: ANALYTICS & INSIGHTS
**Valuable for business intelligence**
- User behavior patterns
- Feature usage metrics
- Daily nutrition summaries
- Progress tracking analytics

### TIER 4: EXTERNAL STORAGE
**Cost-prohibitive to store in database**
- Food images (store URLs only)
- Future self voice/video messages
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
Core user profile and preference data.

**Columns:**
- `id`: UUID PRIMARY KEY (PostgreSQL generated)
- `firebase_uid`: VARCHAR(128) UNIQUE NOT NULL (links to Firebase Auth)
- `email`: VARCHAR(255) UNIQUE NOT NULL
- `first_name`: VARCHAR(100) NOT NULL
- `last_name`: VARCHAR(100)
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `last_active`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Profile Data:**
- `date_of_birth`: DATE
- `gender`: VARCHAR(20) CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say'))
- `height_cm`: DECIMAL(5,2)
- `current_weight_kg`: DECIMAL(5,2)
- `target_weight_kg`: DECIMAL(5,2)
- `starting_weight_kg`: DECIMAL(5,2)
- `age`: INTEGER
- `location`: VARCHAR(100)
- `timezone`: VARCHAR(50) DEFAULT 'UTC'

**Preferences:**
- `unit_preference`: VARCHAR(10) DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial'))
- `preferred_language`: VARCHAR(5) DEFAULT 'en'
- `dark_mode`: BOOLEAN DEFAULT FALSE

**Notifications:**
- `push_notifications_enabled`: BOOLEAN DEFAULT TRUE
- `email_notifications_enabled`: BOOLEAN DEFAULT TRUE
- `marketing_emails_enabled`: BOOLEAN DEFAULT TRUE

**Status:**
- `onboarding_complete`: BOOLEAN DEFAULT FALSE
- `is_active`: BOOLEAN DEFAULT TRUE
- `last_synced_at`: TIMESTAMP WITH TIME ZONE

### 2. user_health_profiles
Extended health and fitness profile information.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE

**Activity & Goals:**
- `activity_level`: VARCHAR(20) NOT NULL DEFAULT 'moderate' CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'))
- `fitness_goal`: VARCHAR(30) NOT NULL DEFAULT 'maintain'
- `weight_goal`: VARCHAR(20) NOT NULL DEFAULT 'maintain' CHECK (weight_goal IN ('lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'))

**Dietary Preferences:**
- `dietary_restrictions`: TEXT[] (Array of restrictions)
- `food_allergies`: TEXT[] (Array of allergies)
- `health_conditions`: TEXT[] (Array of conditions)
- `cuisine_preferences`: TEXT[] (Array of preferred cuisines)
- `spice_tolerance`: VARCHAR(20) DEFAULT 'medium'
- `diet_type`: VARCHAR(30) (keto, paleo, vegan, etc.)

**Lifestyle Data:**
- `weekly_workouts`: INTEGER DEFAULT 3
- `step_goal`: INTEGER DEFAULT 10000
- `water_goal_liters`: DECIMAL(4,2) DEFAULT 2.5
- `sleep_goal_hours`: DECIMAL(3,1) DEFAULT 8.0
- `eating_pattern`: VARCHAR(30) (regular, intermittent_fasting, etc.)
- `stress_level`: VARCHAR(20) DEFAULT 'medium'
- `sleep_quality`: VARCHAR(20) DEFAULT 'good'

**Motivation & Goals:**
- `motivations`: TEXT[] (Array of motivation factors)
- `why_motivation`: TEXT (User's personal why)
- `projected_completion_date`: DATE
- `estimated_duration_weeks`: INTEGER
- `estimated_metabolic_age`: INTEGER
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 3. nutrition_goals
User nutrition targets and daily goals.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `daily_calorie_goal`: INTEGER NOT NULL
- `protein_goal_g`: INTEGER NOT NULL
- `carb_goal_g`: INTEGER NOT NULL
- `fat_goal_g`: INTEGER NOT NULL
- `fiber_goal_g`: INTEGER DEFAULT 25
- `sodium_limit_mg`: INTEGER DEFAULT 2300
- `sugar_limit_g`: INTEGER DEFAULT 50
- `effective_from`: DATE NOT NULL DEFAULT CURRENT_DATE
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Constraints:**
- UNIQUE(user_id, effective_from)

### 4. weight_history
Historical weight tracking for progress monitoring.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `weight_kg`: DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0)
- `recorded_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `measurement_type`: VARCHAR(20) DEFAULT 'manual' (manual, scale_sync, estimated)
- `notes`: TEXT

### 5. food_logs
Comprehensive food logging with nutritional data (no image storage).

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE

**Food Identification:**
- `food_name`: VARCHAR(255) NOT NULL
- `brand_name`: VARCHAR(255)
- `meal_type`: VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
- `logged_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Quantity Information:**
- `quantity`: DECIMAL(8,2) NOT NULL DEFAULT 1
- `unit`: VARCHAR(20) NOT NULL DEFAULT 'serving' (g, ml, cup, serving, etc.)
- `weight_g`: DECIMAL(8,2) (Actual weight in grams)

**Macronutrients (per logged quantity):**
- `calories`: INTEGER NOT NULL CHECK (calories >= 0)
- `protein_g`: DECIMAL(6,2) NOT NULL DEFAULT 0
- `carbs_g`: DECIMAL(6,2) NOT NULL DEFAULT 0
- `fat_g`: DECIMAL(6,2) NOT NULL DEFAULT 0
- `fiber_g`: DECIMAL(6,2) DEFAULT 0
- `sugar_g`: DECIMAL(6,2) DEFAULT 0

**Fat Breakdown:**
- `saturated_fat_g`: DECIMAL(6,2) DEFAULT 0
- `polyunsaturated_fat_g`: DECIMAL(6,2) DEFAULT 0
- `monounsaturated_fat_g`: DECIMAL(6,2) DEFAULT 0
- `trans_fat_g`: DECIMAL(6,2) DEFAULT 0

**Micronutrients:**
- `cholesterol_mg`: DECIMAL(6,2) DEFAULT 0
- `sodium_mg`: DECIMAL(8,2) DEFAULT 0
- `potassium_mg`: DECIMAL(8,2) DEFAULT 0
- `vitamin_a_mcg`: DECIMAL(8,2) DEFAULT 0
- `vitamin_c_mg`: DECIMAL(6,2) DEFAULT 0
- `calcium_mg`: DECIMAL(8,2) DEFAULT 0
- `iron_mg`: DECIMAL(6,2) DEFAULT 0

**Metadata:**
- `healthiness_rating`: INTEGER CHECK (healthiness_rating BETWEEN 1 AND 10)
- `notes`: TEXT
- `image_url`: TEXT (Reference to external storage, not actual file)
- `fatsecret_food_id`: VARCHAR(50) (For API re-sync)
- `last_synced_at`: TIMESTAMP WITH TIME ZONE

### 6. user_subscriptions
Premium subscription management and tracking.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `subscription_status`: VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'trial'))
- `subscription_tier`: VARCHAR(20) DEFAULT 'basic' (basic, premium, pro)
- `start_date`: TIMESTAMP WITH TIME ZONE NOT NULL
- `end_date`: TIMESTAMP WITH TIME ZONE
- `trial_ends_at`: TIMESTAMP WITH TIME ZONE
- `canceled_at`: TIMESTAMP WITH TIME ZONE
- `auto_renew`: BOOLEAN DEFAULT FALSE
- `payment_method`: VARCHAR(50) (stripe, apple, google)
- `external_subscription_id`: VARCHAR(255) (Stripe/Apple/Google ID)
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 7. user_streaks
Gamification and streak tracking for user engagement.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `streak_type`: VARCHAR(30) NOT NULL (daily_log, exercise, water_intake)
- `current_streak`: INTEGER DEFAULT 0
- `longest_streak`: INTEGER DEFAULT 0
- `last_activity_date`: DATE
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Constraints:**
- UNIQUE(user_id, streak_type)

### 8. exercise_logs
Exercise and workout tracking.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `exercise_name`: VARCHAR(255) NOT NULL
- `exercise_type`: VARCHAR(50) (cardio, strength, flexibility, sports)
- `duration_minutes`: INTEGER NOT NULL CHECK (duration_minutes > 0)
- `calories_burned`: INTEGER CHECK (calories_burned >= 0)
- `intensity`: VARCHAR(20) (low, moderate, high, vigorous)
- `notes`: TEXT
- `logged_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 9. daily_steps
Daily step count tracking with data source attribution.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `date`: DATE NOT NULL
- `step_count`: INTEGER NOT NULL DEFAULT 0 CHECK (step_count >= 0)
- `calories_burned`: INTEGER DEFAULT 0
- `distance_km`: DECIMAL(6,2) DEFAULT 0
- `source`: VARCHAR(30) DEFAULT 'manual' (manual, apple_health, google_fit, fitbit)
- `recorded_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Constraints:**
- UNIQUE(user_id, date)

### 10. cheat_day_settings
Cheat day scheduling and management preferences.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `enabled`: BOOLEAN DEFAULT TRUE
- `frequency_days`: INTEGER DEFAULT 7 (Every N days)
- `preferred_day_of_week`: INTEGER CHECK (preferred_day_of_week BETWEEN 0 AND 6) (0=Sunday, 6=Saturday)
- `last_cheat_day`: DATE
- `next_scheduled_date`: DATE
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 11. future_self_messages
Future self motivation messages with external media references.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `message_type`: VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'voice', 'video'))
- `text_content`: TEXT (For text messages)
- `media_url`: TEXT (S3/R2 URL for voice/video)
- `media_key`: VARCHAR(255) (Storage key for management)
- `file_size_bytes`: BIGINT
- `duration_seconds`: INTEGER
- `mime_type`: VARCHAR(50)
- `play_count`: INTEGER DEFAULT 0
- `last_played_at`: TIMESTAMP WITH TIME ZONE
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Constraints:**
- CHECK: Either text_content OR media_url must be provided based on message_type

### 12. user_analytics
User behavior tracking for insights and optimization.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `event_type`: VARCHAR(50) NOT NULL (app_open, food_logged, recipe_viewed, etc.)
- `event_data`: JSONB (Flexible event metadata)
- `session_id`: UUID
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

### 13. daily_nutrition_summaries
Aggregated daily nutrition data for performance optimization.

**Columns:**
- `id`: UUID PRIMARY KEY
- `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
- `date`: DATE NOT NULL
- `total_calories`: INTEGER DEFAULT 0
- `total_protein_g`: DECIMAL(8,2) DEFAULT 0
- `total_carbs_g`: DECIMAL(8,2) DEFAULT 0
- `total_fat_g`: DECIMAL(8,2) DEFAULT 0
- `total_fiber_g`: DECIMAL(8,2) DEFAULT 0
- `meals_logged`: INTEGER DEFAULT 0
- `goal_adherence_score`: DECIMAL(5,2) (Percentage of goals met)
- `created_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `updated_at`: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Constraints:**
- UNIQUE(user_id, date)

## Indexes for Performance

### Primary User Lookups
- `idx_users_firebase_uid`: ON users(firebase_uid)
- `idx_users_email`: ON users(email)
- `idx_users_active`: ON users(is_active) WHERE is_active = TRUE

### Food Logs (Most Queried Table)
- `idx_food_logs_user_date`: ON food_logs(user_id, logged_at DESC)
- `idx_food_logs_meal_type`: ON food_logs(user_id, meal_type, logged_at DESC)

### Weight History
- `idx_weight_history_user_date`: ON weight_history(user_id, recorded_at DESC)

### Exercise & Activity
- `idx_exercise_logs_user_date`: ON exercise_logs(user_id, logged_at DESC)
- `idx_daily_steps_user_date`: ON daily_steps(user_id, date DESC)

### Analytics
- `idx_analytics_user_date`: ON user_analytics(user_id, created_at)
- `idx_analytics_event_type`: ON user_analytics(event_type)

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