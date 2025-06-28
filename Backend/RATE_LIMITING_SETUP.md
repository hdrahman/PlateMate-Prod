# PlateMate Rate Limiting System Setup Guide

## 🎯 Overview

This guide helps you set up the comprehensive rate limiting system for PlateMate, which provides:

- **User-friendly limits** that encourage exploration
- **Escalating cooldowns** instead of hard blocks
- **Redis-based distributed rate limiting** for production
- **Comprehensive monitoring** and health checks

## 📋 Prerequisites

1. **Redis Server** (local or cloud-hosted)
2. **Python packages** (automatically installed with requirements.txt)
3. **Environment configuration**

## 🚀 Quick Setup

### 1. Install Dependencies

The required packages are already added to `requirements.txt`:

```bash
cd Backend
pip install -r requirements.txt
```

### 2. Configure Redis

**Option A: Local Redis (Development)**
```bash
# Install Redis locally
# Ubuntu/Debian:
sudo apt update && sudo apt install redis-server

# macOS:
brew install redis

# Start Redis
redis-server
```

**Option B: Docker Redis**
```bash
docker run --name redis-platemate -d -p 6379:6379 redis:7-alpine
```

**Option C: Cloud Redis** (Production)
- **Heroku**: `heroku addons:create heroku-redis:mini`
- **Railway**: Add Redis service in dashboard
- **AWS**: Use ElastiCache
- **DigitalOcean**: Use Managed Redis

### 3. Update Environment Variables

Your `.env` file already contains the basic Redis configuration:

```bash
# Redis Configuration for Rate Limiting
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Rate Limiting Settings
RATE_LIMITING_ENABLED=true
RATE_LIMITING_LOG_LEVEL=INFO
```

**For production with password:**
```bash
REDIS_URL=redis://username:password@host:port/database
# or with SSL:
REDIS_URL=rediss://username:password@host:port/database
```

## 🔧 Configuration

### Rate Limit Settings

The system uses user-friendly rate limits configured in `Backend/middleware/rate_limiting.py`:

```python
RATE_LIMITS = {
    "search": {
        "limit": 100,           # requests per minute
        "burst": 25,            # burst allowance
        "window": 60,           # seconds
        "cooldown": [5, 10, 60, 300],  # escalating cooldowns
    },
    "ai": {
        "limit": 30,            # requests per hour  
        "burst": 5,             # burst allowance
        "window": 3600,         # seconds
        "cooldown": [30, 60, 300, 1800],  # escalating cooldowns
    },
    "general": {
        "limit": 1000,          # requests per hour
        "burst": 100,           # burst allowance  
        "window": 3600,         # seconds
        "cooldown": [10, 30, 300],  # escalating cooldowns
    }
}
```

### Endpoint Mapping

PlateMate endpoints are automatically categorized:

- **Search endpoints**: `/food/search`, `/recipes/search`, `/recipes/random`
- **AI endpoints**: `/gpt/*`, `/deepseek/*`, `/arli_ai/*`
- **General endpoints**: All other API endpoints
- **Excluded paths**: `/health`, `/docs`, `/static`, `/`

## 🧪 Testing

### 1. Start the Backend

```bash
cd Backend
python main.py
# or
uvicorn main:app --reload
```

### 2. Run the Test Suite

```bash
cd Backend
python test_rate_limiting.py
```

The test suite will:
- ✅ Check system health
- ✅ Test search endpoint limits (100/min, burst 25)
- ✅ Test AI endpoint limits (30/hour, burst 5) 
- ✅ Verify escalating cooldowns work
- ✅ Confirm excluded paths are not rate limited

### 3. Manual Testing

**Check system health:**
```bash
curl http://localhost:8000/health/rate-limiting
```

**Test rate limiting:**
```bash
# Make multiple requests quickly
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:8000/food/search?query=apple
  sleep 0.1
done
```

## 📊 Monitoring

### Health Check Endpoints

- **System Health**: `GET /health/rate-limiting`
- **Configuration**: `GET /health/rate-limiting/config`

### Rate Limit Headers

All responses include headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: When the window resets

### Error Response Format

