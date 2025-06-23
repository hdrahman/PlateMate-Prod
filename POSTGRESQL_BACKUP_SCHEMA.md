# PlateMate PostgreSQL Online Backup Schema
## Executive Summary

This document outlines a cost-effective PostgreSQL schema designed for cross-device synchronization and analytics while minimizing storage costs. The strategy separates essential user data (stored in PostgreSQL) from large media files (stored in external services).

## Data Classification

### **TIER 1: CRITICAL (Must Sync Across Devices)**
- User profiles & preferences
- Nutrition goals & progress
- Food logs (nutritional data only)
- Weight history
- Subscription status
- User streaks & gamification data

### **TIER 2: IMPORTANT (Should Sync for Better UX)**
- Exercise logs
- Daily steps
- Cheat day settings
- User preferences & settings

### **TIER 3: ANALYTICS (Valuable for Business Insights)**
- Aggregated nutrition patterns
- Feature usage analytics
- User behavior metrics
- Performance tracking

### **TIER 4: EXTERNAL STORAGE (Cost-Prohibitive in DB)**
- Food images (`image_url` references only)
- Future self voice/video messages
- Recipe images
- Profile photos

## Storage Strategy

### PostgreSQL Database (Primary)
- All structured data
- Text-based user content
- Nutritional data
- References/URLs to external media

### External Storage (AWS S3/Cloudflare R2)
- Voice messages (.m4a, .mp3)
- Video messages (.mp4, .mov) 
- Food photos
- Profile images
- Recipe images

**Cost Estimates:**
- PostgreSQL: ~$0.10/GB/month (Supabase/Neon)
- S3 Storage: ~$0.023/GB/month
- S3 Bandwidth: ~$0.09/GB transfer

## PostgreSQL Schema Design

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TIER 1: CRITICAL USER DATA
-- =============================================

-- Users table (core profile data)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Basic profile
    date_of_birth DATE,
    gender VARCHAR(20),
    height_cm DECIMAL(5,2),
    current_weight_kg DECIMAL(5,2),
    target_weight_kg DECIMAL(5,2),
    starting_weight_kg DECIMAL(5,2),
    age INTEGER,
    location VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Preferences
    unit_preference VARCHAR(10) DEFAULT 'metric', -- 'metric' or 'imperial'
    preferred_language VARCHAR(5) DEFAULT 'en',
    dark_mode BOOLEAN DEFAULT FALSE,
    
    -- Notifications
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    marketing_emails_enabled BOOLEAN DEFAULT TRUE,
    
    -- Onboarding & Status
    onboarding_complete BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
    CONSTRAINT users_unit_check CHECK (unit_preference IN ('metric', 'imperial'))
);

-- User health & fitness profile
CREATE TABLE user_health_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Activity & Goals
    activity_level VARCHAR(20) NOT NULL DEFAULT 'moderate',
    fitness_goal VARCHAR(30) NOT NULL DEFAULT 'maintain',
    weight_goal VARCHAR(20) NOT NULL DEFAULT 'maintain',
    
    -- Health conditions & dietary
    dietary_restrictions TEXT[], -- Array of restrictions
    food_allergies TEXT[], -- Array of allergies  
    health_conditions TEXT[], -- Array of conditions
    cuisine_preferences TEXT[], -- Array of preferred cuisines
    spice_tolerance VARCHAR(20) DEFAULT 'medium',
    diet_type VARCHAR(30), -- 'keto', 'paleo', 'vegan', etc.
    
    -- Lifestyle
    weekly_workouts INTEGER DEFAULT 3,
    step_goal INTEGER DEFAULT 10000,
    water_goal_liters DECIMAL(4,2) DEFAULT 2.5,
    sleep_goal_hours DECIMAL(3,1) DEFAULT 8.0,
    eating_pattern VARCHAR(30), -- 'regular', 'intermittent_fasting', etc.
    stress_level VARCHAR(20) DEFAULT 'medium',
    sleep_quality VARCHAR(20) DEFAULT 'good',
    
    -- Motivation & Goals
    motivations TEXT[], -- Array of motivation factors
    why_motivation TEXT, -- User's personal why
    projected_completion_date DATE,
    estimated_duration_weeks INTEGER,
    estimated_metabolic_age INTEGER,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT health_activity_check CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    CONSTRAINT health_weight_goal_check CHECK (weight_goal IN ('lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'))
);

-- Nutrition goals
CREATE TABLE nutrition_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    daily_calorie_goal INTEGER NOT NULL,
    protein_goal_g INTEGER NOT NULL,
    carb_goal_g INTEGER NOT NULL,
    fat_goal_g INTEGER NOT NULL,
    fiber_goal_g INTEGER DEFAULT 25,
    
    -- Optional micronutrient goals
    sodium_limit_mg INTEGER DEFAULT 2300,
    sugar_limit_g INTEGER DEFAULT 50,
    
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, effective_from)
);

