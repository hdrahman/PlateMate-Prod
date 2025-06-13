from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from DB import get_db
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os
import logging
from dotenv import load_dotenv
from auth.firebase_auth import get_current_user
from services.user_context_service import UserContextService

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
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

class NutritionAnalysisRequest(BaseModel):
    nutritionData: dict
    autoStart: bool = True

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

class ChatResponse(BaseModel):
    response: str
    usage: Optional[dict] = None

class ContextRequest(BaseModel):
    days_back: Optional[int] = 30

class ContextResponse(BaseModel):
    context: str
    summary: dict

class ChatWithContextRequest(BaseModel):
    messages: List[ChatMessage]
    days_back: Optional[int] = 30
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

@router.post("/nutrition-analysis", response_model=ChatResponse)
async def analyze_nutrition(
    request: NutritionAnalysisRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze nutrition data and provide coaching insights using DeepSeek V3.
    This endpoint is called when user taps 'Generate Report' in food log.
    """
    try:
        nutrition_data = request.nutritionData
        
        # Create context message for Coach Max
        system_prompt = """You are Coach Max, an expert AI Health Coach and nutritionist. You're energetic, motivational, and provide practical, actionable advice. Analyze the user's nutrition data and provide personalized insights, recommendations, and encouragement. Keep your tone friendly and supportive while being informative."""
        
        # Build nutrition context message
        context_message = f"""I've analyzed your nutrition data for {nutrition_data.get('date', 'today')}. Here's what I found:

CALORIES: {nutrition_data.get('calories', {}).get('consumed', 0)} consumed out of {nutrition_data.get('calories', {}).get('goal', 0)} goal

MACROS:
- Protein: {nutrition_data.get('macros', {}).get('protein', 0)}g
- Carbs: {nutrition_data.get('macros', {}).get('carbs', 0)}g  
- Fat: {nutrition_data.get('macros', {}).get('fat', 0)}g

MEALS: {', '.join([meal.get('name', 'Unknown meal') for meal in nutrition_data.get('meals', [])])}

EXERCISE: {nutrition_data.get('exercise', {}).get('total', 0)} calories burned

Let me give you personalized insights and recommendations to help you reach your health goals!"""

        # Prepare messages for DeepSeek
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context_message}
        ]
        
        # Call DeepSeek API securely from backend
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
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
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500, 
                    detail="Failed to get nutrition analysis from AI coach"
                )
            
            result = response.json()
            coach_response = result["choices"][0]["message"]["content"]
            
            logger.info(f"Nutrition analysis completed for user {current_user.firebase_uid}")
            
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    General chat endpoint for ongoing conversations with Coach Max.
    """
    try:
        # Call DeepSeek API securely from backend
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
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
                timeout=30.0
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

@router.get("/user-context", response_model=ContextResponse)
async def get_user_context(
    days_back: int = 30,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive user context for Coach Max.
    This endpoint aggregates user data for personalized coaching.
    """
    try:
        # current_user is already a User object from get_current_user
        user = current_user
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get comprehensive context
        context_summary = UserContextService.get_comprehensive_context(db, user.id, days_back)
        
        if isinstance(context_summary, dict) and context_summary.get("error"):
            raise HTTPException(status_code=500, detail=context_summary["error"])
        
        # Create a summary for the frontend
        summary = {
            "days_analyzed": days_back,
            "user_name": user.first_name,
            "context_loaded": True,
            "message": f"Loaded {days_back} days of activity data for personalized coaching"
        }
        
        logger.info(f"Context loaded for user {user.firebase_uid} ({days_back} days)")
        
        return ContextResponse(
            context=context_summary,
            summary=summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading user context: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load user context")

@router.post("/chat-with-context", response_model=ChatResponse)
async def chat_with_context(
    request: ChatWithContextRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Chat with Coach Max using comprehensive user context.
    This provides personalized coaching based on user's actual data.
    """
    try:
        # current_user is already a User object from get_current_user
        user = current_user
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user context
        user_context = UserContextService.get_comprehensive_context(db, user.id, request.days_back)
        
        if isinstance(user_context, dict) and user_context.get("error"):
            logger.warning(f"Context error for user {user.id}: {user_context['error']}")
            user_context = "Limited user data available. Providing general health guidance."
        
        # Enhanced system prompt with context
        enhanced_system_prompt = f"""You are Coach Max, an expert AI Health Coach and nutritionist with access to this user's recent activity data:

{user_context}

Provide personalized, data-driven advice based on their actual patterns, progress, and goals. Reference specific data points when relevant (e.g., "I see you've been averaging X calories this week" or "Your workout consistency has been great with X sessions this month"). Be encouraging about progress and constructive about areas for improvement.

Keep your responses friendly, supportive, and actionable. Use the user's actual data to provide specific, relevant advice rather than generic recommendations."""

        # Prepare messages with enhanced context
        messages = [{"role": "system", "content": enhanced_system_prompt}]
        
        # Add conversation history
        for msg in request.messages:
            if msg.role != "system":  # Skip any existing system messages
                messages.append({"role": msg.role, "content": msg.content})
        
        # Call DeepSeek API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
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
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to get contextual response from AI coach"
                )
            
            result = response.json()
            coach_response = result["choices"][0]["message"]["content"]
            
            logger.info(f"Contextual chat completed for user {user.firebase_uid}")
            
            return ChatResponse(
                response=coach_response,
                usage=result.get("usage")
            )
            
    except httpx.TimeoutException:
        logger.error("DeepSeek API timeout")
        raise HTTPException(status_code=504, detail="AI coach is taking too long to respond")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in contextual chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to chat with AI coach using context") 