Rate limited requests return:
```json
{
    "error": "Rate limit exceeded",
    "message": "Too many requests to search endpoints. Please try again later.",
    "retry_after": 5,
    "violations": 1,
    "type": "rate_limit_exceeded"
}
```

## 🚀 Production Deployment

### 1. Cloud Redis Setup

**Heroku:**
```bash
heroku addons:create heroku-redis:mini
# REDIS_URL automatically set
```

**Railway:**
```yaml
# railway.toml
[services.redis]
image = "redis:7-alpine"
```

**AWS ElastiCache:**
```bash
# Get your Redis endpoint and update .env
REDIS_URL=redis://your-cluster.cache.amazonaws.com:6379
```

### 2. Environment Variables

Set in your deployment platform:
```bash
REDIS_URL=your_production_redis_url
REDIS_PASSWORD=your_redis_password
RATE_LIMITING_ENABLED=true
RATE_LIMITING_LOG_LEVEL=INFO
```

### 3. Security Checklist

- [ ] Redis password configured
- [ ] Redis SSL/TLS enabled (if required)
- [ ] Rate limiting keys use hashed identifiers
- [ ] No sensitive data in rate limiting logs
- [ ] Health check monitoring configured
- [ ] Redis memory limits set appropriately

## 🔧 Customization

### Adjusting Rate Limits

Edit `Backend/middleware/rate_limiting.py`:

```python
# More generous for premium users
"search": {
    "limit": 200,           # Double the limit
    "burst": 50,            # Double the burst
    "window": 60,
    "cooldown": [2, 5, 30, 120],  # Shorter cooldowns
}

# Stricter for free tier
"ai": {
    "limit": 10,            # Reduce limit
    "burst": 2,             # Reduce burst
    "window": 3600,
    "cooldown": [60, 120, 600, 3600],  # Longer cooldowns
}
```

### Adding New Endpoints

Update `ENDPOINT_MAPPING` in `Backend/middleware/rate_limiting.py`:

```python
ENDPOINT_MAPPING = {
    # Existing mappings...
    "/new-api/expensive": "ai",      # New AI endpoint
    "/new-api/search": "search",     # New search endpoint
}
```

### Dynamic Rate Limits

For time-based or user-tier based limits:

```python
def get_rate_limits(user_tier: str, hour: int):
    if user_tier == "premium":
        return PREMIUM_LIMITS
    elif 9 <= hour <= 17:  # Business hours
        return PEAK_LIMITS
    else:
        return OFF_PEAK_LIMITS
```

## 🐛 Troubleshooting

### Redis Connection Issues

**Error**: `Failed to connect to Redis`
**Solution**:
1. Check Redis is running: `redis-cli ping`
2. Verify REDIS_URL in .env
3. Check firewall/network settings
4. Ensure Redis password is correct

### Rate Limiting Not Working

**Error**: Requests not being rate limited
**Solution**:
1. Check `RATE_LIMITING_ENABLED=true` in .env
2. Verify middleware is added: check main.py
3. Check health endpoint: `/health/rate-limiting`
4. Review logs for Redis errors

### False Positives

**Error**: Legitimate users getting rate limited
**Solution**:
1. Increase burst limits for affected endpoints
2. Check if multiple users share same IP
3. Implement user-based rate limiting
4. Adjust cooldown times

### Performance Issues

**Error**: High latency on requests
**Solution**:
1. Monitor Redis connection pool
2. Check Redis memory usage
3. Consider Redis clustering for scale
4. Profile Lua script performance

## 📈 Scaling Considerations

### High Traffic

For > 1000 requests/second:
- Use Redis Cluster
- Increase connection pool size
- Consider CDN for static content
- Monitor Redis CPU/memory usage

### Multiple Instances

For horizontal scaling:
- Shared Redis instance required
- Consider Redis Sentinel for HA
- Monitor cross-instance consistency
- Use load balancer session affinity if needed

## 🎉 Success!

Your PlateMate rate limiting system is now configured and ready for production! The system will:

✅ **Protect your API** from abuse while staying user-friendly  
✅ **Scale automatically** with your user base  
✅ **Provide detailed monitoring** for operational insights  
✅ **Fail gracefully** if Redis becomes unavailable  

For questions or issues, check the logs and health endpoints first, then refer to this troubleshooting guide.

**Happy rate limiting!** 🚀 