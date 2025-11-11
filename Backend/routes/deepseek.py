from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, validator
from typing import List, Optional, Dict, Any
import httpx
import os
import logging
from dotenv import load_dotenv
from auth.supabase_auth import get_current_user
import time

# Import HTTP client manager and AI limiter
from services.http_client_manager import get_http_client
from services.ai_limiter import get_ai_limiter

# Load environment variables
load_dotenv()

# Get logger (configuration done in main.py)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/deepseek", tags=["deepseek"])

# Get DeepSeek API key from environment variables (secure)
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
if not DEEPSEEK_API_KEY:
    logger.error("DEEPSEEK_API_KEY not found in environment variables")
    raise RuntimeError("DeepSeek API key not configured")

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"  # This is DeepSeek V3

# Request/Response models
class ChatMessage(BaseModel):
    role: str  # "system", "user", or "assistant"
    content: str
    
    @validator('content')
    def content_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Message content cannot be empty')
        return v.strip()
    
    @validator('role')
    def role_must_be_valid(cls, v):
        if v not in ['system', 'user', 'assistant']:
            raise ValueError('Role must be one of: system, user, assistant')
        return v
    
    class Config:
        # Allow extra fields to be ignored
        extra = "ignore"

class NutritionAnalysisRequest(BaseModel):
    nutritionData: dict
    autoStart: bool = True
    customPrompt: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

class ChatResponse(BaseModel):
    response: str
    usage: Optional[dict] = None

class ChatWithContextRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[str] = None  # Frontend can provide context data as a string
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

