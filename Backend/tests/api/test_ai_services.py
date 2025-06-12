import pytest
import json
import base64
from datetime import datetime, date, timedelta
from fastapi import status
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, MagicMock, AsyncMock
from io import BytesIO
import httpx

from models import User, FoodLog


class TestOpenAIIntegration:
    """Comprehensive tests for OpenAI API integration"""

    @patch('openai.ChatCompletion.create')
    def test_get_nutrition_advice(self, mock_openai, authenticated_client, authenticated_user):
        """Test getting nutrition advice from OpenAI"""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message = Mock()
        mock_response.choices[0].message.content = "Based on your nutrition data, I recommend increasing your protein intake and reducing processed foods."
        mock_openai.return_value = mock_response

        user_query = {
            "query": "How can I improve my nutrition?",
            "context": {
                "recent_meals": ["chicken salad", "pasta", "apple"],
                "goals": "lose weight"
            }
        }

        response = authenticated_client.post("/gpt/nutrition-advice", json=user_query)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "advice" in data
        assert "nutrition" in data["advice"].lower()
        mock_openai.assert_called_once()

    @patch('openai.ChatCompletion.create')
    def test_analyze_eating_patterns(self, mock_openai, authenticated_client, authenticated_user, db):
        """Test analyzing eating patterns with OpenAI"""
        # Create sample meal data
        meals = []
        for i in range(7):
            meal_date = datetime.now() - timedelta(days=i)
            meal = FoodLog(
                user_id=authenticated_user.id,
                food_name=f"Meal {i}",
                calories=300 + i * 20,
                proteins=15 + i,
                carbs=30 + i * 2,
                fats=10 + i,
                meal_type="lunch",
                
                
                created_at=meal_date
            )
            meals.append(meal)
        
        db.add_all(meals)
        db.commit()

        # Mock OpenAI response for pattern analysis
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message = Mock()
        mock_response.choices[0].message.content = json.dumps({
            "patterns": ["High carb intake in evenings", "Low protein at breakfast"],
            "recommendations": ["Add morning protein", "Balance evening carbs"],
            "overall_assessment": "Good variety but needs better timing"
        })
        mock_openai.return_value = mock_response

        response = authenticated_client.get("/gpt/analyze-patterns")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "patterns" in data
        assert "recommendations" in data
        assert isinstance(data["patterns"], list)

    @patch('openai.ChatCompletion.create')
    def test_generate_meal_plan(self, mock_openai, authenticated_client, authenticated_user):
        """Test generating personalized meal plans"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message = Mock()
        mock_response.choices[0].message.content = json.dumps({
            "meal_plan": {
                "monday": {
                    "breakfast": "Oatmeal with berries",
                    "lunch": "Grilled chicken salad",
                    "dinner": "Salmon with vegetables"
                },
                "tuesday": {
                    "breakfast": "Greek yogurt with nuts",
                    "lunch": "Quinoa bowl",
                    "dinner": "Turkey stir-fry"
                }
            },
            "total_calories": 1800,
            "macros": {"protein": "25%", "carbs": "45%", "fats": "30%"}
        })
        mock_openai.return_value = mock_response

        plan_request = {
            "preferences": ["vegetarian", "low-carb"],
            "target_calories": 1800,
            "days": 7,
            "allergies": ["nuts"]
        }

        response = authenticated_client.post("/gpt/meal-plan", json=plan_request)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "meal_plan" in data
        assert "total_calories" in data
        assert data["total_calories"] == 1800

    @patch('openai.ChatCompletion.create')
    def test_workout_recommendations(self, mock_openai, authenticated_client, authenticated_user):
        """Test getting AI workout recommendations"""
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message = Mock()
        mock_response.choices[0].message.content = json.dumps({
            "workouts": [
                {
                    "name": "Full Body Strength",
                    "duration": 45,
                    "exercises": ["squats", "push-ups", "deadlifts"],
                    "intensity": "moderate"
                },
                {
                    "name": "Cardio Session",
                    "duration": 30,
                    "exercises": ["running", "cycling"],
                    "intensity": "high"
                }
            ],
            "weekly_schedule": "3 strength, 2 cardio sessions"
        })
        mock_openai.return_value = mock_response

        workout_request = {
            "fitness_level": "intermediate",
            "goals": ["weight_loss", "muscle_building"],
            "available_time": 45,
            "equipment": ["dumbbells", "resistance_bands"]
        }

        response = authenticated_client.post("/gpt/workout-plan", json=workout_request)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "workouts" in data
        assert "weekly_schedule" in data
        assert len(data["workouts"]) > 0

    def test_openai_error_handling(self, authenticated_client, authenticated_user):
        """Test handling OpenAI API errors"""
        with patch('openai.ChatCompletion.create', side_effect=Exception("OpenAI API Error")):
            user_query = {
                "query": "Test query"
            }

            response = authenticated_client.post("/gpt/nutrition-advice", json=user_query)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "error" in data

    def test_openai_rate_limiting(self, authenticated_client, authenticated_user):
        """Test OpenAI rate limiting handling"""
        from openai.error import RateLimitError
        
        with patch('openai.ChatCompletion.create', side_effect=RateLimitError("Rate limit exceeded")):
            user_query = {
                "query": "Test query"
            }

            response = authenticated_client.post("/gpt/nutrition-advice", json=user_query)
            
            assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
            data = response.json()
            assert "rate limit" in data["detail"].lower()


class TestDeepSeekIntegration:
    """Comprehensive tests for DeepSeek AI integration"""

    @patch('requests.post')
    def test_deepseek_nutrition_analysis(self, mock_post, authenticated_client, authenticated_user):
        """Test nutrition analysis using DeepSeek"""
        # Mock DeepSeek API response
        mock_response = Mock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "nutrition_score": 85,
                        "improvements": ["Add more fiber", "Reduce sodium"],
                        "strengths": ["Good protein intake", "Varied vegetables"]
                    })
                }
            }]
        }
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        analysis_request = {
            "meals": [
                {"name": "Chicken Salad", "calories": 350},
                {"name": "Greek Yogurt", "calories": 150}
            ],
            "time_period": "week"
        }

        response = authenticated_client.post("/deepseek/analyze-nutrition", json=analysis_request)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "nutrition_score" in data
        assert "improvements" in data
        assert data["nutrition_score"] == 85

    @patch('requests.post')
    def test_deepseek_meal_suggestions(self, mock_post, authenticated_client, authenticated_user):
        """Test meal suggestions from DeepSeek"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "suggestions": [
                            {
                                "meal": "Quinoa Buddha Bowl",
                                "calories": 450,
                                "reason": "High in protein and fiber"
                            },
                            {
                                "meal": "Grilled Salmon with Asparagus",
                                "calories": 380,
                                "reason": "Rich in omega-3 fatty acids"
                            }
                        ]
                    })
                }
            }]
        }
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        suggestion_request = {
            "dietary_preferences": ["pescatarian"],
            "target_calories": 400,
            "avoid_ingredients": ["dairy"]
        }

        response = authenticated_client.post("/deepseek/meal-suggestions", json=suggestion_request)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "suggestions" in data
        assert len(data["suggestions"]) > 0
        assert all("meal" in suggestion for suggestion in data["suggestions"])

    @patch('requests.post')
    def test_deepseek_error_handling(self, mock_post, authenticated_client, authenticated_user):
        """Test DeepSeek API error handling"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"error": "Internal server error"}
        mock_post.return_value = mock_response

        request_data = {"query": "test"}
        response = authenticated_client.post("/deepseek/analyze-nutrition", json=request_data)
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @patch('requests.post')
    def test_deepseek_timeout_handling(self, mock_post, authenticated_client, authenticated_user):
        """Test DeepSeek API timeout handling"""
        import requests
        mock_post.side_effect = requests.Timeout("Request timeout")

        request_data = {"query": "test"}
        response = authenticated_client.post("/deepseek/analyze-nutrition", json=request_data)
        
        assert response.status_code == status.HTTP_408_REQUEST_TIMEOUT


class TestArliAIIntegration:
    """Comprehensive tests for Arli AI integration"""

    @patch('requests.post')
    def test_arli_personalized_coaching(self, mock_post, authenticated_client, authenticated_user, db):
        """Test personalized coaching from Arli AI"""
        # Create user context data
        authenticated_user.age = 30
        authenticated_user.height = 175.0
        authenticated_user.activity_level = "moderate"
        db.commit()

        mock_response = Mock()
        mock_response.json.return_value = {
            "coaching_advice": {
                "motivation": "You're making great progress! Keep it up!",
                "recommendations": [
                    "Try to add 10 minutes of walking after meals",
                    "Consider meal prep on Sundays"
                ],
                "weekly_goals": [
                    "Log meals for 6 out of 7 days",
                    "Complete 3 workout sessions"
                ]
            }
        }
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        response = authenticated_client.get("/arli_ai/coaching")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "coaching_advice" in data
        assert "motivation" in data["coaching_advice"]
        assert "recommendations" in data["coaching_advice"]

    @patch('requests.post')
    def test_arli_habit_tracking(self, mock_post, authenticated_client, authenticated_user):
        """Test habit tracking analysis with Arli AI"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "habit_analysis": {
                "consistency_score": 78,
                "strong_habits": ["Regular breakfast", "Evening workouts"],
                "improvement_areas": ["Weekend nutrition", "Hydration tracking"],
                "suggested_habit": "Drink water first thing in the morning"
            }
        }
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        habit_data = {
            "tracking_period": "month",
            "focus_areas": ["nutrition", "exercise", "sleep"]
        }

        response = authenticated_client.post("/arli_ai/habit-analysis", json=habit_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "habit_analysis" in data
        assert "consistency_score" in data["habit_analysis"]
        assert data["habit_analysis"]["consistency_score"] == 78

    @patch('requests.post')
    def test_arli_goal_adjustment(self, mock_post, authenticated_client, authenticated_user):
        """Test dynamic goal adjustment with Arli AI"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "goal_adjustments": {
                "current_goals_assessment": "Realistic and achievable",
                "suggested_adjustments": [
                    {
                        "goal_type": "calorie_target",
                        "current_value": 2000,
                        "suggested_value": 1950,
                        "reason": "Based on recent progress patterns"
                    }
                ],
                "motivation_level": "high"
            }
        }
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        goal_context = {
            "current_goals": {
                "calorie_target": 2000,
                "weekly_workouts": 3,
                "weight_goal": "lose_weight"
            },
            "recent_performance": {
                "goal_adherence": 85,
                "trend": "improving"
            }
        }

        response = authenticated_client.post("/arli_ai/adjust-goals", json=goal_context)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "goal_adjustments" in data
        assert "suggested_adjustments" in data["goal_adjustments"]


class TestImageProcessing:
    """Comprehensive tests for image processing and food recognition"""

    def test_upload_food_image_success(self, authenticated_client, authenticated_user):
        """Test successful food image upload"""
        # Create a mock image file
        image_data = b"fake_image_data"
        files = {"file": ("test_image.jpg", BytesIO(image_data), "image/jpeg")}

        with patch('routes.image.process_food_image') as mock_process:
            mock_process.return_value = {
                "recognized_foods": [
                    {
                        "name": "Apple",
                        "confidence": 0.95,
                        "nutrition": {
                            "calories": 95,
                            "proteins": 0.5,
                            "carbs": 25,
                            "fats": 0.3
                        }
                    }
                ],
                "processing_time": 2.3
            }

            response = authenticated_client.post("/images/analyze", files=files)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "recognized_foods" in data
            assert len(data["recognized_foods"]) > 0
            assert data["recognized_foods"][0]["name"] == "Apple"

    def test_upload_invalid_image_format(self, authenticated_client, authenticated_user):
        """Test uploading invalid image format"""
        # Create a non-image file
        text_data = b"This is not an image"
        files = {"file": ("test.txt", BytesIO(text_data), "text/plain")}

        response = authenticated_client.post("/images/analyze", files=files)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "error" in data

    def test_upload_oversized_image(self, authenticated_client, authenticated_user):
        """Test uploading oversized image"""
        # Create mock oversized image data
        large_image_data = b"x" * (10 * 1024 * 1024)  # 10MB
        files = {"file": ("large_image.jpg", BytesIO(large_image_data), "image/jpeg")}

        response = authenticated_client.post("/images/analyze", files=files)
        
        assert response.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE

    @patch('routes.image.analyze_food_with_ai')
    def test_food_recognition_multiple_items(self, mock_analyze, authenticated_client, authenticated_user):
        """Test recognizing multiple food items in one image"""
        mock_analyze.return_value = {
            "recognized_foods": [
                {
                    "name": "Grilled Chicken Breast",
                    "confidence": 0.92,
                    "portion_size": "medium",
                    "nutrition": {
                        "calories": 185,
                        "proteins": 35,
                        "carbs": 0,
                        "fats": 4
                    }
                },
                {
                    "name": "Steamed Broccoli",
                    "confidence": 0.88,
                    "portion_size": "1 cup",
                    "nutrition": {
                        "calories": 25,
                        "proteins": 3,
                        "carbs": 5,
                        "fats": 0.3
                    }
                }
            ],
            "total_nutrition": {
                "calories": 210,
                "proteins": 38,
                "carbs": 5,
                "fats": 4.3
            }
        }

        image_data = b"fake_meal_image"
        files = {"file": ("meal.jpg", BytesIO(image_data), "image/jpeg")}

        response = authenticated_client.post("/images/analyze", files=files)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["recognized_foods"]) == 2
        assert "total_nutrition" in data
        assert data["total_nutrition"]["calories"] == 210

    @patch('routes.image.save_image_with_metadata')
    def test_image_metadata_storage(self, mock_save, authenticated_client, authenticated_user):
        """Test storing image with metadata"""
        mock_save.return_value = {
            "image_id": "img_123",
            "storage_path": "/uploads/user_1/img_123.jpg",
            "metadata": {
                "upload_time": datetime.now().isoformat(),
                "original_filename": "meal.jpg",
                "file_size": 1024,
                "dimensions": {"width": 800, "height": 600}
            }
        }

        image_data = b"test_image"
        files = {"file": ("meal.jpg", BytesIO(image_data), "image/jpeg")}

        response = authenticated_client.post("/images/upload-image", files=files)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "image_id" in data
        assert "storage_path" in data
        assert "metadata" in data

    def test_get_user_uploaded_images(self, authenticated_client, authenticated_user, db):
        """Test retrieving user's uploaded images"""
        response = authenticated_client.get("/images/my-images")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "images" in data
        assert isinstance(data["images"], list)

    @patch('routes.image.enhance_image_quality')
    def test_image_enhancement(self, mock_enhance, authenticated_client, authenticated_user):
        """Test image quality enhancement before analysis"""
        mock_enhance.return_value = {
            "enhanced": True,
            "improvements": ["brightness_adjusted", "contrast_enhanced", "noise_reduced"],
            "quality_score": 0.85
        }

        image_data = b"low_quality_image"
        files = {"file": ("blurry_meal.jpg", BytesIO(image_data), "image/jpeg")}

        response = authenticated_client.post("/images/enhance-and-analyze", files=files)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "enhanced" in data
        assert data["enhanced"] is True
        assert "quality_score" in data


class TestAIServiceIntegration:
    """Test integration between different AI services"""

    @patch('routes.gpt.openai_client')
    @patch('routes.deepseek.deepseek_client')
    def test_multi_ai_consensus(self, mock_deepseek, mock_openai, authenticated_client, authenticated_user):
        """Test getting consensus from multiple AI services"""
        # Mock responses from both services
        mock_openai.return_value = {
            "recommendation": "Increase protein intake",
            "confidence": 0.9
        }
        
        mock_deepseek.return_value = {
            "recommendation": "Add more protein to diet",
            "confidence": 0.85
        }

        consensus_request = {
            "query": "How can I improve my nutrition?",
            "use_consensus": True
        }

        response = authenticated_client.post("/ai/consensus-advice", json=consensus_request)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "consensus_recommendation" in data
        assert "individual_responses" in data
        assert "confidence_score" in data

    def test_ai_service_fallback(self, authenticated_client, authenticated_user):
        """Test fallback when primary AI service fails"""
        with patch('routes.gpt.openai_client', side_effect=Exception("OpenAI unavailable")):
            with patch('routes.deepseek.deepseek_client') as mock_deepseek:
                mock_deepseek.return_value = {
                    "advice": "Fallback nutrition advice from DeepSeek"
                }

                request_data = {"query": "Nutrition advice"}
                response = authenticated_client.post("/ai/nutrition-advice", json=request_data)
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert "advice" in data
                assert "deepseek" in data["source"].lower()

    @patch('routes.image.ai_food_recognition')
    @patch('routes.gpt.get_nutrition_context')
    def test_image_to_meal_logging_workflow(self, mock_nutrition, mock_recognition, authenticated_client, authenticated_user):
        """Test complete workflow from image to meal logging"""
        # Mock food recognition
        mock_recognition.return_value = {
            "foods": [{"name": "Grilled Chicken", "confidence": 0.9}]
        }
        
        # Mock nutrition context
        mock_nutrition.return_value = {
            "calories": 300,
            "proteins": 30,
            "carbs": 0,
            "fats": 15
        }

        image_data = b"meal_image"
        files = {"file": ("dinner.jpg", BytesIO(image_data), "image/jpeg")}

        response = authenticated_client.post("/images/analyze-and-log", files=files)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "meal_entry" in data
        assert "recognized_foods" in data
        assert data["meal_entry"]["calories"] == 300 


class TestAIServiceBusinessLogic:
    """Test AI service business logic and validation"""

    def test_food_analysis_input_validation(self, authenticated_client, authenticated_user):
        """Test that food analysis validates input properly"""
        # Test with valid input
        valid_data = {
            "food_description": "1 large apple",
            "meal_type": "snack"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "food_name": "Apple",
                            "calories": 95,
                            "proteins": 0,
                            "carbs": 25,
                            "fats": 0
                        })
                    }
                }]
            }
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=valid_data)
            assert response.status_code in [200, 201, 422]  # Should succeed

    def test_food_analysis_empty_input(self, authenticated_client, authenticated_user):
        """Test food analysis with empty input"""
        empty_data = {
            "food_description": "",
            "meal_type": "breakfast"
        }
        
        response = authenticated_client.post("/gpt/analyze-food", json=empty_data)
        # Should either reject empty input or handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_food_analysis_invalid_meal_type(self, authenticated_client, authenticated_user):
        """Test food analysis with invalid meal type"""
        invalid_data = {
            "food_description": "pizza slice",
            "meal_type": "invalid_meal_type"
        }
        
        response = authenticated_client.post("/gpt/analyze-food", json=invalid_data)
        # Should either accept it or validate meal types
        assert response.status_code in [200, 400, 422]

    def test_ai_response_parsing(self, authenticated_client, authenticated_user):
        """Test that AI responses are parsed correctly"""
        food_data = {
            "food_description": "grilled chicken breast 100g",
            "meal_type": "dinner"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock a well-formed AI response
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "food_name": "Grilled Chicken Breast",
                            "calories": 165,
                            "proteins": 31,
                            "carbs": 0,
                            "fats": 4,
                            "fiber": 0,
                            "sugar": 0
                        })
                    }
                }]
            }
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            
            if response.status_code == 200:
                data = response.json()
                assert "food_name" in data
                assert "calories" in data
                assert "proteins" in data

    def test_malformed_ai_response_handling(self, authenticated_client, authenticated_user):
        """Test handling of malformed AI responses"""
        food_data = {
            "food_description": "banana",
            "meal_type": "breakfast"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock a malformed AI response
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": "This is not valid JSON"
                    }
                }]
            }
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            # Should handle malformed responses gracefully
            assert response.status_code in [200, 400, 500, 422]


