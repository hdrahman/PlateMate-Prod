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

@router.post("/nutrition-analysis", response_model=ChatResponse)
async def analyze_nutrition(
    request: NutritionAnalysisRequest,
    current_user: dict = Depends(get_current_user),
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
            
            logger.info(f"Nutrition analysis completed for user {current_user.get('uid')}")
            
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
    current_user: dict = Depends(get_current_user),
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