-- Weight history (critical for progress tracking)
CREATE TABLE weight_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    weight_kg DECIMAL(5,2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    measurement_type VARCHAR(20) DEFAULT 'manual', -- 'manual', 'scale_sync', 'estimated'
    notes TEXT,
    
    CONSTRAINT weight_positive CHECK (weight_kg > 0)
);

-- Food logs (nutritional data only, no images)
CREATE TABLE food_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Food identification
    food_name VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255),
    meal_type VARCHAR(20) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Quantity
    quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) NOT NULL DEFAULT 'serving', -- 'g', 'ml', 'cup', 'serving', etc.
    weight_g DECIMAL(8,2), -- Actual weight in grams
    
    -- Nutrition (per logged quantity)
    calories INTEGER NOT NULL,
    protein_g DECIMAL(6,2) NOT NULL DEFAULT 0,
    carbs_g DECIMAL(6,2) NOT NULL DEFAULT 0,
    fat_g DECIMAL(6,2) NOT NULL DEFAULT 0,
    fiber_g DECIMAL(6,2) DEFAULT 0,
    sugar_g DECIMAL(6,2) DEFAULT 0,
    
    -- Fat breakdown
    saturated_fat_g DECIMAL(6,2) DEFAULT 0,
    polyunsaturated_fat_g DECIMAL(6,2) DEFAULT 0,
    monounsaturated_fat_g DECIMAL(6,2) DEFAULT 0,
    trans_fat_g DECIMAL(6,2) DEFAULT 0,
    
    -- Micronutrients (in mg unless specified)
    cholesterol_mg DECIMAL(6,2) DEFAULT 0,
    sodium_mg DECIMAL(8,2) DEFAULT 0,
    potassium_mg DECIMAL(8,2) DEFAULT 0,
    vitamin_a_mcg DECIMAL(8,2) DEFAULT 0,
    vitamin_c_mg DECIMAL(6,2) DEFAULT 0,
    calcium_mg DECIMAL(8,2) DEFAULT 0,
    iron_mg DECIMAL(6,2) DEFAULT 0,
    
    -- Metadata
    healthiness_rating INTEGER CHECK (healthiness_rating BETWEEN 1 AND 10),
    notes TEXT,
    
    -- External references (not actual file storage)
    image_url TEXT, -- Reference to external storage
    fatsecret_food_id VARCHAR(50), -- For API re-sync
    
    CONSTRAINT food_logs_meal_type_check CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    CONSTRAINT food_logs_calories_positive CHECK (calories >= 0)
);

-- User subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'free',
    subscription_tier VARCHAR(20) DEFAULT 'basic', -- 'basic', 'premium', 'pro'
    
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    auto_renew BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50), -- 'stripe', 'apple', 'google'
    external_subscription_id VARCHAR(255), -- Stripe/Apple/Google ID
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sub_status_check CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'trial'))
);

-- User streaks & gamification
CREATE TABLE user_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    streak_type VARCHAR(30) NOT NULL, -- 'daily_log', 'exercise', 'water_intake'
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, streak_type)
);

-- =============================================
-- TIER 2: IMPORTANT SYNC DATA
-- =============================================

-- Exercise logs
CREATE TABLE exercise_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    exercise_name VARCHAR(255) NOT NULL,
    exercise_type VARCHAR(50), -- 'cardio', 'strength', 'flexibility', 'sports'
    duration_minutes INTEGER NOT NULL,
    calories_burned INTEGER,
    
    -- Optional details
    intensity VARCHAR(20), -- 'low', 'moderate', 'high', 'vigorous'
    notes TEXT,
    
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT exercise_duration_positive CHECK (duration_minutes > 0),
    CONSTRAINT exercise_calories_positive CHECK (calories_burned >= 0)
);

-- Daily step tracking
CREATE TABLE daily_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    step_count INTEGER NOT NULL DEFAULT 0,
    calories_burned INTEGER DEFAULT 0,
    distance_km DECIMAL(6,2) DEFAULT 0,
    
    -- Data source tracking
    source VARCHAR(30) DEFAULT 'manual', -- 'manual', 'apple_health', 'google_fit', 'fitbit'
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date),
    CONSTRAINT steps_positive CHECK (step_count >= 0)
);

-- Cheat day settings
CREATE TABLE cheat_day_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    enabled BOOLEAN DEFAULT TRUE,
    frequency_days INTEGER DEFAULT 7, -- Every N days
    preferred_day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    
    last_cheat_day DATE,
    next_scheduled_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT cheat_day_dow_check CHECK (preferred_day_of_week BETWEEN 0 AND 6)
);

-- =============================================
-- TIER 3: EXTERNAL MEDIA REFERENCES
-- =============================================