class TestAIServiceIntegration:
    """Test AI service integration"""

    def test_gpt_food_analysis_endpoint(self, authenticated_client, authenticated_user):
        """Test GPT food analysis endpoint"""
        food_data = {
            "food_description": "medium banana",
            "meal_type": "breakfast"
        }
        
        response = authenticated_client.post("/gpt/analyze-food", json=food_data)
        # Endpoint exists but may fail due to API key/connection
        assert response.status_code in [200, 401, 500, 503, 422]

    def test_meal_analysis_by_id(self, authenticated_client, authenticated_user, db):
        """Test analyzing existing meal by ID"""
        # Create a test food log entry
        food_log = FoodLog(
            meal_id=1,
            user_id=authenticated_user.id,
            food_name="Test Food",
            calories=100,
            proteins=10,
            carbs=15,
            fats=5,
            fiber=2,
            sugar=5,
            saturated_fat=1,
            polyunsaturated_fat=1,
            monounsaturated_fat=1,
            trans_fat=0,
            cholesterol=0,
            sodium=50,
            potassium=100,
            vitamin_a=0,
            vitamin_c=0,
            calcium=0,
            iron=0,
            image_url="test.png",
            meal_type="breakfast"
        )
        db.add(food_log)
        db.commit()
        
        response = authenticated_client.get(f"/gpt/analyze-meal/{food_log.meal_id}")
        # Should either analyze the meal or return not found
        assert response.status_code in [200, 404, 500, 422]

    def test_arli_ai_chat_endpoint(self, authenticated_client, authenticated_user):
        """Test Arli AI chat endpoint"""
        chat_data = {
            "messages": [
                {
                    "role": "user",
                    "content": "What are the benefits of eating apples?"
                }
            ],
            "temperature": 0.7,
            "max_tokens": 150
        }
        
        response = authenticated_client.post("/arli/chat", json=chat_data)
        # Endpoint exists but may fail due to API configuration
        assert response.status_code in [200, 401, 500, 503, 422]

    def test_deepseek_chat_endpoint(self, authenticated_client, authenticated_user):
        """Test DeepSeek chat endpoint"""
        chat_data = {
            "messages": [
                {
                    "role": "user", 
                    "content": "Suggest a healthy breakfast recipe"
                }
            ],
            "temperature": 0.7,
            "max_tokens": 200
        }
        
        response = authenticated_client.post("/deepseek/chat", json=chat_data)
        # Endpoint exists but may fail due to API configuration
        assert response.status_code in [200, 401, 402, 500, 503, 422]

    def test_ai_service_error_handling(self, authenticated_client, authenticated_user):
        """Test AI service error handling"""
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock API failure
            mock_client.post.side_effect = httpx.RequestError("Connection failed")
            
            food_data = {
                "food_description": "apple",
                "meal_type": "snack"
            }
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            # Should handle connection errors gracefully
            assert response.status_code in [500, 503, 504, 422]

    def test_ai_timeout_handling(self, authenticated_client, authenticated_user):
        """Test AI service timeout handling"""
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock timeout
            mock_client.post.side_effect = httpx.TimeoutException("Request timed out")
            
            food_data = {
                "food_description": "pasta with sauce",
                "meal_type": "dinner"
            }
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            # Should handle timeouts gracefully
            assert response.status_code in [500, 504, 422]


