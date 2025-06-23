# PlateMate Online Backup Implementation Plan

## Key Recommendations Summary

### 🎯 **Priority Data for Cross-Device Sync**

**CRITICAL (Must Have):**
- User profiles & onboarding data
- Nutrition goals & daily targets
- Food logs (nutritional data only - ~95% cost reduction vs storing images)
- Weight history & progress tracking
- Subscription status

**IMPORTANT (Should Have):**
- Exercise logs & daily steps
- User streaks & gamification data
- Cheat day settings

### 💰 **Cost-Effective Storage Strategy**

**PostgreSQL Database:** Store structured data only
- Estimated cost: **$30-65/month per 1000 users**
- All nutrition data, preferences, goals
- References to external media (URLs only)

**External Storage (S3/R2):** Store large media files
- **Voice messages**: ~50KB/minute (AAC compression)
- **Video messages**: ~2-5MB/minute (H.264)
- **Food photos**: ~100-500KB each (WebP format)
- Lifecycle policies: Auto-archive old content

### 🔧 **Future Self Messages Strategy**

Since these are **crucial for user experience**, here's the recommended approach:

```sql
-- Store metadata in PostgreSQL
CREATE TABLE future_self_messages (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    message_type VARCHAR(20), -- 'text', 'voice', 'video'
    text_content TEXT, -- For text messages
    media_url TEXT, -- S3/R2 URL for voice/video
    duration_seconds INTEGER,
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE
);
```

**Storage locations:**
- **Text messages**: PostgreSQL (no extra cost)
- **Voice/Video**: S3 with signed URLs for security
- **Estimated cost**: ~$2-5/month per 1000 users for media

### 📊 **Analytics & Business Intelligence**

Store aggregated analytics in PostgreSQL:
- Daily nutrition summaries
- User behavior patterns
- Feature usage metrics
- Progress tracking data

**Benefits for you:**
- Understand user engagement
- Identify popular features
- Track subscription conversion
- Optimize app performance

### 🚀 **Implementation Phases**

**Phase 1 (Week 1-2): Core Sync**
```javascript
// Frontend: Sync critical data on login
const syncCriticalData = async () => {
  await syncUserProfile();
  await syncNutritionGoals();
  await syncFoodLogs(last30Days);
  await syncWeightHistory();
};
```

**Phase 2 (Week 3-4): Enhanced Features**
- Exercise logs & step tracking
- User preferences & settings
- Subscription management

**Phase 3 (Week 5-6): Media Integration**
- Future self message upload/download
- Food photo references
- Profile picture sync

### 🛡️ **Security & Privacy Considerations**

**Data Isolation:**
- Row Level Security (RLS) on all tables
- Users can only access their own data
- Firebase Auth integration

**Media Security:**
- Pre-signed URLs for S3 access
- Time-limited access tokens
- Encryption at rest and in transit

### 💡 **Cost Optimization Tips**

1. **Smart Sync Strategy:**
   - Sync recent data immediately
   - Background sync for historical data
   - Delta sync (only changed records)

2. **Data Retention:**
   - Archive food logs older than 2 years
   - Compress voice messages after 6 months
   - Delete unused media files

3. **Compression:**
   - Voice: AAC format (~50% size reduction)
   - Images: WebP format (~30% size reduction)
   - Use JSONB for flexible data in PostgreSQL

### 🔄 **Sync Architecture**

```typescript
interface SyncManager {
  // Upload local changes to cloud
  pushChanges(): Promise<void>;
  
  // Download cloud changes to local
  pullChanges(): Promise<void>;
  
  // Handle conflicts (last-write-wins)
  resolveConflicts(): Promise<void>;
}
```

**Conflict Resolution:**
- Nutrition goals: Server wins (critical data)
- Food logs: Last modified wins
- Preferences: Client wins (UX priority)

### 📈 **Expected Benefits**

**For Users:**
- Seamless device switching
- Data backup & recovery
- Faster app startup (cached data)

**For You:**
- User behavior insights
- Improved retention
- Subscription analytics
- Cost-effective scaling

### 🎯 **Next Steps**

1. Choose PostgreSQL provider (Supabase/Neon recommended)
2. Set up S3/R2 bucket with lifecycle policies
3. Implement Phase 1 sync for critical data
4. Add media upload for future self messages
5. Build analytics dashboard

**Estimated total cost for 1000 active users: $35-70/month**

This approach gives you 90% of the benefits at 20% of the cost compared to storing everything in the database! 