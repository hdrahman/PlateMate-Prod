-- User-friendly token bucket rate limiter with escalating cooldowns
local key_prefix = KEYS[1]
local tokens_key = key_prefix .. ":tokens"
local timestamp_key = key_prefix .. ":timestamp" 
local violations_key = key_prefix .. ":violations"

local refill_rate = tonumber(ARGV[1])      -- tokens per second
local capacity = tonumber(ARGV[2])         -- bucket capacity
local time_now = tonumber(ARGV[3])         -- current unix time
local requested = tonumber(ARGV[4])        -- tokens requested
local cooldown_levels = ARGV[5]            -- JSON array of cooldown seconds

-- Parse cooldown levels
local cooldowns = {}
local cooldown_start = 6
for i = cooldown_start, #ARGV do
    table.insert(cooldowns, tonumber(ARGV[i]))
end

-- Get current state
local last_tokens = tonumber(redis.call("GET", tokens_key)) or capacity
local time_last_refreshed = tonumber(redis.call("GET", timestamp_key)) or time_now
local violations = tonumber(redis.call("GET", violations_key)) or 0

-- Calculate token refill
local delta_time = math.max(0, time_now - time_last_refreshed)
local replenished_tokens = delta_time * refill_rate
local filled_tokens = math.min(capacity, last_tokens + replenished_tokens)

-- Determine if request is allowed
local allowed = filled_tokens >= requested
local new_tokens = filled_tokens
local retry_after = 0

if allowed then
    new_tokens = filled_tokens - requested
    -- Reset violations on successful request
    violations = 0
    redis.call("DEL", violations_key)
else
    -- Calculate escalating cooldown
    violations = violations + 1
    local cooldown_index = math.min(violations, #cooldowns)
    retry_after = cooldowns[cooldown_index]
    
    -- Set violation counter with expiry
    redis.call("SETEX", violations_key, retry_after * 2, violations)
end

-- Update state
local ttl = math.floor((capacity / refill_rate) * 2)
redis.call("SETEX", tokens_key, ttl, new_tokens)
redis.call("SETEX", timestamp_key, ttl, time_now)

return {
    allowed and 1 or 0,  -- allowed (1/0)
    new_tokens,          -- tokens remaining
    retry_after,         -- seconds to wait
    violations           -- violation count
} 