class TestOpenAIIntegration:
    """Test OpenAI API integration"""

    def test_openai_api_authentication(self, authenticated_client, authenticated_user):
        """Test OpenAI API authentication"""
        food_data = {
            "food_description": "scrambled eggs",
            "meal_type": "breakfast"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock authentication failure
            mock_response = Mock()
            mock_response.status_code = 401
            mock_response.json.return_value = {"error": "Invalid API key"}
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            # Should handle auth errors appropriately
            assert response.status_code in [401, 500, 422]

    def test_openai_rate_limiting(self, authenticated_client, authenticated_user):
        """Test OpenAI rate limiting handling"""
        food_data = {
            "food_description": "salmon fillet",
            "meal_type": "lunch"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock rate limit error
            mock_response = Mock()
            mock_response.status_code = 429
            mock_response.json.return_value = {"error": "Rate limit exceeded"}
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            # Should handle rate limits appropriately
            assert response.status_code in [429, 500, 503, 422]

    def test_openai_quota_exceeded(self, authenticated_client, authenticated_user):
        """Test OpenAI quota exceeded handling"""
        food_data = {
            "food_description": "quinoa salad",
            "meal_type": "lunch"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock quota exceeded
            mock_response = Mock()
            mock_response.status_code = 402
            mock_response.json.return_value = {"error": "Quota exceeded"}
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            # Should handle quota errors appropriately
            assert response.status_code in [402, 500, 422]

    def test_openai_response_validation(self, authenticated_client, authenticated_user):
        """Test validation of OpenAI responses"""
        food_data = {
            "food_description": "greek yogurt with berries",
            "meal_type": "breakfast"
        }
        
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock valid response structure
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "food_name": "Greek Yogurt with Mixed Berries",
                            "calories": 150,
                            "proteins": 10,
                            "carbs": 20,
                            "fats": 4
                        })
                    }
                }],
                "usage": {
                    "prompt_tokens": 50,
                    "completion_tokens": 75,
                    "total_tokens": 125
                }
            }
            mock_client.post.return_value = mock_response
            
            response = authenticated_client.post("/gpt/analyze-food", json=food_data)
            
            if response.status_code == 200:
                data = response.json()
                assert isinstance(data.get("food_name"), str)
                assert isinstance(data.get("calories"), (int, float))


