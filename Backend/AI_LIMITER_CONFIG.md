# AI Operation Limiter - Configuration Guide

## Default Configuration

**Default Limit**: 100 concurrent AI operations  
**Philosophy**: Scale infrastructure as needed, not artificial user limits

## Why 100?

- ✅ Allows 100 users to upload images simultaneously
- ✅ Good UX - no artificial queuing under normal load
- ✅ Still provides safety net for extreme edge cases
- ✅ You can upgrade infrastructure (memory, API rate limits) as you scale

## When to Lower the Limit

Consider lowering if:
- Running on limited resources (< 4GB RAM)
- OpenAI rate limits are getting hit frequently
- Need to control costs during testing
- Running on free tier services

## Configuration Options

### Option 1: Environment Variable (Recommended)
Set `AI_OPERATION_LIMIT` in your `.env` file:

```bash
# Conservative (good for 1-2GB RAM)
AI_OPERATION_LIMIT=10

# Moderate (good for 4-8GB RAM)
AI_OPERATION_LIMIT=50

# High/Default (good for 8GB+ RAM)
AI_OPERATION_LIMIT=100

# Very High (for production scaling)
AI_OPERATION_LIMIT=200

# Unlimited (not recommended - use with caution)
AI_OPERATION_LIMIT=0
```

### Option 2: Code Change
Edit `Backend/services/ai_limiter.py`:

```python
ai_limiter = AIOperationLimiter(max_concurrent_operations=50)
```

## Monitoring

Check current usage:
```bash
curl http://localhost:8000/health/performance
```

Response includes:
```json
{
  "ai_limiter": {
    "max_concurrent": 100,
    "active_operations": 12,
    "total_operations": 543,
    "available_slots": 88
  }
}
```

## Alerts to Set Up

### Warning Level
- **Trigger**: `active_operations` > 80% of `max_concurrent`
- **Action**: Monitor for sustained high load
- **Example**: 80/100 operations active

### Critical Level
- **Trigger**: `active_operations` = `max_concurrent` for >1 minute
- **Action**: Consider increasing limit or scaling infrastructure
- **Example**: 100/100 operations active (queue forming)

## Scaling Strategy

### Scenario 1: Hit the limit occasionally (< 5% of time)
**Action**: No action needed - temporary spikes are normal

### Scenario 2: Hit the limit regularly (> 20% of time)
**Action**: Increase limit to 150-200

### Scenario 3: Hit the limit constantly (> 50% of time)
**Action**: 
1. Increase limit to 200+
2. Scale infrastructure (more memory, faster APIs)
3. Consider multiple backend workers

## Cost Considerations

Each concurrent AI operation costs:
- **Memory**: ~100-200MB per operation
- **OpenAI API**: $0.01-0.03 per image analysis
- **Processing**: ~2-5 seconds per operation

With 100 concurrent operations:
- **Memory**: 10-20GB total
- **Cost**: $1-3 per 100 images
- **Throughput**: 20-50 images/second

## Recommended Limits by Tier

| Infrastructure | RAM | Recommended Limit | Max Users |
|----------------|-----|-------------------|-----------|
| Development | 2GB | 10 | 5-10 |
| Small Production | 4GB | 50 | 20-50 |
| Medium Production | 8GB | 100 | 50-100 |
| Large Production | 16GB+ | 200+ | 100-500+ |

## Testing Your Limit

Run load test:
```bash
cd Backend
python test_performance_improvements.py
```

Or manually test:
```python
import asyncio
import httpx

async def test_concurrent_uploads():
    async with httpx.AsyncClient() as client:
        # Simulate 50 concurrent image uploads
        tasks = [
            client.post("http://localhost:8000/images/upload-image", 
                       files={"image": open("test.jpg", "rb")})
            for _ in range(50)
        ]
        results = await asyncio.gather(*tasks)
        print(f"Success: {sum(1 for r in results if r.status_code == 200)}/50")

asyncio.run(test_concurrent_uploads())
```

## FAQ

**Q: Will I hit OpenAI rate limits with 100 concurrent operations?**  
A: Depends on your OpenAI tier. Free tier: Yes. Paid tier: Usually no.

**Q: What happens when the limit is reached?**  
A: Requests queue (FIFO) and wait for slots to open. No errors, just slower.

**Q: Should I set it to unlimited (0)?**  
A: Not recommended. Use a high number (500+) instead for monitoring.

**Q: How do I know if I need to increase the limit?**  
A: Monitor `/health/performance` - if `active_operations` = `max_concurrent` frequently, increase it.

**Q: What's the real bottleneck?**  
A: Usually OpenAI API rate limits or your server's memory, not this limiter.

---

**Recommendation**: Start with 100 (default), monitor, and adjust based on actual usage patterns. Better to scale infrastructure than artificially limit users!
