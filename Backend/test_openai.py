#!/usr/bin/env python3

import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

async def test_openai_api():
    """Test the OpenAI API setup"""
    load_dotenv()
    
    api_key = os.getenv("OPENAI_API_KEY")
    
    print("🧪 Testing OpenAI API setup...")
    print(f"API Key found: {'Yes' if api_key else 'No'}")
    
    if not api_key:
        print("❌ No OpenAI API key found in environment")
        return False
        
    if not api_key.startswith('sk-'):
        print("❌ Invalid OpenAI API key format")
        print(f"Key starts with: {api_key[:10]}...")
        return False
        
    print(f"✅ API Key format looks valid: {api_key[:10]}...")
    
    try:
        # Initialize the client
        client = AsyncOpenAI(api_key=api_key)
        
        # Test a simple completion
        print("📤 Testing API call...")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Respond with exactly 'API_TEST_SUCCESS' if you receive this message."
                },
                {
                    "role": "user",
                    "content": "Test message"
                }
            ],
            max_tokens=50,
            temperature=0
        )
        
        result = response.choices[0].message.content.strip()
        print(f"📝 API Response: {result}")
        
        if "API_TEST_SUCCESS" in result:
            print("✅ OpenAI API is working correctly!")
            return True
        else:
            print("⚠️ API responded but with unexpected content")
            return False
            
    except Exception as e:
        print(f"❌ OpenAI API test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_openai_api())
    exit(0 if success else 1) 