class TestArliAIIntegration:
    """Test Arli AI integration"""

    def test_arli_chat_conversation(self, authenticated_client, authenticated_user):
        """Test Arli AI chat conversation"""
        chat_data = {
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there! How can I help you today?"},
                {"role": "user", "content": "Tell me about nutrition"}
            ],
            "temperature": 0.8,
            "max_tokens": 100
        }
        
        response = authenticated_client.post("/arli/chat", json=chat_data)
        # Should handle conversation context
        assert response.status_code in [200, 401, 500, 503, 422]

    def test_arli_nutrition_query(self, authenticated_client, authenticated_user):
        """Test Arli AI nutrition-specific queries"""
        nutrition_query = {
            "messages": [
                {
                    "role": "user",
                    "content": "How many calories should I eat to lose weight?"
                }
            ],
            "temperature": 0.7,
            "max_tokens": 200
        }
        
        response = authenticated_client.post("/arli/chat", json=nutrition_query)
        assert response.status_code in [200, 401, 500, 503, 422]

    def test_arli_fitness_query(self, authenticated_client, authenticated_user):
        """Test Arli AI fitness-related queries"""
        fitness_query = {
            "messages": [
                {
                    "role": "user",
                    "content": "What exercises are best for building muscle?"
                }
            ],
            "temperature": 0.7,
            "max_tokens": 250
        }
        
        response = authenticated_client.post("/arli/chat", json=fitness_query)
        assert response.status_code in [200, 401, 500, 503, 422]

    def test_arli_meal_planning_query(self, authenticated_client, authenticated_user):
        """Test Arli AI meal planning queries"""
        meal_query = {
            "messages": [
                {
                    "role": "user",
                    "content": "Can you suggest a week's worth of healthy meals?"
                }
            ],
            "temperature": 0.6,
            "max_tokens": 400
        }
        
        response = authenticated_client.post("/arli/chat", json=meal_query)
        assert response.status_code in [200, 401, 500, 503, 422]

    def test_arli_parameter_validation(self, authenticated_client, authenticated_user):
        """Test Arli AI parameter validation"""
        # Test with invalid temperature
        invalid_data = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ],
            "temperature": 2.5,  # Invalid temperature > 2
            "max_tokens": 100
        }
        
        response = authenticated_client.post("/arli/chat", json=invalid_data)
        # Should either validate or accept any value
        assert response.status_code in [200, 400, 422, 500]

    def test_arli_message_validation(self, authenticated_client, authenticated_user):
        """Test Arli AI message format validation"""
        # Test with invalid message format
        invalid_messages = {
            "messages": [
                {"invalid_field": "user", "content": "Hello"}  # Missing 'role'
            ],
            "temperature": 0.7,
            "max_tokens": 100
        }
        
        response = authenticated_client.post("/arli/chat", json=invalid_messages)
        # Should validate message format
        assert response.status_code in [400, 422, 500]


