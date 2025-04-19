from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from db import get_db
from pydantic import BaseModel
from typing import List, Optional
import requests
import os
import logging
from dotenv import load_dotenv

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
    "To build muscle, focus on consuming protein-rich foods like chicken, fish, eggs, and legumes. Aim for 1.6-2.2g of protein per kg of body weight daily.",
    "For muscle growth, ensure you're in a slight caloric surplus and prioritize compound exercises like squats, deadlifts, and bench press.",
    "Proper hydration is crucial for muscle growth. Drink at least 3-4 liters of water daily, especially around workout times.",
    "Don't neglect carbohydrates when building muscle. They're essential for energy during workouts and recovery afterward."
]

@router.post("/chat", response_model=ChatResponse)
async def chat_with_arli(request: ChatRequest):
    """
    Chat with Arli AI with conversation history support.
    """
    if not ARLI_AI_API_KEY:
        raise HTTPException(status_code=500, detail="Arli AI API key not configured")
    
    try:
        logger.info(f"Sending chat request to Arli AI with conversation ID: {request.conversation_id}")
        
        # Format messages for Arli AI API - using OpenAI format
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
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
        response = requests.post(
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
            
            return {
                "response": result["choices"][0]["message"]["content"],
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
                "response": "I'm sorry, but I'm having trouble connecting to my knowledge base right now. Please try again later.",
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