-- Future self messages (references to external storage)
CREATE TABLE future_self_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    message_type VARCHAR(20) NOT NULL, -- 'text', 'voice', 'video'
    
    -- For text messages
    text_content TEXT,
    
    -- For voice/video messages (external storage references)
    media_url TEXT, -- S3/R2 URL
    media_key VARCHAR(255), -- Storage key for management
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    mime_type VARCHAR(50),
    
    -- Usage tracking
    play_count INTEGER DEFAULT 0,
    last_played_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT message_type_check CHECK (message_type IN ('text', 'voice', 'video')),
    CONSTRAINT text_or_media_check CHECK (
        (message_type = 'text' AND text_content IS NOT NULL AND media_url IS NULL) OR
        (message_type IN ('voice', 'video') AND media_url IS NOT NULL AND text_content IS NULL)
    )
);

-- =============================================
-- TIER 4: ANALYTICS & INSIGHTS
-- =============================================

-- User behavior analytics
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- 'app_open', 'food_logged', 'recipe_viewed', etc.
    event_data JSONB, -- Flexible event metadata
    session_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggregated nutrition summaries (for performance)
CREATE TABLE daily_nutrition_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    
    total_calories INTEGER DEFAULT 0,
    total_protein_g DECIMAL(8,2) DEFAULT 0,
    total_carbs_g DECIMAL(8,2) DEFAULT 0,
    total_fat_g DECIMAL(8,2) DEFAULT 0,
    total_fiber_g DECIMAL(8,2) DEFAULT 0,
    
    meals_logged INTEGER DEFAULT 0,
    goal_adherence_score DECIMAL(5,2), -- Percentage of goals met
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User lookups
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- Food logs (most queried table)
CREATE INDEX idx_food_logs_user_date ON food_logs(user_id, logged_at DESC);
CREATE INDEX idx_food_logs_meal_type ON food_logs(user_id, meal_type, logged_at DESC);

-- Weight history
CREATE INDEX idx_weight_history_user_date ON weight_history(user_id, recorded_at DESC);

-- Exercise logs
CREATE INDEX idx_exercise_logs_user_date ON exercise_logs(user_id, logged_at DESC);

-- Steps
CREATE INDEX idx_daily_steps_user_date ON daily_steps(user_id, date DESC);

-- Analytics
CREATE INDEX idx_analytics_user_date ON user_analytics(user_id, created_at);
CREATE INDEX idx_analytics_event_type ON user_analytics(event_type);
```

## External Storage Strategy

### AWS S3/Cloudflare R2 Structure
```
platemate-media/
├── users/
│   └── {firebase_uid}/
│       ├── future-self/
│       │   ├── voice/
│       │   │   └── {message_id}.m4a
│       │   └── video/
│       │       └── {message_id}.mp4
│       ├── food-photos/
│       │   └── {year}/{month}/
│       │       └── {food_log_id}.jpg
│       └── profile/
│           └── avatar.jpg
└── recipes/
    └── fallback-images/
        └── {category}/
            └── {image_name}.jpg
```

### Cost Optimization Features

1. **Tiered Storage**
   - Frequently accessed: Standard storage
   - Older content: Infrequent Access (IA)
   - Archive old data: Glacier/Deep Archive

2. **Compression**
   - Voice: AAC compression (~50KB/minute)
   - Video: H.264 with appropriate bitrate
   - Images: WebP format with quality optimization

3. **CDN Integration**
   - CloudFront/Cloudflare for global delivery
   - Edge caching for static content

## Sync Strategy

### Incremental Sync
```sql
-- Sync tracking columns (add to each table)
ALTER TABLE users ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE food_logs ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;

-- Sync query example
SELECT * FROM food_logs 
WHERE user_id = $1 
  AND (last_synced_at IS NULL OR updated_at > last_synced_at);
```

### Conflict Resolution
- Last-write-wins for most data
- Special handling for critical data (nutrition goals, subscriptions)
- Client-side optimistic updates with server reconciliation

## Migration Plan

### Phase 1: Core Sync (Week 1-2)
- User profiles
- Nutrition goals
- Food logs (text data only)
- Weight history

### Phase 2: Enhanced Features (Week 3-4)
- Exercise logs
- Daily summaries
- User preferences
- Subscription management

### Phase 3: Media Integration (Week 5-6)
- External storage setup
- Future self messages
- Image reference system

### Phase 4: Analytics (Week 7-8)
- User behavior tracking
- Performance optimization
- Advanced analytics queries

## Cost Projections

### Per 1000 Active Users/Month:
- **PostgreSQL Storage**: ~$15-30/month
- **S3 Storage**: ~$10-20/month  
- **Data Transfer**: ~$5-15/month
- **Total**: ~$30-65/month

### Optimization Strategies:
1. **Data Retention Policies**
   - Archive food logs older than 2 years
   - Compress/delete large media files after inactivity

2. **Smart Sync**
   - Only sync recent data on login
   - Background sync for historical data

3. **Compression**
   - JSONB for flexible data storage
   - Efficient indexing strategies

This schema provides a solid foundation for cross-device sync while maintaining cost efficiency and scalability for future growth. 