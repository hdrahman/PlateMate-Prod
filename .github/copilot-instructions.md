# PlateMate AI Agent Instructions

## Project Overview
PlateMate is an AI-powered nutrition tracking mobile app (React Native/Expo) with a FastAPI backend. Users take photos of food for automatic nutrition analysis, track macros/micros, manage meal plans, and monitor step goals with gamification.

**Tech Stack:**
- **Frontend**: React Native (Expo SDK 54), TypeScript, SQLite (offline-first) - **PRIMARY FOCUS: iOS 26 Phone UI**
- **Backend**: FastAPI (Python), Redis (rate limiting/caching), Supabase (PostgreSQL + Auth)
- **AI Services**: OpenAI GPT-4 Vision, DeepSeek, Arli AI (nutrition analysis/chat)
- **External APIs**: FatSecret (food database), RevenueCat (subscriptions)

## iOS UI Development (Primary Focus)

### iOS-Specific Patterns
**Target**: iOS 26+ phones (iPhone 12-16 series, latest iOS versions)

#### Safe Area Handling (CRITICAL)
```typescript
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ALWAYS use SafeAreaView for screen containers
<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
  {/* Screen content */}
</SafeAreaView>

// For custom headers, use insets
const insets = useSafeAreaInsets();
<View style={[styles.header, { paddingTop: insets.top + 12 }]}>
  {/* Header content */}
</View>
```

#### Platform-Specific Styling
```typescript
import { Platform } from 'react-native';

// Conditional iOS styling
const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
    // iOS gets SafeAreaView padding, Android uses insets
  },
  picker: {
    // iOS picker needs different treatment
    ...(Platform.OS === 'ios' ? {
      height: 200,
      backgroundColor: 'transparent',
    } : {
      height: 50,
      borderWidth: 1,
    })
  }
});
```

#### Screen Dimensions & Responsive Design
```typescript
import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Use relative sizing for iPhone compatibility
const styles = StyleSheet.create({
  card: {
    width: screenWidth - 32,  // Account for padding
    maxWidth: 428,  // iPhone 14 Pro Max width
  },
  modal: {
    maxHeight: screenHeight * 0.8,  // Percentage-based heights
  }
});
```

#### iOS-Specific Components
- **Camera**: Uses `expo-camera` with iOS-specific permissions in `app.json`
- **HealthKit**: iOS-only step tracking via `react-native-health`
- **Haptics**: `expo-haptics` for iOS feedback (button presses, errors)
- **Status Bar**: Always set `<StatusBar barStyle="light-content" />` for dark theme

### Universal Minimalist Dark Theme (NEW)
**Philosophy**: Pure black, white, and gray only. No colors except for critical status indicators.

```typescript
import THEME, { commonStyles, withOpacity } from '../styles/theme';

// Use centralized theme instead of hardcoded colors
const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.background.primary,  // #000000 - Pure black
  },
  card: {
    ...commonStyles.card,  // Pre-configured card style
  },
  title: {
    color: THEME.text.primary,  // #FFFFFF - High contrast white
    fontSize: THEME.typography.fontSize.xl,
  },
  subtitle: {
    color: THEME.text.secondary,  // #B3B3B3 - Light gray
  },
});

// For semi-transparent backgrounds
backgroundColor: withOpacity(THEME.text.primary, 0.1)
```