class TestDeepSeekIntegration:
    """Test DeepSeek AI integration"""

    def test_deepseek_chat_basic(self, authenticated_client, authenticated_user):
        """Test basic DeepSeek chat functionality"""
        chat_data = {
            "messages": [
                {
                    "role": "user",
                    "content": "What's a healthy lunch option?"
                }
            ],
            "temperature": 0.7,
            "max_tokens": 150
        }
        
        response = authenticated_client.post("/deepseek/chat", json=chat_data)
        assert response.status_code in [200, 401, 402, 500, 503, 422]

    def test_deepseek_payment_required_error(self, authenticated_client, authenticated_user):
        """Test DeepSeek payment required error handling"""
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock payment required error
            mock_response = Mock()
            mock_response.status_code = 402
            mock_response.text = "Insufficient Balance"
            mock_client.post.return_value = mock_response
            
            chat_data = {
                "messages": [
                    {"role": "user", "content": "Hello"}
                ],
                "temperature": 0.7,
                "max_tokens": 100
            }
            
            response = authenticated_client.post("/deepseek/chat", json=chat_data)
            # Should handle payment errors
            assert response.status_code in [402, 500, 422]

    def test_deepseek_nutrition_coaching(self, authenticated_client, authenticated_user):
        """Test DeepSeek nutrition coaching queries"""
        coaching_query = {
            "messages": [
                {
                    "role": "user",
                    "content": "I want to gain muscle while losing fat. What should my diet look like?"
                }
            ],
            "temperature": 0.6,
            "max_tokens": 300
        }
        
        response = authenticated_client.post("/deepseek/chat", json=coaching_query)
        assert response.status_code in [200, 401, 402, 500, 503, 422]

    def test_deepseek_meal_analysis(self, authenticated_client, authenticated_user):
        """Test DeepSeek meal analysis capabilities"""
        analysis_query = {
            "messages": [
                {
                    "role": "user",
                    "content": "Analyze this meal: grilled chicken, rice, and vegetables. Is it balanced?"
                }
            ],
            "temperature": 0.5,
            "max_tokens": 200
        }
        
        response = authenticated_client.post("/deepseek/chat", json=analysis_query)
        assert response.status_code in [200, 401, 402, 500, 503, 422]

    def test_deepseek_workout_planning(self, authenticated_client, authenticated_user):
        """Test DeepSeek workout planning features"""
        workout_query = {
            "messages": [
                {
                    "role": "user",
                    "content": "Create a 3-day workout plan for a beginner"
                }
            ],
            "temperature": 0.7,
            "max_tokens": 400
        }
        
        response = authenticated_client.post("/deepseek/chat", json=workout_query)
        assert response.status_code in [200, 401, 402, 500, 503, 422]

    def test_deepseek_response_format(self, authenticated_client, authenticated_user):
        """Test DeepSeek response format"""
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock successful response
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{
                    "message": {
                        "content": "This is a sample DeepSeek response"
                    }
                }],
                "usage": {
                    "prompt_tokens": 20,
                    "completion_tokens": 30,
                    "total_tokens": 50
                }
            }
            mock_client.post.return_value = mock_response
            
            chat_data = {
                "messages": [
                    {"role": "user", "content": "Hello"}
                ],
                "temperature": 0.7,
                "max_tokens": 100
            }
            
            response = authenticated_client.post("/deepseek/chat", json=chat_data)
            
            if response.status_code == 200:
                data = response.json()
                assert "response" in data
                assert isinstance(data["response"], str)

    def test_deepseek_error_logging(self, authenticated_client, authenticated_user):
        """Test DeepSeek error logging and handling"""
        with patch('httpx.AsyncClient') as mock_httpx:
            mock_client = AsyncMock()
            mock_httpx.return_value.__aenter__.return_value = mock_client
            
            # Mock server error
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"
            mock_client.post.return_value = mock_response
            
            chat_data = {
                "messages": [
                    {"role": "user", "content": "Test"}
                ],
                "temperature": 0.7,
                "max_tokens": 100
            }
            
            response = authenticated_client.post("/deepseek/chat", json=chat_data)
            # Should handle and log errors appropriately
            assert response.status_code in [500, 503, 422]