# Token management
@router.post("/get-token")
async def get_deepseek_token(current_user: dict = Depends(get_current_user)):
    """
    Get a simulated DeepSeek token for the client.
    
    This endpoint doesn't actually return a real DeepSeek API key (which would be a security risk),
    but instead returns a simulated token with expiration for client-side caching purposes.
    The actual API key is kept secure on the server.
    """
    try:
        # Return a simulated token with expiration
        return {
            "token": f"simulated-deepseek-token-{int(time.time())}",
            "expires_in": 3600,  # 1 hour expiration
            "token_type": "Bearer"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating DeepSeek token: {str(e)}")

@router.post("/nutrition-analysis", response_model=ChatResponse)
async def analyze_nutrition(
    request: NutritionAnalysisRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze nutrition data and provide coaching insights using DeepSeek V3.
    This endpoint is called when user taps 'Generate Report' in food log.
    Stateless service - no database access required.
    """
    try:
        nutrition_data = request.nutritionData
        
        logger.info(f"Nutrition analysis requested for user {current_user['supabase_uid']}")
        
        # Create context message for Coach Max - use custom prompt if provided
        if request.customPrompt:
            system_prompt = """You are Coach Max, a professional nutritionist providing a detailed analysis of a user's food log. 
Be thorough, educational, and conversational as if you're conducting an in-person nutrition consultation.
Use the nutrition data provided to give personalized insights and specific recommendations.
This is an initial consultation, so give a comprehensive analysis before waiting for user questions."""
            
            # Use the custom prompt as the user message
            context_message = request.customPrompt
            
            # Add nutrition data for context
            detailed_data = f"""
Here's my nutrition data for {nutrition_data.get('date', 'today')}:

CALORIES: {nutrition_data.get('calories', {}).get('consumed', 0)} consumed out of {nutrition_data.get('calories', {}).get('goal', 0)} goal ({nutrition_data.get('calories', {}).get('remaining', 0)} remaining)

MACROS:
- Protein: {nutrition_data.get('macros', {}).get('protein', {}).get('consumed', 0)}g consumed, {nutrition_data.get('macros', {}).get('protein', {}).get('goal', 0)}g goal
- Carbs: {nutrition_data.get('macros', {}).get('carbs', {}).get('consumed', 0)}g consumed, {nutrition_data.get('macros', {}).get('carbs', {}).get('goal', 0)}g goal  
- Fat: {nutrition_data.get('macros', {}).get('fat', {}).get('consumed', 0)}g consumed, {nutrition_data.get('macros', {}).get('fat', {}).get('goal', 0)}g goal

FOODS EATEN:
"""
            # Add detailed foods information
            for meal in nutrition_data.get('detailedFoods', []):
                detailed_data += f"- {meal.get('mealName', 'Meal')}: {', '.join(meal.get('foods', []))}\n"
            
            detailed_data += f"\nEXERCISE: {nutrition_data.get('exercise', {}).get('total', 0)} calories burned"
            
            # Combine custom prompt with detailed data
            context_message = f"{context_message}\n\n{detailed_data}"
            
        else:
            # Default system prompt for regular nutrition analysis
            system_prompt = """You are Coach Max, an expert AI Health Coach and nutritionist. You're energetic, motivational, and provide practical, actionable advice. Analyze the user's nutrition data and provide personalized insights, recommendations, and encouragement. Keep your tone friendly and supportive while being informative."""
            
            # Build nutrition context message
            context_message = f"""I've analyzed your nutrition data for {nutrition_data.get('date', 'today')}. Here's what I found:

CALORIES: {nutrition_data.get('calories', {}).get('consumed', 0)} consumed out of {nutrition_data.get('calories', {}).get('goal', 0)} goal

MACROS:
- Protein: {nutrition_data.get('macros', {}).get('protein', {}).get('consumed', 0)}g
- Carbs: {nutrition_data.get('macros', {}).get('carbs', {}).get('consumed', 0)}g  
- Fat: {nutrition_data.get('macros', {}).get('fat', {}).get('consumed', 0)}g

MEALS: {', '.join([meal.get('name', 'Unknown meal') for meal in nutrition_data.get('meals', [])])}

EXERCISE: {nutrition_data.get('exercise', {}).get('total', 0)} calories burned

Let me give you personalized insights and recommendations to help you reach your health goals!"""

        # Prepare messages for DeepSeek
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context_message}
        ]
        
        # Get persistent HTTP client and AI limiter
        client = await get_http_client("deepseek")
        limiter = await get_ai_limiter()
        
        # Use AI limiter to prevent resource exhaustion
        async with limiter.limit("DeepSeek nutrition analysis"):
            response = await client.post(
                "/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1000
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500, 
                    detail="Failed to get nutrition analysis from AI coach"
                )
            
            result = response.json()
            coach_response = result["choices"][0]["message"]["content"]
            
            logger.info(f"Nutrition analysis completed for user {current_user['supabase_uid']}")
            
            return ChatResponse(
                response=coach_response,
                usage=result.get("usage")
            )
            
    except httpx.TimeoutException:
        logger.error("DeepSeek API timeout")
        raise HTTPException(status_code=504, detail="AI coach is taking too long to respond")
    except Exception as e:
        logger.error(f"Error in nutrition analysis: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to analyze nutrition data")

@router.post("/chat", response_model=ChatResponse)
async def chat_with_coach(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    General chat endpoint for ongoing conversations with Coach Max.
    Stateless service - no database access required.
    """
    try:
        logger.info(f"Chat request from user {current_user['supabase_uid']}")
        
        # Get persistent HTTP client and AI limiter
        client = await get_http_client("deepseek")
        limiter = await get_ai_limiter()
        
        # Use AI limiter to prevent resource exhaustion
        async with limiter.limit("DeepSeek chat"):
            response = await client.post(
                "/chat/completions",
                headers={
                    "Content-Type": "application/json", 
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": [msg.dict() for msg in request.messages],
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens
                },
                timeout=60.0  # Increased timeout from 30s to 60s
            )
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to get response from AI coach"
                )
            
            result = response.json()
            coach_response = result["choices"][0]["message"]["content"]
            
            return ChatResponse(
                response=coach_response,
                usage=result.get("usage")
            )
            
    except httpx.TimeoutException:
        logger.error("DeepSeek API timeout")
        raise HTTPException(status_code=504, detail="AI coach is taking too long to respond")
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to chat with AI coach")

@router.post("/chat-with-context", response_model=ChatResponse)
async def chat_with_context(
    request: ChatWithContextRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Chat with Coach Max using provided user context data.
    Frontend can provide context data from local SQLite database.
    Stateless service - no database access required.
    """
    try:
        logger.info(f"Context chat request from user {current_user['supabase_uid']}")
        logger.info(f"Request messages count: {len(request.messages)}")
        logger.info(f"Request user_context provided: {bool(request.user_context)}")
        logger.info(f"Request temperature: {request.temperature}")
        logger.info(f"Request max_tokens: {request.max_tokens}")
        
        # Build context-aware system prompt
        system_prompt = """You are Coach Max, an expert AI Health Coach and nutritionist. You're energetic, motivational, and provide practical, actionable advice. Use the provided user context to give personalized recommendations. Keep your tone friendly and supportive while being informative."""
        
        # Prepare messages with context
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add context if provided
        if request.user_context:
            context_message = f"Here's some context about the user: {request.user_context}"
            messages.append({"role": "system", "content": context_message})
        
        # Add user messages
        messages.extend([msg.dict() for msg in request.messages])
        
        # Get persistent HTTP client and AI limiter
        client = await get_http_client("deepseek")
        limiter = await get_ai_limiter()
        
        # Use AI limiter to prevent resource exhaustion
        async with limiter.limit("DeepSeek chat with context"):
            response = await client.post(
                "/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens
                },
                timeout=60.0  # Increased timeout from 30s to 60s
            )
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to get response from AI coach"
                )
            
            result = response.json()
            coach_response = result["choices"][0]["message"]["content"]
            
            return ChatResponse(
                response=coach_response,
                usage=result.get("usage")
            )
            
    except httpx.TimeoutException:
        logger.error("DeepSeek API timeout")
        raise HTTPException(status_code=504, detail="AI coach is taking too long to respond")
    except Exception as e:
        logger.error(f"Error in context chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to chat with AI coach") 