**Key Theme Constants**:
- `THEME.background.primary` (#000000) - Main background
- `THEME.background.tertiary` (#121212) - Cards/containers
- `THEME.text.primary` (#FFFFFF) - Main text
- `THEME.text.secondary` (#B3B3B3) - Secondary text
- `THEME.border.default` (#2A2A2A) - Borders/dividers
- `THEME.spacing.md` (16pt) - Standard padding (8pt grid)
- `THEME.radius.lg` (12pt) - Card border radius

**Common Patterns**:
```typescript
// Container
<SafeAreaView style={commonStyles.container}>

// Card
<View style={commonStyles.card}>

// Primary button
<TouchableOpacity style={commonStyles.primaryButton}>
  <Text style={commonStyles.primaryButtonText}>Action</Text>
</TouchableOpacity>

// Typography
<Text style={commonStyles.heading}>Title</Text>
<Text style={commonStyles.body}>Body text</Text>
<Text style={commonStyles.caption}>Caption</Text>
```

See `Frontend/THEME_GUIDE.md` for complete documentation.

### Navigation Patterns
- **Stack Navigator**: Primary navigation (`@react-navigation/native-stack`)
- **Bottom Tabs**: Main app sections with iOS-style tab bar
- **Gestures**: iOS swipe-back enabled by default (react-native-gesture-handler)
- **Headers**: Custom headers with SafeAreaView, gradient backgrounds

### iOS Configuration (`app.json`)
```json
{
  "ios": {
    "bundleIdentifier": "com.zentraai.platematepro",
    "buildNumber": "19",
    "supportsTablet": true,
    "infoPlist": {
      "NSCameraUsageDescription": "Camera for meal photos",
      "NSHealthShareUsageDescription": "HealthKit for step tracking",
      "UIBackgroundModes": ["fetch"]
    },
    "entitlements": {
      "com.apple.developer.healthkit": true
    }
  }
}
```

### Common iOS UI Gotchas
1. **Keyboard Avoidance**: Use `KeyboardAvoidingView` with `behavior="padding"` for iOS
2. **Text Input Focus**: iOS auto-scrolls differently - test with keyboard open
3. **Modal Presentation**: iOS modals slide up from bottom by default
4. **Shadow vs Elevation**: iOS uses `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` (NOT `elevation`)
5. **Font Weights**: iOS renders SF Pro font weights differently - test actual device
6. **Touch Targets**: Minimum 44x44pt per Apple HIG (use `minHeight: 44`)

### Performance on iOS
- **Image Optimization**: Use `expo-image` for better iOS memory management
- **List Virtualization**: `FlatList` with `windowSize={5}` for smooth scrolling
- **Avoid Re-renders**: Memo components in long lists (see `MealPlanner.tsx` examples)
- **Haptic Feedback**: Light/medium/heavy - don't overuse (battery drain)

## Architecture: Hybrid Sync Model

**Critical Pattern**: SQLite (local) is the source of truth, Supabase (remote) is backup/sync.

### Data Flow
1. **User actions** → writes to SQLite immediately (offline-first)
2. **Background sync** → SQLite → Supabase (via `postgreSQLSyncService.ts`)
3. **Auth**: Supabase provides JWT tokens, backend validates with `auth/supabase_auth.py`

### Database Schema Critical Points
- **User ID**: Frontend uses `firebase_uid` (string), NOT PostgreSQL UUIDs
- **Sync columns**: All tables have `synced`, `sync_action`, `last_modified` for conflict resolution
- **Key tables**: `food_logs`, `user_profiles`, `weight_entries`, `meals`, `onboarding_temp`
- See `SQLite_Schema.txt` for complete schema

### Context System (Frontend)
State management via React Context API:
- `FoodLogContext` - food logging, nutrient totals calculation
- `StepContext` - step tracking, daily goals
- `GamificationContext` - streaks, achievements
- `AuthContext` - user authentication state
- `OnboardingContext` - incremental onboarding with temp storage

Pattern: Contexts watch SQLite via `databaseWatcher.ts`, auto-refresh UI on changes.

## Development Workflows

### Running the Backend
```bash
cd Backend
# ALWAYS configure Python environment first
python -m venv env
source env/bin/activate  # or `env\Scripts\activate` on Windows
pip install -r requirements.txt

# Run server (default: http://localhost:8000)
python start_server.py
# OR uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Environment Setup**: Copy `.env.example` → `.env`, configure:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` (auth)
- `OPENAI_API_KEY` (nutrition analysis)
- `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET` (food search)
- `REDIS_URL` (rate limiting - optional for dev, use `redis://localhost:6379`)
- `REVENUECAT_API_KEY` (subscriptions - required for trials)

### Running the Frontend
```bash
cd Frontend
npm install
# Offline mode (recommended for dev - no network checks)
npm start  
# Online mode
npm run start-online
```

**Environment**: Create `.env` with `BACKEND_URL=http://localhost:8000` (or your backend URL)

### Testing
**Backend**:
```bash
cd Backend
pytest                        # Run all tests
pytest tests/api/            # API tests only
pytest tests/services/       # Service tests only
pytest --cov                 # With coverage
```
Tests use `conftest.py` fixtures, mock Supabase auth with `@patch("auth.supabase_auth.get_current_user")`.

**Frontend**: Tests configured but minimal - app relies on manual testing/QA.

## Critical Systems & Patterns

### 1. Rate Limiting (Backend)
**Files**: `middleware/rate_limiting.py`, `services/rate_limiter.py`, `scripts/rate_limiter.lua`

- Redis-based distributed rate limiting with Lua scripts
- **Endpoints**:
  - `search` (food): 100 req/min, burst 25
  - `ai` (GPT/DeepSeek): 30 req/hour, burst 5
  - `general`: 1000 req/hour, burst 100
- **Escalating cooldowns**: 5s → 10s → 60s → 300s (instead of hard blocks)
- **Setup**: Set `RATE_LIMITING_ENABLED=true` and configure Redis URL

### 2. AI Operations Management
**File**: `services/ai_limiter.py`

```python
from services.ai_limiter import ai_limiter
async with ai_limiter.limit("GPT-4 Vision Analysis"):
    result = await openai.chat.completions.create(...)
```
- Default: 100 concurrent ops (high limit for scalability)
- Prevents memory exhaustion on image analysis bursts
- Configure via `AI_OPERATION_LIMIT` env var (lower to 10-20 for <4GB RAM)

### 3. HTTP Client Pooling
**File**: `services/http_client_manager.py`

- Persistent HTTP clients for OpenAI, DeepSeek, FatSecret APIs
- **40-60% faster** API calls via connection reuse
- Usage: `client = await http_client_manager.get_client("openai")`
- Initialized in `main.py` startup event

### 4. JWT Caching
**File**: `auth/supabase_auth.py`

- Redis-based JWT cache (5 min TTL)
- Reduces auth overhead from 150ms → 2ms
- Automatic cache key: `jwt:cache:{SHA256(token)}`

### 5. Subscription System (RevenueCat)
**Pattern**: 20-day trial (automatic) + 10-day extension (on subscribe) = 30 days free

- **VIP Users**: Bypass all premium checks via `vip_users` table in Supabase
  - Add users in Supabase dashboard with `firebase_uid`, `email`, `is_active=true`
  - VIP check runs BEFORE RevenueCat validation (highest priority)
- **Premium Gates**: Check in routes via `check_premium_access()` helper
- See `SUBSCRIPTION_SETUP_GUIDE.md` for RevenueCat product setup

### 6. Incremental Onboarding
**File**: `Frontend/src/context/OnboardingContext.tsx`

- **Problem Solved**: Users lost data if app crashed mid-onboarding
- **Solution**: Saves after EACH step to `onboarding_temp` table (with session ID)
- **Flow**: 
  1. Pre-auth → save to temp table
  2. User signs up → migrate temp data to `user_profiles` via `firebase_uid`
  3. Auto-cleanup old temp sessions (>7 days)

### 7. Step Tracking (Always-On)
**Files**: `Frontend/src/services/UnifiedStepTracker.ts`, `NativeStepCounter.ts` (Android), `HealthKitStepCounter.ts` (iOS)

- **Android**: Native sensor (`TYPE_STEP_COUNTER`) + foreground service
- **iOS**: HealthKit background access
- **Persistence**: Survives app swipe-away via separate process + boot receiver
- See `STEP_TRACKING_IMPLEMENTATION_SUMMARY.md`

## Common Gotchas

### Frontend Sync Issues
**Problem**: Weight/food logs not syncing to Supabase
**Check**: `Frontend/src/utils/postgreSQLSyncService.ts` - MUST use `firebase_uid`, NOT `postgresUserId`
```typescript
// CORRECT
const data = { firebase_uid: firebaseUid, ... }
// WRONG
const data = { user_id: postgresUserId, ... }
```
See `ONBOARDING_FIX_SUMMARY.md` for past sync bugs.

### Backend Auth Failures
**Problem**: All requests return 401
**Debug**: 
1. Check `/health/auth-status` endpoint for config validation
2. Verify `SUPABASE_JWT_SECRET` or `SUPABASE_ANON_KEY` in `.env`
3. Check frontend is sending `Authorization: Bearer <token>` header
4. Use `/auth/verify-cache-performance` to test JWT decoding

### Image Upload Issues
**Location**: `Backend/uploads/images/` (served via `/static` mount)
**Problem**: Images not loading
**Check**: 
1. Directory permissions (`mkdir -p uploads/images uploads/temp`)
2. File saved with unique key: `{timestamp}_{random}.jpg`
3. Frontend URL: `${BACKEND_URL}/static/images/{file_key}`

### FatSecret API Errors
**Problem**: "IP not whitelisted" or "401 Unauthorized"
**Solution**: 
1. Whitelist server IP in FatSecret dashboard → Settings → API Keys
2. Verify credentials: `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET`
3. Check token refresh logic in `services/fatsecret_service.py`

## File Patterns to Follow

### Backend Route Structure
```python
from fastapi import APIRouter, Depends, HTTPException
from auth.supabase_auth import get_current_user
router = APIRouter(prefix="/endpoint", tags=["tag"])

@router.post("/action")
async def action_handler(
    request: RequestModel,
    current_user: dict = Depends(get_current_user)  # Always require auth
):
    user_id = current_user["supabase_uid"]  # Use this for DB queries
    # ... implementation
```

### Frontend Service Pattern
```typescript
// services/ExampleService.ts
export class ExampleService {
    private static instance: ExampleService;
    
    public static getInstance(): ExampleService {
        if (!ExampleService.instance) {
            ExampleService.instance = new ExampleService();
        }
        return ExampleService.instance;
    }
    
    private constructor() {
        // Initialize
    }
    
    public async performAction(): Promise<Result> {
        // Implementation
    }
}
```

### Context Pattern (Frontend)
```typescript
const ExampleContext = createContext<ContextType>(defaultValue);

export const ExampleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<StateType>(initialState);
    
    // Watch database changes
    useEffect(() => {
        const handleChange = () => refreshData();
        subscribeToDatabaseChanges('table_name', handleChange);
        return () => unsubscribeFromDatabaseChanges('table_name', handleChange);
    }, []);
    
    return <ExampleContext.Provider value={{...}}>{children}</ExampleContext.Provider>;
};
```

## Key Documentation Files
- `Backend/RATE_LIMITING_SETUP.md` - Redis setup, rate limit configuration
- `Backend/PERFORMANCE_IMPROVEMENTS.md` - HTTP pooling, AI limiter details
- `SUBSCRIPTION_SETUP_GUIDE.md` - RevenueCat + VIP system setup
- `VIP_USER_MANAGEMENT_GUIDE.md` - Granting free lifetime access
- `Frontend/docs/ARCHITECTURE.md` - Frontend patterns, service layer
- `SQLite_Schema.txt` - Complete database schema with sync columns
- `ONBOARDING_FIX_SUMMARY.md` - Past sync bugs (learn from these!)

## When Making Changes

### iOS UI Changes
1. **Always test on iPhone simulator** (Xcode) - not just web/Android
2. **Check SafeAreaView**: Ensure notch/Dynamic Island don't overlap content
3. **Test dark mode**: App uses dark theme by default (`userInterfaceStyle: "light"` in app.json)
4. **Verify gestures**: iOS swipe-back, pull-to-refresh should work
5. **Run on device**: Haptics, camera, HealthKit require physical iPhone
6. **Check font rendering**: iOS renders text differently than Android/web

### Backend/Architecture Changes
1. **Backend API changes**: Update OpenAPI docs (auto-generated at `/docs`)
2. **Database schema**: Update `SQLite_Schema.txt` + add migration in `Frontend/src/utils/database.ts`
3. **Auth flow**: Test with both Supabase tokens AND VIP users
4. **Sync logic**: ALWAYS verify `firebase_uid` usage, never mix with PostgreSQL UUIDs
5. **New AI endpoints**: Wrap with `ai_limiter.limit()` and rate limiting middleware
6. **Performance**: Use HTTP client pooling for external APIs, check Redis caching opportunities

## iOS Development Workflow

### Running on iOS Simulator
```bash
cd Frontend
npm install
# Start Expo dev server
npm start
# Press 'i' for iOS simulator
```

### Building for iOS
```bash
# EAS Build (production)
npx eas build --profile development --platform ios
# Local build (requires macOS + Xcode)
expo run:ios
```

### Debugging iOS-Specific Issues
1. **HealthKit not working**: Check entitlements in `app.json`, rebuild with EAS
2. **Camera black screen**: Added delays in `MealPlannerCamera.tsx` - camera needs 300ms to mount
3. **Step tracking**: iOS uses HealthKit, requires `react-native-health` library
4. **Notifications**: Uses `@notifee/react-native` for rich notifications (iOS 10+)
5. **Permissions**: Check `infoPlist` in `app.json` for usage descriptions

### iOS Build Configuration
- **Bundle ID**: `com.zentraai.platematepro`
- **Build Number**: Increment for each TestFlight/App Store release
- **Expo SDK**: 54.0.0 (React Native 0.81.4)
- **Min iOS Version**: iOS 13.0+ (implied by Expo SDK 54)
- **Orientation**: Portrait only (phones), Portrait + Landscape (iPad)