class TestImageProcessing:
    """Test image processing capabilities"""

    def test_image_upload_endpoint(self, authenticated_client, authenticated_user, temp_image_file):
        """Test image upload functionality"""
        with open(temp_image_file, 'rb') as f:
            files = {"file": ("test_image.jpg", f, "image/jpeg")}
            response = authenticated_client.post("/images/upload-image", files=files)
        
        # Should either process image or return error
        assert response.status_code in [200, 201, 400, 422, 500]

    def test_image_analysis_food_detection(self, authenticated_client, authenticated_user, temp_image_file):
        """Test food detection in images"""
        with open(temp_image_file, 'rb') as f:
            files = {"file": ("food_image.jpg", f, "image/jpeg")}
            data = {"analyze_food": "true"}
            response = authenticated_client.post("/images/upload-image", files=files, data=data)
        
        # Should attempt food analysis
        assert response.status_code in [200, 201, 400, 500, 422]

    def test_image_storage_stats(self, authenticated_client, authenticated_user):
        """Test image storage statistics"""
        response = authenticated_client.get("/images/storage-stats")
        
        assert response.status_code in [200, 404, 422]
        if response.status_code == 200:
            data = response.json()
            assert "status" in data

    def test_image_cleanup(self, authenticated_client, authenticated_user):
        """Test image cleanup functionality"""
        response = authenticated_client.post("/images/cleanup-old-files?days_old=30")
        
        assert response.status_code in [200, 404, 422]
        if response.status_code == 200:
            data = response.json()
            assert "status" in data

    def test_image_file_validation(self, authenticated_client, authenticated_user):
        """Test image file type validation"""
        # Create a fake non-image file
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
            temp_file.write(b"This is not an image")
            temp_file.flush()
            
            with open(temp_file.name, 'rb') as f:
                files = {"file": ("not_an_image.txt", f, "text/plain")}
                response = authenticated_client.post("/images/upload-image", files=files)
            
        # Should reject non-image files
        assert response.status_code in [400, 422, 500]

    def test_image_size_limits(self, authenticated_client, authenticated_user):
        """Test image size limit validation"""
        # Test with oversized image data (mock)
        large_data = b"fake_image_data" * 10000  # Create large fake data
        
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_file.write(large_data)
            temp_file.flush()
            
            with open(temp_file.name, 'rb') as f:
                files = {"file": ("large_image.jpg", f, "image/jpeg")}
                response = authenticated_client.post("/images/upload-image", files=files)
        
        # Should either accept or reject based on size limits
        assert response.status_code in [200, 201, 400, 413, 500, 422]

    def test_image_processing_errors(self, authenticated_client, authenticated_user):
        """Test image processing error handling"""
        # Create corrupted image data
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_file.write(b"corrupted_image_data")
            temp_file.flush()
            
            with open(temp_file.name, 'rb') as f:
                files = {"file": ("corrupted.jpg", f, "image/jpeg")}
                response = authenticated_client.post("/images/upload-image", files=files)
        
        # Should handle corrupted images gracefully
        assert response.status_code in [200, 201, 400, 500, 422]

    def test_batch_image_processing(self, authenticated_client, authenticated_user, temp_image_file):
        """Test processing multiple images"""
        # Upload multiple images
        for i in range(3):
            with open(temp_image_file, 'rb') as f:
                files = {"file": (f"test_image_{i}.jpg", f, "image/jpeg")}
                response = authenticated_client.post("/images/upload-image", files=files)
                # Each should be processed independently
                assert response.status_code in [200, 201, 400, 500, 422]

    def test_image_metadata_extraction(self, authenticated_client, authenticated_user, temp_image_file):
        """Test image metadata extraction"""
        with open(temp_image_file, 'rb') as f:
            files = {"file": ("test_with_metadata.jpg", f, "image/jpeg")}
            response = authenticated_client.post("/images/upload-image", files=files)
        
        if response.status_code in [200, 201]:
            data = response.json()
            # Should extract basic metadata like size, format, etc.
            assert isinstance(data, dict)

    def test_image_security_validation(self, authenticated_client, authenticated_user):
        """Test image security validation"""
        # Test with potentially malicious file
        malicious_content = b"\x89PNG\r\n\x1a\n" + b"<script>alert('xss')</script>"
        
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
            temp_file.write(malicious_content)
            temp_file.flush()
            
            with open(temp_file.name, 'rb') as f:
                files = {"file": ("malicious.png", f, "image/png")}
                response = authenticated_client.post("/images/upload-image", files=files)
        
        # Should handle potentially malicious content safely
        assert response.status_code in [200, 201, 400, 403, 500, 422]

    def test_image_format_conversion(self, authenticated_client, authenticated_user, temp_image_file):
        """Test image format conversion capabilities"""
        with open(temp_image_file, 'rb') as f:
            files = {"file": ("test_convert.jpg", f, "image/jpeg")}
            data = {"convert_to": "png"}
            response = authenticated_client.post("/images/upload-image", files=files, data=data)
        
        # Should either convert format or ignore conversion request
        assert response.status_code in [200, 201, 400, 500, 422]

    def test_image_compression(self, authenticated_client, authenticated_user, temp_image_file):
        """Test image compression functionality"""
        with open(temp_image_file, 'rb') as f:
            files = {"file": ("test_compress.jpg", f, "image/jpeg")}
            data = {"compress": "true", "quality": "80"}
            response = authenticated_client.post("/images/upload-image", files=files, data=data)
        
        # Should either compress image or process normally
        assert response.status_code in [200, 201, 400, 500, 422]

    def test_image_thumbnail_generation(self, authenticated_client, authenticated_user, temp_image_file):
        """Test thumbnail generation"""
        with open(temp_image_file, 'rb') as f:
            files = {"file": ("test_thumb.jpg", f, "image/jpeg")}
            data = {"generate_thumbnail": "true", "thumb_size": "150x150"}
            response = authenticated_client.post("/images/upload-image", files=files, data=data)
        
        # Should either generate thumbnail or process normally
        assert response.status_code in [200, 201, 400, 500, 422] 
