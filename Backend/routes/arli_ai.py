from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from DB import get_db
from pydantic import BaseModel
from typing import List, Optional
import requests
import os
import logging
import re
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Get Arli AI API key from environment variables
ARLI_AI_API_KEY = os.getenv("ARLI_AI_API_KEY")
if not ARLI_AI_API_KEY:
    logger.warning("Warning: ARLI_AI_API_KEY not found in environment variables")

# Base URL for Arli AI API - Corrected domain
ARLI_API_BASE_URL = "https://api.arliai.com/v1"  # Changed from arli.ai to arliai.com

# Default model to use
DEFAULT_MODEL = "Mistral-Nemo-12B-Instruct-2407"  # Use a model from their documentation

# Pydantic models for request and response
class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str

# Fallback responses if API fails
NUTRITION_RESPONSES = [
    "Hey there! Let's maximize your potential today! Focus on consuming protein-rich foods like chicken, fish, eggs, and legumes. Aim for 1.6-2.2g of protein per kg of body weight daily - your muscles will thank you!",
    "Ready to take your gains to the next level? Ensure you're in a slight caloric surplus and prioritize compound exercises like squats, deadlifts, and bench press. I believe you've got this!",
    "Hydration is your secret weapon for peak performance! Drink at least 3-4 liters of water daily, especially around workout times. Let's keep that energy flowing!",
    "Here's a game-changer for you: don't neglect carbohydrates when building muscle. They're essential for energy during workouts and recovery afterward. Think of them as fuel for your fitness journey!"
]

def clean_formatting(text):
    """Clean up markdown-style formatting for better display in the app"""
    # Replace markdown headers with plain text
    text = re.sub(r'#{1,6}\s+(.+?)(?:\n|$)', r'\1:\n', text)
    
    # Replace markdown bold/italic with plain text
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', text)  # Bold italic
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)      # Bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)          # Italic
    
    # Replace markdown bullet points with plain text bullets
    text = re.sub(r'^\s*[\*\-\+]\s+', '• ', text, flags=re.MULTILINE)
    
    # Replace numbered lists
    text = re.sub(r'^\s*(\d+)\.\s+', r'\1. ', text, flags=re.MULTILINE)
    
    # Clean up any multiple consecutive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text

def format_as_system_message(text):
    """Add a system-style formatting for responses"""
    if not text.strip():
        return "I'm sorry, I didn't get a proper response. Please try again."
    
    # Clean any markdown formatting
    cleaned_text = clean_formatting(text)
    
    return cleaned_text

@router.post("/chat", response_model=ChatResponse)
async def chat_with_arli(request: ChatRequest):
    """
    Chat with Arli AI with conversation history support.
    """
    if not ARLI_AI_API_KEY:
        raise HTTPException(status_code=500, detail="Arli AI API key not configured")
    
    try:
        logger.info(f"Sending chat request to Arli AI with conversation ID: {request.conversation_id}")
        
        # Add a system message asking for plain text responses if not already present
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Add system message if there isn't one already
        has_system_message = any(msg["role"] == "system" for msg in messages)
        if not has_system_message:
            messages.insert(0, {
                "role": "system", 
                "content": """You are Coach Max, an AI Health Coach with a motivational yet supportive personality. You're knowledgeable, adaptable, and results-focused, helping users maximize their health potential.

PERSONALITY TRAITS:
- Motivational: "Let's maximize your potential today!"
- Knowledgeable: Provide science-backed advice in simple terms
- Adaptable: Adjust your tone based on user needs (supportive vs. challenging)
- Results-oriented: Focus on achieving user's specific goals

SPEAKING STYLE:
- Encouraging: "Great job logging that meal! Let's see how we can optimize your afternoon snack."
- Educational: "Here's why protein timing matters for your goals..."
- Personal: "Based on your progress, I think you're ready for the next level."
- Actionable: "Here are 3 specific steps to improve your energy levels this week."

Keep responses focused on health, nutrition, and fitness advice. Use a tone that's like an encouraging friend who happens to be a health expert. Avoid using markdown formatting. Use plain text formatting only."""
            })
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ARLI_AI_API_KEY}"
        }
        
        payload = {
            "model": DEFAULT_MODEL,  # Required model parameter
            "messages": messages,
            "temperature": 0.7,  # Add sensible defaults
            "max_tokens": 1024,
            "top_p": 0.9,
            "stream": False
        }
        
        # If a conversation ID is provided, include it to maintain context
        if request.conversation_id:
            payload["conversation_id"] = request.conversation_id
        
        logger.info(f"Sending request to Arli AI: {ARLI_API_BASE_URL}/chat/completions")
        
        # Make the API request to Arli AI
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ARLI_API_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30  # Add timeout to prevent hanging
            )
        
        logger.info(f"Arli AI response status code: {response.status_code}")
        
        # Check if the request was successful
        if response.status_code != 200:
            logger.error(f"Arli AI API error: {response.status_code} - {response.text}")
            # Handle authentication errors
            if response.status_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Authentication failed with Arli AI API. Please check your API key."
                )
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Arli AI API error: {response.text}"
            )
        
        # Extract the response and conversation ID
        try:
            result = response.json()
            
            # Check response structure
            if "choices" not in result or not result.get("choices"):
                logger.error(f"Unexpected response format from Arli AI: {result}")
                raise HTTPException(
                    status_code=500,
                    detail="Received an unexpected response format from Arli AI"
                )
            
            if not result["choices"][0].get("message", {}).get("content"):
                logger.error(f"No message content in Arli AI response: {result}")
                raise HTTPException(
                    status_code=500,
                    detail="Received an empty message from Arli AI"
                )
            
            # Get the content and clean up any markdown formatting
            content = result["choices"][0]["message"]["content"]
            cleaned_content = clean_formatting(content)
            
            return {
                "response": cleaned_content,
                "conversation_id": result.get("conversation_id", "")
            }
            
        except requests.exceptions.JSONDecodeError as json_error:
            logger.error(f"Failed to parse response from Arli AI: {json_error}")
            logger.error(f"Response content: {response.text}")
            
            # Fallback to local response if API fails
            logger.info("Falling back to local response due to API error")
            
            # Get last user message for context
            user_message = ""
            for msg in reversed(request.messages):
                if msg.role == "user":
                    user_message = msg.content.lower()
                    break
                    
            # Use existing conversation_id or generate a new one
            conversation_id = request.conversation_id or "fallback-session"
            
            # Return a fallback response
            return {
                "response": "Hey there! I'm having some technical difficulties connecting to my knowledge base right now, but I'm still here to help! Let's try again in a moment - we've got goals to crush!",
                "conversation_id": conversation_id
            }
            
    except requests.exceptions.Timeout:
        logger.error("Timeout connecting to Arli AI API")
        raise HTTPException(
            status_code=504,
            detail="Connection to Arli AI timed out. Please try again later."
        )
    except requests.exceptions.ConnectionError:
        logger.error("Connection error with Arli AI API")
        raise HTTPException(
            status_code=503,
            detail="Could not connect to Arli AI API. Please check your internet connection."
        )
    except Exception as e:
        logger.error(f"Error chatting with Arli AI: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Error chatting with Arli AI: {str(e)}"
        ) 