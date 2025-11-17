# PlateMate - Complete Project Overview

**Version:** 1.0.0  
**Last Updated:** November 13, 2025  
**Project Type:** Full-Stack Mobile Application (React Native + FastAPI)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Core Features](#core-features)
5. [Backend Services](#backend-services)
6. [Frontend Application](#frontend-application)
7. [Database Architecture](#database-architecture)
8. [Authentication & Security](#authentication--security)
9. [AI & Machine Learning Integration](#ai--machine-learning-integration)
10. [Subscription & Monetization](#subscription--monetization)
11. [Performance & Scalability](#performance--scalability)
12. [Development & Deployment](#development--deployment)
13. [Testing Strategy](#testing-strategy)
14. [Future Roadmap](#future-roadmap)

---

## Executive Summary

PlateMate is an intelligent nutrition tracking and meal planning application that leverages AI to help users achieve their health and fitness goals. The app combines computer vision, natural language processing, and nutritional databases to provide personalized coaching, automated food logging via photos, and comprehensive meal planning capabilities.

**Key Value Propositions:**
- 📸 **AI-Powered Food Recognition**: Take photos of meals and get instant nutritional analysis
- 🤖 **Personal Nutrition Coach**: AI-driven coaching using DeepSeek V3 and GPT-4
- 📊 **Comprehensive Tracking**: Calories, macros, micronutrients, water, steps, and health data
- 🍽️ **Smart Meal Planning**: Recipe discovery with customizable meal plans
- 📈 **Analytics & Insights**: Advanced progress tracking with visual analytics
- 🔄 **Offline-First**: Full functionality without internet connection
- 🎯 **Goal-Oriented**: Personalized targets based on fitness goals and activity levels

---

## Technology Stack

### Frontend (Mobile Application)
- **Framework**: React Native 0.81.4 with Expo 54.0.0
- **Language**: TypeScript 5.9.2 & JavaScript
- **Navigation**: React Navigation 7.x (Native Stack, Bottom Tabs, Stack)
- **State Management**: React Context API + Custom Hooks
- **Local Database**: Expo SQLite (version 16.0.8)
- **UI Components**: 
  - React Native Paper 5.13.1
  - Expo Linear Gradient
  - Lottie React Native
  - React Native Chart Kit
  - Custom gradient components

### Backend (API Server)
- **Framework**: FastAPI 0.104.1
- **Runtime**: Python 3.x with Uvicorn 0.24.0
- **Authentication**: Supabase Auth with JWT
- **Database**: PostgreSQL (via Supabase)
- **Caching**: Redis 4.5.0+ with hiredis
- **Rate Limiting**: Redis-backed Lua scripts
- **HTTP Client**: httpx 0.25.0+ for async requests

### AI & Machine Learning
- **Computer Vision**: OpenAI GPT-4 Vision API
- **Natural Language**: 
  - DeepSeek V3 (primary AI coach)
  - OpenAI GPT-4 (secondary)
  - Custom prompting systems
- **Nutritional Data**: FatSecret API (food & recipe database)

### Cloud Services & Infrastructure
- **Backend Hosting**: Render.com
- **Database**: Supabase (PostgreSQL + Real-time + Auth)
- **File Storage**: Supabase Storage (for meal images)
- **Subscriptions**: RevenueCat (iOS/Android IAP management)
- **Notifications**: Expo Notifications + Notifee (Android)
- **Health Data**: Apple HealthKit, Google Fit integration

### Development Tools
- **Version Control**: Git
- **Package Managers**: npm (Frontend), pip (Backend)
- **Testing**: Jest (Frontend), pytest (Backend)
- **Build System**: Expo EAS (Expo Application Services)
- **Code Quality**: ESLint, patch-package for dependency patches

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │         React Native Mobile App (iOS/Android)       │     │
│  │  - Offline-first with SQLite                        │     │
│  │  - Background step tracking                         │     │
│  │  - Camera integration                               │     │
│  │  - Push notifications                               │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY LAYER                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │              FastAPI Backend Server                 │     │
│  │  - Rate limiting (Redis)                            │     │
│  │  - JWT authentication                               │     │
│  │  - Request validation                               │     │
│  │  - AI operation limiter                             │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   OpenAI     │  │  DeepSeek    │  │  FatSecret   │      │
│  │   GPT-4      │  │   V3 AI      │  │  Food API    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  RevenueCat  │  │  Supabase    │  │    Redis     │      │
│  │ Subscription │  │   Storage    │  │   Caching    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    SQLite    │  │    Redis     │      │
│  │  (Supabase)  │  │   (Device)   │  │   (Cache)    │      │
│  │   - Users    │  │ - Food logs  │  │ - Sessions   │      │
│  │   - Health   │  │ - Profiles   │  │ - Rate limits│      │
│  │   - Features │  │ - Weights    │  │ - VIP status │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Patterns

**1. Offline-First Architecture**
- All user data stored in local SQLite
- Background sync when internet available
- Optimistic UI updates
- Conflict resolution on sync

**2. Authentication Flow**
- Supabase JWT tokens
- Token caching with automatic refresh
- Biometric authentication support
- Session persistence

**3. AI Request Flow**
- Rate limiting (30 AI requests/hour/user)
- Concurrent operation limiting (100 max)
- Request queuing and retry logic
- Graceful degradation on failures

---

## Core Features

### 1. Food Logging & Tracking

**AI-Powered Photo Logging**
- Take photos of meals using device camera
- Automatic food recognition via GPT-4 Vision
- Nutritional analysis with detailed breakdown
- Support for multiple items per photo
- HEIC/HEIF image format support

**Manual Food Entry**
- Search 500,000+ foods from FatSecret database
- Barcode scanning for packaged foods
- Custom food creation
- Portion size adjustment
- Meal type categorization (breakfast, lunch, dinner, snacks)

**Nutritional Tracking**
- **Macronutrients**: Calories, protein, carbohydrates, fats
- **Micronutrients**: Fiber, sugar, saturated fat, cholesterol, sodium, potassium
- **Vitamins & Minerals**: Vitamin A, Vitamin C, calcium, iron
- Daily goal tracking with visual progress rings
- Historical data with charts and trends

### 2. Meal Planning & Recipes

**Recipe Discovery**
- Search 100,000+ recipes from FatSecret API
- Filter by cuisine, diet type, cooking time
- Nutritional information per serving
- Ingredient lists and cooking instructions
- Save favorite recipes

**Meal Planning**
- Generate meal plans based on caloric targets
- Customize by dietary restrictions (vegan, keto, gluten-free, etc.)
- Daily/weekly meal plan views
- Shopping list generation
- Recipe substitutions

**Smart Recommendations**
- AI-suggested recipes based on goals
- Balanced meal suggestions
- Ingredient-based recipe search
- Meal history tracking

### 3. AI Nutrition Coaching

**DeepSeek V3 Integration**
- Personalized nutrition coaching
- Daily check-ins with motivational messages
- Analysis of eating patterns
- Goal-oriented advice
- Context-aware conversations (knows your profile, goals, progress)

**Chat Features**
- Natural language queries about nutrition
- Recipe suggestions
- Meal timing advice
- Macro distribution recommendations
- Food substitution suggestions

**GPT-4 Fallback**
- Secondary AI for complex queries
- Image analysis capabilities
- Detailed food descriptions
- Healthiness ratings (1-10 scale)

### 4. Health & Fitness Tracking

**Step Tracking**
- Always-on background step counting
- Native Android sensor integration
- Apple HealthKit integration (iOS)
- Daily step goals with progress
- Historical step data charts
- Works even when app is closed

**Weight Management**
- Daily weight logging
- Weight trend visualization
- Progress photos
- Goal weight tracking
- Projected completion dates

**Health Data Integration**
- Import data from Apple Health
- Import data from Google Fit
- Sync workouts and activities
- Heart rate data (future)
- Sleep tracking (future)

### 5. Analytics & Insights

**Dashboard**
- Daily calorie/macro summary
- Visual progress rings
- Streak tracking
- Goal achievement indicators
- Quick meal logging shortcuts

**Advanced Analytics**
- Weekly/monthly nutrition trends
- Macro distribution pie charts
- Weight loss/gain progress graphs
- Calorie deficit/surplus tracking
- Nutrient intake patterns
- Meal timing analysis

**Reports**
- Detailed nutrition reports
- Goal achievement summaries
- Export data to CSV
- Share progress with coach/trainer

### 6. Onboarding & Personalization

**Incremental Onboarding System**
- Progressive data collection (saves after each step)
- No data loss if app crashes
- Works before user authentication
- 14-step comprehensive profile building

**Profile Information**
- Personal details (age, gender, height, weight)
- Fitness goals (lose/gain weight, maintain, build muscle)
- Activity level assessment
- Dietary restrictions and allergies
- Food preferences and cuisine types
- Health conditions
- Target weight and timeline
- Motivations and "future self" message recording

**Goal Calculation**
- BMR (Basal Metabolic Rate) calculation
- TDEE (Total Daily Energy Expenditure)
- Macro targets (protein, carbs, fats)
- Caloric deficit/surplus recommendations
- Projected completion dates

### 7. Community Features

**Feature Request System**
- Submit feature suggestions
- Upvote/downvote community requests
- View feature leaderboard
- Track features in development
- See your submitted requests
- Real-time updates on feature status
- Admin panel for status management

**Social Features (Future)**
- Share meals with friends
- Recipe sharing
- Challenge participation
- Community recipes

### 8. Premium Subscription

**Free Tier**
- 20-day promotional trial (automatic)
- Basic food logging
- Manual food entry
- Recipe search
- Limited AI queries

**Premium Tier (VIP)**
- Extended 30-day trial (+10 days on subscription)
- Unlimited AI coaching
- Advanced analytics
- Meal planning
- Priority support
- Export features
- Ad-free experience

**Subscription Management**
- RevenueCat integration
- iOS App Store IAP
- Google Play Store IAP
- Automatic trial granting
- VIP user system (lifetime premium for select users)
- Subscription status caching

---

## Backend Services

### API Endpoints

The backend exposes a comprehensive REST API organized into the following modules:

#### 1. Authentication & User Management (`/api/auth`)
- Token validation and refresh
- User profile CRUD operations
- Password reset flow
- Account deletion
- Debug endpoints for auth troubleshooting

#### 2. Food Search & Details (`/food`)
```
POST /food/search - Search foods by query
POST /food/details - Get detailed nutritional info
POST /food/barcode - Search by barcode
GET /food/health - FatSecret API health check
```

#### 3. Recipe Management (`/recipes`)
```
GET /recipes/search - Search recipes with filters
POST /recipes/meal-plan - Generate meal plans
GET /recipes/random - Get random recipes
POST /recipes/details - Get recipe details
GET /recipes/autocomplete - Recipe name suggestions
GET /recipes/ingredient-autocomplete - Ingredient suggestions
```

#### 4. AI Services

**DeepSeek V3 (`/deepseek`)**
```
POST /deepseek/get-token - Get API token
POST /deepseek/nutrition-analysis - Analyze nutrition data
POST /deepseek/chat - General chat
POST /deepseek/chat-with-context - Context-aware chat
```

**OpenAI GPT-4 (`/gpt`)**
```
POST /gpt/get-token - Get API token
POST /gpt/analyze-food - Analyze food images
POST /gpt/analyze-meal - Analyze meal composition
POST /gpt/estimate-nutrition - Estimate nutritional values
```

#### 5. Image Processing (`/images`)
```
POST /images/upload-image - Upload single image
POST /images/upload-multiple-images - Batch upload
POST /images/analyze - AI image analysis
```
- HEIC/HEIF to JPEG conversion
- Image compression and optimization
- Base64 encoding for API transmission
- Format detection and validation

#### 6. Health Data (`/health`)
```
GET /health/rate-limiting - Rate limit system health
GET /health/rate-limiting/config - Rate limit configuration
```

#### 7. Subscription Management (`/api/subscription`)
```
GET /api/subscription/status - Get user subscription status
POST /api/subscription/grant-promotional-trial - Grant 20-day trial
POST /api/subscription/grant-extended-trial - Grant +10 day extension
GET /api/subscription/check-vip - Check VIP status
POST /api/subscription/webhook - RevenueCat webhook handler
```

#### 8. Feature Requests (`/api/feature-requests`)
```
POST /api/feature-requests - Create request
GET /api/feature-requests - List all requests
GET /api/feature-requests/my-requests - User's requests
POST /api/feature-requests/{id}/upvote - Toggle upvote
PUT /api/feature-requests/{id} - Update request
DELETE /api/feature-requests/{id} - Delete request
PUT /api/feature-requests/{id}/status - Update status (admin)
GET /api/feature-requests/stats - Get statistics
```

### Service Architecture

#### Connection Pooling
- HTTP connection reuse for external APIs
- Configurable pool sizes and timeouts
- Automatic connection cleanup
- Response caching for repeated requests

#### Rate Limiting System
```python
RATE_LIMITS = {
    "search": {
        "limit": 100,      # requests per minute
        "burst": 25,       # burst allowance
        "window": 60,      # seconds
        "cooldown": [5, 10, 60, 300]  # escalating cooldowns
    },
    "ai": {
        "limit": 30,       # requests per hour
        "burst": 5,        # burst allowance
        "window": 3600,    # seconds
        "cooldown": [30, 60, 300, 1800]
    },
    "general": {
        "limit": 1000,     # requests per hour
        "burst": 100,      # burst allowance
        "window": 3600,    # seconds
        "cooldown": [10, 30, 300]
    }
}
```

**Features:**
- Redis-backed rate limiting
- Lua script for atomic operations
- Per-user and per-IP limits
- Escalating cooldowns for repeated violations
- Endpoint-specific limits
- Real-time monitoring

#### AI Operation Limiter
- **Default**: 100 concurrent AI operations
- Prevents memory exhaustion
- Queuing system for excess requests
- Configurable via `AI_OPERATION_LIMIT` env variable
- Statistics tracking (active/total operations)

#### Redis Caching
- **VIP status caching**: 24-hour TTL
- **Auth token caching**: 1-hour TTL
- **API response caching**: Variable TTL
- Automatic cache invalidation
- Cache hit/miss statistics

#### FatSecret API Integration
- OAuth 2.0 authentication
- Automatic token refresh
- Request retry logic
- Response caching (1-hour TTL)
- Search optimization
- Barcode scanning support

---

## Frontend Application

### Screen Architecture

The app contains **48 screens** organized into several navigation stacks:

#### Main Navigation (Bottom Tabs)
1. **Home** - Dashboard with daily summary
2. **FoodLog** - Meal logging and history
3. **Explore** - Recipe discovery and meal planning
4. **Analytics** - Charts and progress tracking
5. **Chatbot** - AI nutrition coach

#### Authentication Flow
- **Auth** - Login/signup screen
- **ForgotPassword** - Password reset request
- **ResetPassword** - New password entry
- **Onboarding** - 14-step profile setup

#### Food Logging Stack
- **ImageCapture** - Camera screen for meal photos
- **Scanner** - Barcode scanner
- **Manual** - Manual food entry
- **SearchResults** - Food search results
- **FoodDetail** - Detailed food information
- **BarcodeResults** - Barcode scan results
- **ScannedProduct** - Scanned product details
- **Nutrients** - Detailed nutrient breakdown
- **NutritionFactsResult** - Nutrition label display

#### Meal Planning Stack
- **MealPlanner** - Meal planning home
- **MealPlannerCamera** - Recipe photo capture
- **MealPlannerResults** - Meal analysis results
- **RecipeResults** - Recipe search results
- **RecipeDetails** - Recipe instructions
- **MealGallery** - Saved meals gallery

#### Profile & Settings Stack
- **Settings** - App settings hub
- **EditProfile** - Profile editor
- **EditGoals** - Goal modification
- **GoalsScreen** - Goal overview
- **ProfileScreen** - User profile view
- **SubscriptionManagementScreen** - Manage subscription
- **PremiumSubscription** - Premium upgrade screen
- **DataSharing** - Data sync settings
- **SyncSettings** - Sync configuration
- **Notifications** - Notification preferences
- **StepTrackingSettings** - Step tracking config
- **BackgroundServicesSettings** - Background service controls

#### Support & Information Stack
- **Support** - Help and support
- **AboutUs** - About the app
- **AboutCalculations** - Explanation of calculations
- **PrivacyPolicy** - Privacy policy
- **LegalTerms** - Terms of service

#### Account Management Stack
- **ChangePassword** - Password change
- **DeleteAccount** - Account deletion
- **DeleteAccountScreen** - Deletion confirmation
- **Logout** - Sign out

#### Community Stack
- **FeatureRequests** - Feature request leaderboard
- **CreateFeatureRequest** - Submit feature request

#### Special Features
- **FutureSelfRecordingSimple** - Record motivational message
- **WeightLossChartDemo** - Weight projection demo

### Context Providers

The app uses React Context API for state management:

1. **AuthContext** - User authentication state
2. **OnboardingContext** - Onboarding progress tracking
3. **ThemeContext** - Dark/light mode
4. **StepContext** - Step tracking data
5. **FavoritesContext** - Favorite recipes/foods
6. **FoodLogContext** - Food log operations

### Services & Utilities

#### Background Services
- **UnifiedStepTracker** - Cross-platform step tracking
- **PersistentStepTracker** - Foreground service for Android
- **Native sensor integration** (Android only)
- **HealthKit integration** (iOS only)

#### Data Management
- **Database utilities** - SQLite operations
- **Sync manager** - Cloud sync orchestration
- **Token manager** - JWT token handling
- **Subscription manager** - RevenueCat integration

#### API Clients
- **Supabase client** - Database and auth
- **API service** - Backend communication
- **Feature API** - Feature requests
- **Image upload** - Photo handling

### UI Components

**Custom Components:**
- LoadingScreen - App initialization
- GlobalErrorBoundary - Error handling
- StepErrorBoundary - Step tracking errors
- FeatureRequestCard - Feature display cards
- Gradient components - Custom gradients
- Chart components - Analytics visualizations

**Third-Party Libraries:**
- React Native Paper - Material Design
- Lottie - Animations
- React Native Chart Kit - Charts
- React Native SVG - Graphics
- Notifee - Rich notifications (Android)

### Offline Functionality

**SQLite Database (Local)**
- 11 tables for complete offline operation
- Migration system (version 11)
- Automatic schema updates
- Data validation and constraints

**Sync Strategy:**
- Optimistic updates
- Background sync queue
- Conflict resolution
- Sync status indicators
- Last modified timestamps
- Sync action tracking (create/update/delete)

---

## Database Architecture

### Local Database (SQLite - Frontend)

**Schema Version:** 11  
**Database Name:** `platemate.db`  
**Location:** Device storage (Expo SQLite)

#### Core Tables

**1. food_logs**
- Primary table for meal tracking
- 27 columns including all macros and micros
- Supports image URLs and healthiness ratings
- Sync tracking fields (synced, sync_action, last_modified)

**2. user_profiles**
- Comprehensive user data (65+ columns)
- Onboarding data storage
- Goals and preferences
- Health conditions and dietary restrictions
- Future self message (text/audio)
- Sync status tracking

**3. user_subscriptions**
- Subscription status and history
- Trial period tracking
- Auto-renewal settings
- Payment method storage
- Foreign key to user_profiles

**4. user_weights**
- Weight history tracking
- Timestamp for each entry
- Sync tracking
- Progress calculations

**5. nutrition_goals**
- Daily targets (calories, macros)
- Weight goals (lose/gain/maintain)
- Activity level
- Goal progress tracking

**6. cheat_day_settings**
- Cheat day frequency
- Last and next cheat day
- Preferred day of week
- Enable/disable toggle

**7. exercises**
- Exercise logging
- Calories burned tracking
- Duration and notes
- Date stamping

**8. steps**
- Daily step counts
- Date tracking
- Sync status

**9. onboarding_temp**
- Temporary onboarding data (before auth)
- Session ID for anonymous users
- Automatic cleanup of old sessions
- Merged into user_profiles after auth

**10. meals**
- Meal template storage
- Custom meal creation
- Meal categorization

**11. favorites**
- Favorite foods and recipes
- Quick access lists

### Cloud Database (PostgreSQL - Supabase)

**Primary Tables:**

**1. health_data**
- User health metrics
- Time-series health data
- Workout logs
- Integration with wearables

**2. connected_devices**
- Device registration
- Health app connections (Apple Health, Google Fit)
- Sync status

**3. feature_requests**
- User feature suggestions
- Upvote tracking
- Status management (submitted, in review, in progress, completed, rejected)
- Admin comments
- Real-time updates via PostgreSQL triggers

**4. feature_upvotes**
- User voting records
- Unique constraints (one vote per user per request)
- Automatic vote count updates

**5. feature_status_updates**
- Audit trail for status changes
- Admin comments history
- Timestamp tracking

**6. vip_users**
- VIP/lifetime premium users
- Reason for VIP status
- Granted by (admin identifier)
- Active status flag

**7. user_profiles** (synced from SQLite)
- Mirror of local user data
- Cloud backup
- Cross-device sync

**8. food_logs** (synced from SQLite)
- Cloud meal history
- Data recovery
- Analytics processing

### Database Features

**Row-Level Security (RLS)**
- Users can only access their own data
- VIP status checking
- Admin-only operations

**Real-time Subscriptions**
- Feature request updates
- Vote changes
- Status updates
- Real-time UI refresh

**Triggers & Functions**
- Automatic vote count updates
- Toggle upvote function (atomic operation)
- Status change logging
- Data validation

**Migrations**
- Version-controlled schema changes
- Automatic migration execution
- Rollback support

---

## Authentication & Security

### Authentication Flow

**Supabase Authentication**
- JWT-based authentication
- Secure token storage
- Automatic token refresh
- Biometric authentication support (iOS/Android)

**Supported Auth Methods:**
1. Email/Password
2. Google Sign-In (OAuth 2.0)
3. Apple Sign-In (iOS only)
4. Anonymous sessions (temporary, during onboarding)

### Token Management

**Frontend Token Manager:**
- Persistent token storage (AsyncStorage)
- Automatic refresh before expiration
- Token caching for API calls
- Logout and cleanup

**Backend Token Validation:**
- JWT verification on every protected endpoint
- Token expiration checking
- User identity extraction
- Supabase public key validation

### Security Measures

**API Security:**
- All sensitive endpoints require authentication
- Rate limiting per user and IP
- Request validation (Pydantic models)
- CORS configuration
- SQL injection prevention (parameterized queries)

**Data Protection:**
- Passwords hashed with bcrypt
- Sensitive data encrypted at rest (Supabase)
- HTTPS/TLS for all API communication
- Environment variable management
- API key rotation support

**User Privacy:**
- Row-level security in PostgreSQL
- User data isolation
- GDPR-compliant data deletion
- Export functionality
- Privacy policy and terms of service

### Authorization Levels

**1. Anonymous**
- Limited onboarding access
- No data persistence

**2. Free User**
- Basic features
- Limited AI queries
- Standard rate limits

**3. Premium User**
- Full feature access
- Higher rate limits
- Unlimited AI queries

**4. VIP User**
- Lifetime premium access
- Special privileges
- Priority support

**5. Admin**
- Feature request management
- User management (future)
- Analytics dashboard (future)

---

## AI & Machine Learning Integration

### Computer Vision (OpenAI GPT-4 Vision)

**Capabilities:**
- Multi-food recognition in single image
- Portion size estimation
- Food identification accuracy
- Brand recognition
- Ingredient detection

**Image Processing Pipeline:**
1. Capture/upload image (HEIC/HEIF/JPEG/PNG)
2. Format detection via magic bytes
3. HEIC to JPEG conversion (if needed)
4. Image compression and optimization
5. Base64 encoding
6. Submit to GPT-4 Vision API
7. Parse structured JSON response
8. Extract nutritional estimates
9. Generate healthiness rating (1-10)

**Prompt Engineering:**
- Structured JSON output format
- Nutritional accuracy instructions
- Portion size guidance
- Confidence level reporting

### Natural Language Processing

**DeepSeek V3 (Primary AI Coach)**
- **Cost-Effective**: 95% cheaper than GPT-4
- **Fast**: ~2-second response times
- **Contextual**: Aware of user profile, goals, and history
- **Coaching Style**: Motivational, educational, personalized

**Use Cases:**
- Daily nutrition analysis
- Goal progress discussions
- Meal suggestions
- Macro balance recommendations
- Eating pattern insights
- Motivational coaching

**Context Injection:**
```python
user_context = {
    "profile": {
        "age", "gender", "weight", "height",
        "activity_level", "dietary_restrictions"
    },
    "goals": {
        "target_weight", "calorie_goal",
        "protein_goal", "carb_goal", "fat_goal"
    },
    "progress": {
        "current_weight", "weight_change",
        "days_tracked", "streak"
    },
    "today": {
        "calories_consumed", "macros",
        "meals_logged", "remaining_calories"
    }
}
```

**OpenAI GPT-4 (Secondary/Complex Queries)**
- Advanced reasoning
- Complex meal analysis
- Detailed explanations
- Fallback for DeepSeek failures

### FatSecret API Integration

**Food Database:**
- 500,000+ foods
- 100,000+ recipes
- Brand name products
- Restaurant menu items
- Generic foods

**Search Features:**
- Fuzzy matching
- Autocomplete
- Barcode lookup (UPC/EAN)
- Nutrient filtering
- Healthiness scoring

**Recipe Features:**
- Cuisine filtering
- Diet type filtering (vegan, keto, paleo, etc.)
- Cooking time limits
- Ingredient-based search
- Nutritional info per serving

**API Optimization:**
- OAuth 2.0 authentication
- Token caching (24-hour expiry)
- Response caching (1-hour TTL)
- Connection pooling
- Retry logic with exponential backoff

---

## Subscription & Monetization

### Free Tier

**Included Features:**
- ✅ 20-day promotional trial (automatic)
- ✅ Manual food logging (unlimited)
- ✅ Barcode scanning
- ✅ Basic recipe search
- ✅ Daily calorie/macro tracking
- ✅ Weight logging
- ✅ Step tracking
- ⚠️ Limited AI queries (10/day)
- ⚠️ Basic analytics

### Premium Tier ($9.99/month or $79.99/year)

**Full Feature Access:**
- ✅ Extended 30-day trial (20 days + 10 day bonus)
- ✅ Unlimited AI coaching
- ✅ Advanced meal planning
- ✅ Recipe recommendations
- ✅ Advanced analytics
- ✅ Export data
- ✅ Priority support
- ✅ Ad-free experience
- ✅ Cross-device sync

### VIP System

**Lifetime Premium Access:**
- Granted manually via Supabase dashboard
- Special users (beta testers, influencers, team members)
- No subscription required
- All premium features
- Priority support

**Implementation:**
- `vip_users` table in PostgreSQL
- Redis caching (24-hour TTL)
- Automatic detection on subscription check
- Admin-managed (insert via SQL)

### RevenueCat Integration

**Subscription Management:**
- iOS App Store integration
- Google Play Store integration
- Automatic receipt validation
- Trial period management
- Webhook handling for events

**Promotional Trial System:**
1. **Initial Trial**: 20 days (automatic on signup)
2. **Extended Trial**: +10 days (on subscription purchase)
3. **Total**: 30 days free before billing

**Webhook Events:**
- `initial_purchase` - First subscription
- `renewal` - Subscription renewed
- `cancellation` - User cancelled
- `expiration` - Subscription expired
- `billing_issue` - Payment failed

**API Endpoints:**
```
GET /api/subscription/status
POST /api/subscription/grant-promotional-trial
POST /api/subscription/grant-extended-trial
POST /api/subscription/webhook
```

**Security:**
- HMAC signature validation
- Webhook secret verification
- Idempotency keys for duplicate prevention
- RevenueCat API key (server-side only)

---

## Performance & Scalability

### Backend Optimization

**Connection Pooling:**
- HTTP connection reuse (httpx)
- Configurable pool limits
- Automatic cleanup
- Connection timeout handling

**Rate Limiting:**
- Redis-backed (atomic operations)
- Lua scripts for performance
- Per-user and per-IP limits
- Escalating cooldowns

**AI Operation Limiter:**
- Default: 100 concurrent operations
- Prevents memory exhaustion
- Request queuing
- Statistics tracking
- Configurable via environment variable

**Caching Strategy:**
- Redis for hot data (VIP status, tokens)
- API response caching (FatSecret, etc.)
- Cache invalidation on updates
- TTL management (1 hour to 24 hours)

**Logging:**
- Production: WARNING level (minimal logs)
- Development: INFO level (detailed logs)
- Environment-based configuration
- Structured logging format

**Timeout Management:**
- AI endpoints: 70-second timeout
- General endpoints: 30-second timeout
- Excluded paths: No timeout (health checks, static files)
- Background task support

### Frontend Optimization

**Offline-First Design:**
- SQLite for local storage
- Optimistic UI updates
- Background sync queue
- Sync conflict resolution

**Image Optimization:**
- Compression before upload
- Format conversion (HEIC → JPEG)
- Progressive loading
- Cached display

**Component Optimization:**
- React.memo for expensive components
- useMemo for complex calculations
- useCallback for stable functions
- Virtualized lists (FlatList, SectionList)

**Navigation Performance:**
- Native stack navigator (faster)
- Screen lazy loading
- Deep linking optimization
- Navigation state persistence

**Background Processing:**
- Step tracking in foreground service (Android)
- HealthKit background updates (iOS)
- Task Manager for scheduled tasks
- Minimal battery impact

### Scalability Considerations

**Horizontal Scaling:**
- Stateless API design
- Redis for shared state
- Load balancer compatible
- No file system dependencies

**Database Scaling:**
- Supabase (managed PostgreSQL)
- Connection pooling
- Read replicas (future)
- Query optimization

**API Rate Limits:**
- OpenAI: 10,000 requests/minute (scale up as needed)
- DeepSeek: High throughput, low cost
- FatSecret: 500 requests/minute
- RevenueCat: Unlimited

**Cost Optimization:**
- DeepSeek V3 (95% cheaper than GPT-4)
- Redis caching reduces API calls
- Connection pooling reduces overhead
- Efficient database queries

**Monitoring:**
- API endpoint metrics
- Rate limit violations tracking
- AI operation statistics
- Cache hit/miss ratios
- Error rates and logging

---

## Development & Deployment

### Development Environment

**Prerequisites:**
- Node.js 18+ (Frontend)
- Python 3.9+ (Backend)
- Redis Server (Backend caching)
- PostgreSQL (via Supabase)
- iOS: Xcode and CocoaPods
- Android: Android Studio and SDK

**Environment Variables:**

**Backend (.env):**
```bash
# Environment
ENVIRONMENT=development  # or production

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# AI APIs
OPENAI_API_KEY=sk-xxx...
DEEPSEEK_API_KEY=sk-xxx...

# FatSecret API
FATSECRET_CLIENT_ID=xxx...
FATSECRET_CLIENT_SECRET=xxx...

# RevenueCat
REVENUECAT_API_KEY=sk_xxx...
REVENUECAT_WEBHOOK_SECRET=xxx...

# Redis
REDIS_URL=redis://localhost:6379

# Configuration
AI_OPERATION_LIMIT=100  # Max concurrent AI ops
```

**Frontend (.env):**
```bash
# API
API_URL=http://localhost:8000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# RevenueCat
REVENUECAT_PUBLIC_KEY_IOS=appl_xxx...
REVENUECAT_PUBLIC_KEY_ANDROID=goog_xxx...
```

### Backend Setup

```bash
# Navigate to backend
cd Backend

# Create virtual environment
python -m venv env

# Activate virtual environment
# Windows:
.\env\Scripts\activate
# macOS/Linux:
source env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up .env file (copy from example)
# Edit with your credentials

# Run database migrations
# (Execute SQL files in Backend/migrations/)

# Start server
python start_server.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend
cd Frontend

# Install dependencies
npm install

# Apply patches (patch-package)
npm run postinstall

# Set up .env file (copy from example)

# Start development server
npm start

# Build for iOS
npm run ios

# Build for Android
npm run android

# Build production (EAS)
npm run build-dev
```

### Database Migrations

**Backend (PostgreSQL):**
```bash
# Run migrations manually
psql $DATABASE_URL -f Backend/migrations/create_health_data_table.sql
psql $DATABASE_URL -f Backend/migrations/add_subscription_versioning.sql
```

**Frontend (SQLite):**
- Automatic migration on app startup
- Current version: 11
- Located in: `Frontend/src/utils/database.js`

### Testing

**Backend Tests:**
```bash
cd Backend
pytest tests/
pytest tests/test_rate_limiting.py
python test_performance_improvements.py
```

**Frontend Tests:**
```bash
cd Frontend
npm test
npm run test:watch
npm run test:coverage
```

### Deployment

**Backend (Render.com):**
1. Connect GitHub repository
2. Set environment variables in dashboard
3. Configure build command: `pip install -r requirements.txt`
4. Configure start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Enable Redis add-on
6. Set up custom domain (optional)

**Frontend (Expo EAS):**
```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

**Database (Supabase):**
- Automatic backups
- Point-in-time recovery
- Connection pooling enabled
- RLS policies configured
- Real-time enabled for feature_requests table

**Redis (Render.com Add-on):**
- Managed Redis instance
- Automatic persistence
- Connection via environment variable
- No configuration needed

---

## Testing Strategy

### Backend Testing

**Unit Tests:**
- API endpoint testing
- Service layer testing
- Authentication flow
- Rate limiting logic
- Subscription management

**Integration Tests:**
- External API interactions (mocked)
- Database operations
- Redis caching
- Webhook handling

**Performance Tests:**
- Rate limit stress testing
- AI operation concurrency
- Database query optimization
- Connection pool efficiency

**Files:**
- `Backend/tests/` - Test suite
- `Backend/test_rate_limiting.py` - Rate limit tests
- `Backend/test_performance_improvements.py` - Performance benchmarks
- `Backend/test_backend_endpoints.py` - API tests

### Frontend Testing

**Unit Tests:**
- Component rendering
- Utility functions
- Context providers
- Database operations

**Integration Tests:**
- Navigation flows
- API calls (mocked with MSW)
- Authentication flows
- Offline sync

**E2E Tests (Future):**
- Complete user flows
- Onboarding process
- Food logging workflow
- Subscription flow

**Files:**
- `Frontend/__tests__/` - Test suite
- `Frontend/jest.config.js` - Jest configuration
- `Frontend/__tests__/jest.setup.js` - Test setup

### Test Coverage

**Target Coverage:**
- Backend: 70%+
- Frontend: 60%+
- Critical paths: 90%+

### Manual Testing Checklist

**Core Flows:**
- [ ] User registration and login
- [ ] Onboarding completion
- [ ] Photo food logging
- [ ] Manual food entry
- [ ] Recipe search and save
- [ ] AI coach interaction
- [ ] Subscription purchase
- [ ] Profile editing
- [ ] Goal modification
- [ ] Analytics viewing
- [ ] Feature request submission
- [ ] Step tracking background operation

---

## Future Roadmap

### Short-Term (Next 3 Months)

**1. Enhanced AI Features**
- Meal timing optimization
- Grocery list generation
- Nutrition label scanning (OCR)
- Voice-to-food logging

**2. Social Features**
- Share meals with friends
- Follow other users
- Community challenges
- Leaderboards

**3. Advanced Analytics**
- Nutrient trend analysis
- Eating pattern detection
- Goal prediction improvements
- Custom reports

**4. Integrations**
- More fitness trackers (Fitbit, Garmin)
- Smart scale integration
- Apple Watch complications
- Android Wear OS support

### Medium-Term (3-6 Months)

**1. Meal Prep Planning**
- Weekly meal prep schedules
- Batch cooking suggestions
- Storage instructions
- Reheating guidelines

**2. Restaurant Integration**
- Restaurant menu database
- Popular dish nutrition
- Smart suggestions based on goals
- Reservation integration

**3. Health Professional Portal**
- Nutritionist/dietitian accounts
- Client management
- Progress monitoring
- Meal plan assignment

**4. Machine Learning Enhancements**
- Personal food recognition model
- Portion size accuracy improvements
- Brand recognition
- Eating pattern anomaly detection

### Long-Term (6-12 Months)

**1. Smart Kitchen Integration**
- Smart scale API
- Smart fridge integration
- Meal prep automation
- Recipe scaling

**2. Supplement Tracking**
- Supplement logging
- Interaction warnings
- Timing recommendations
- Effectiveness tracking

**3. Blood Work Integration**
- Lab result import
- Nutrient deficiency detection
- Personalized supplement recommendations
- Progress correlation

**4. International Expansion**
- Multi-language support (Spanish, French, German, etc.)
- Region-specific food databases
- Local cuisine recognition
- Currency localization

**5. Web Platform**
- Web app for desktop users
- Admin dashboard
- Nutritionist portal
- Analytics dashboard

### Research & Experimentation

**1. AR Meal Sizing**
- Augmented reality portion estimation
- 3D food modeling
- Plate detection
- Volume calculation

**2. Continuous Glucose Monitoring**
- CGM device integration
- Blood sugar correlation with meals
- Insulin sensitivity tracking
- Personalized carb recommendations

**3. Microbiome Analysis**
- Gut health tracking
- Food sensitivity detection
- Personalized food recommendations
- Probiotic suggestions

**4. Genetic Testing Integration**
- DNA-based nutrition recommendations
- Metabolism prediction
- Food allergy risk
- Optimal macro ratios

---

## Technical Specifications

### System Requirements

**Mobile App (End Users):**
- **iOS**: 14.0 or later (iPhone 8 and newer)
- **Android**: 9.0 (API level 28) or later
- **Storage**: Minimum 100 MB free space
- **RAM**: 2 GB minimum, 4 GB recommended
- **Internet**: Required for initial setup and sync (offline mode available)
- **Permissions**: Camera, Photo Library, Notifications, Health Data (optional)

**Backend Server:**
- **OS**: Linux (Ubuntu 20.04+ recommended) or Windows Server
- **Python**: 3.9 or later
- **Memory**: 4 GB minimum, 8 GB recommended
- **Storage**: 10 GB minimum (for logs and temporary files)
- **Redis**: 6.0 or later
- **PostgreSQL**: 13.0 or later (via Supabase)

### API Specifications

**REST API Version:** 1.0  
**Base URL:** `https://platemate-backend.onrender.com`  
**Authentication:** Bearer Token (JWT)  
**Content-Type:** `application/json`  
**Rate Limiting:** Varies by endpoint (see Rate Limiting section)

**Response Format:**
```json
{
  "success": true,
  "data": {...},
  "error": null,
  "timestamp": "2025-11-13T12:00:00Z"
}
```

**Error Format:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {}
  },
  "timestamp": "2025-11-13T12:00:00Z"
}
```

### Dependencies

**Frontend (Key Dependencies):**
```json
{
  "react-native": "0.81.4",
  "expo": "54.0.0",
  "@supabase/supabase-js": "2.50.0",
  "react-native-purchases": "8.11.9",
  "@notifee/react-native": "9.1.8",
  "expo-camera": "17.0.8",
  "expo-sqlite": "16.0.8"
}
```

**Backend (Key Dependencies):**
```
fastapi==0.104.1
uvicorn==0.24.0
supabase>=2.16.0
redis>=4.5.0
openai>=1.14.1
httpx>=0.25.0
pillow==11.1.0
```

### Performance Benchmarks

**API Response Times (p95):**
- Food search: < 500ms
- Recipe search: < 800ms
- AI image analysis: < 15s
- AI chat: < 3s
- Manual food entry: < 200ms
- Barcode lookup: < 400ms

**Mobile App Metrics:**
- App launch time: < 2s (cold start), < 1s (warm start)
- Screen navigation: < 100ms
- SQLite query: < 50ms
- Image upload: < 5s (2MB image)
- Sync operation: < 10s (100 food logs)

**Concurrency:**
- Backend: 100 concurrent AI operations
- Mobile: Unlimited local operations
- Redis: 10,000+ operations/second
- Database: 1,000 concurrent connections (via Supabase)

---

## Conclusion

PlateMate is a comprehensive, production-ready nutrition tracking application that combines cutting-edge AI technology with robust offline functionality and user-friendly design. The application is built with scalability, performance, and user experience as primary considerations.

**Key Strengths:**
- ✅ **Offline-First Design**: Full functionality without internet
- ✅ **AI-Powered**: State-of-the-art computer vision and NLP
- ✅ **Comprehensive**: Nutrition, fitness, meal planning, coaching
- ✅ **Scalable**: Handles high concurrency with efficient resource usage
- ✅ **Secure**: JWT authentication, RLS, rate limiting
- ✅ **Monetizable**: Premium subscription with free trial
- ✅ **Maintainable**: Clean architecture, comprehensive testing
- ✅ **User-Friendly**: Intuitive UI/UX, onboarding, help system

**Business Model:**
- Freemium with 20-day trial
- $9.99/month or $79.99/year premium
- VIP system for special users
- Future: B2B (nutritionist portal)

**Market Position:**
- Competitor to MyFitnessPal, Lose It!, Noom
- Unique AI coaching with DeepSeek V3 (cost-effective)
- Advanced meal planning and recipe discovery
- Strong offline capabilities

**Next Steps for Production:**
1. Complete beta testing with 100+ users
2. Submit to App Store and Google Play
3. Marketing campaign launch
4. Monitor performance and user feedback
5. Iterate based on analytics and feature requests

---

## Contact & Support

**Project Repository:** (GitHub link if public)  
**Documentation:** (Documentation URL)  
**Support Email:** support@platemate.app  
**Website:** (App website URL)

**For Developers:**
- See `Backend/README.md` for backend setup
- See `Frontend/README.md` for frontend setup
- Check `SQLite_Schema.txt` for database schema
- Review `docs/` folder for additional documentation

**Last Updated:** November 13, 2025  
**Document Version:** 1.0.0
