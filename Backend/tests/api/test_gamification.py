import pytest
import json
from datetime import datetime, date, timedelta
from fastapi import status
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock

from models import User, Achievement, UserAchievement, UserGamification, FoodLog, Exercise
from services.gamification_service import GamificationService


class TestGamificationAPI:
    """Test the Gamification API endpoints"""

    def test_get_gamification_status(self, authenticated_client, authenticated_user, db):
        """Test getting gamification status"""
        # Ensure user has gamification record
        GamificationService.get_or_create_gamification(db, authenticated_user.id)
        
        response = authenticated_client.get("/gamification/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "level" in data
        assert "xp" in data
        assert "rank" in data
        assert "streak_days" in data

    def test_award_xp_endpoint(self, authenticated_client, authenticated_user, db):
        """Test awarding XP through API"""
        # Get initial gamification state
        initial_gamification = GamificationService.get_or_create_gamification(db, authenticated_user.id)
        initial_xp = initial_gamification.xp
        
        request_data = {
            "action": "food_log",
            "amount": 50
        }
        
        response = authenticated_client.post("/gamification/award-xp", json=request_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] == True
        assert data["xp_awarded"] == 50
        assert data["total_xp"] == initial_xp + 50

    def test_update_streak_endpoint(self, authenticated_client, authenticated_user, db):
        """Test updating streak through API"""
        response = authenticated_client.post("/gamification/update-streak")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should return either streak information or XP award info
        assert "streak_days" in data or "success" in data

    def test_get_user_achievements(self, authenticated_client, authenticated_user, db):
        """Test getting user achievements"""
        # Initialize some achievements
        try:
            GamificationService.initialize_default_achievements(db)
        except:
            # Might fail if achievements already exist
            pass
        
        response = authenticated_client.get("/gamification/achievements")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # Check achievement structure
        if data:
            achievement = data[0]
            assert "id" in achievement
            assert "name" in achievement
            assert "description" in achievement
            assert "completed" in achievement

    def test_check_achievements_endpoint(self, authenticated_client, authenticated_user, db):
        """Test manually checking achievements"""
        response = authenticated_client.post("/gamification/check-achievements")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "new_achievements" in data
        assert isinstance(data["new_achievements"], list)

    def test_get_leaderboard(self, authenticated_client, authenticated_user, db):
        """Test getting leaderboard"""
        # Create some test users with gamification data
        for i in range(3):
            test_user = User(
                firebase_uid=f"test_uid_{i}",
                email=f"test{i}@example.com",
                first_name=f"Test{i}",
                last_name="User"
            )
            db.add(test_user)
            db.commit()
            
            # Create gamification record
            gamification = UserGamification(
                user_id=test_user.id,
                level=i + 2,
                xp=100 + i * 200,
                rank=GamificationService.RANKS.get(i + 2, "Novice"),
                streak_days=i + 1
            )
            db.add(gamification)
        
        db.commit()
        
        response = authenticated_client.get("/gamification/leaderboard")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # Check leaderboard entry structure
        if data:
            entry = data[0]
            assert "rank" in entry
            assert "user_id" in entry
            assert "level" in entry
            assert "xp" in entry

    def test_initialize_achievements_endpoint(self, authenticated_client, authenticated_user, db):
        """Test initializing default achievements"""
        response = authenticated_client.post("/gamification/initialize-achievements")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data

    def test_get_xp_rewards_info(self, authenticated_client, authenticated_user):
        """Test getting XP rewards configuration"""
        response = authenticated_client.get("/gamification/xp-rewards")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "xp_rewards" in data
        assert "level_thresholds" in data
        assert "ranks" in data


class TestGamificationBusinessLogic:
    """Test gamification business logic"""

    def test_xp_award_calculation(self, authenticated_user, db):
        """Test XP calculation for different actions"""
        # Test default XP amounts
        result = GamificationService.award_xp(db, authenticated_user.id, 'food_log')
        assert result["success"] == True
        assert result["xp_awarded"] == 10  # Default food_log XP

        # Test custom XP amount
        result = GamificationService.award_xp(db, authenticated_user.id, 'custom_action', 25)
        assert result["success"] == True
        assert result["xp_awarded"] == 25

    def test_level_progression(self, authenticated_user, db):
        """Test level progression system"""
        # Award enough XP to level up
        result = GamificationService.award_xp(db, authenticated_user.id, 'custom_action', 150)
        
        assert result["level"] >= 2  # Should level up from level 1
        assert result["level_up"] == True
        assert "new_rank" in result

    def test_streak_calculation(self, authenticated_user, db):
        """Test streak calculation logic"""
        # First activity
        result = GamificationService.update_streak(db, authenticated_user.id)
        
        gamification = GamificationService.get_or_create_gamification(db, authenticated_user.id)
        assert gamification.streak_days >= 1

    def test_achievement_checking(self, authenticated_user, db):
        """Test achievement checking system"""
        # Initialize achievements
        try:
            GamificationService.initialize_default_achievements(db)
        except:
            pass
        
        # Check achievements
        achievements = GamificationService.check_achievements(db, authenticated_user.id, 'food_log')
        assert isinstance(achievements, list)

    def test_gamification_record_creation(self, authenticated_user, db):
        """Test automatic gamification record creation"""
        # Delete any existing record
        db.query(UserGamification).filter(UserGamification.user_id == authenticated_user.id).delete()
        db.commit()
        
        # Should create new record automatically
        gamification = GamificationService.get_or_create_gamification(db, authenticated_user.id)
        assert gamification is not None
        assert gamification.level == 1
        assert gamification.xp == 0
        assert gamification.rank == "Beginner"

    def test_invalid_xp_amount(self, authenticated_user, db):
        """Test handling of invalid XP amounts"""
        result = GamificationService.award_xp(db, authenticated_user.id, 'invalid_action', -10)
        assert result["success"] == False

    def test_unknown_action_xp(self, authenticated_user, db):
        """Test XP for unknown actions"""
        result = GamificationService.award_xp(db, authenticated_user.id, 'unknown_action')
        assert result["success"] == False  # Should fail for unknown action with no amount

    def test_leaderboard_generation(self, authenticated_user, db):
        """Test leaderboard generation"""
        # Create test data
        for i in range(3):
            test_user = User(
                firebase_uid=f"leaderboard_test_{i}",
                email=f"leaderboard{i}@example.com",
                first_name=f"User{i}",
                last_name="Test"
            )
            db.add(test_user)
            db.commit()
            
            gamification = UserGamification(
                user_id=test_user.id,
                level=i + 1,
                xp=i * 100,
                rank=GamificationService.RANKS.get(i + 1, "Beginner"),
                streak_days=i
            )
            db.add(gamification)
        
        db.commit()
        
        leaderboard = GamificationService.get_leaderboard(db, limit=5)
        assert isinstance(leaderboard, list)
        assert len(leaderboard) >= 3

    def test_achievement_completion(self, authenticated_user, db, sample_achievement):
        """Test achievement completion process"""
        # Check that achievement exists
        assert sample_achievement.id is not None
        
        # Create user achievement record
        user_achievement = UserAchievement(
            user_id=authenticated_user.id,
            achievement_id=sample_achievement.id,
            completed=True,
            completed_at=datetime.now()
        )
        db.add(user_achievement)
        db.commit()
        
        # Verify completion
        completed = db.query(UserAchievement).filter(
            UserAchievement.user_id == authenticated_user.id,
            UserAchievement.achievement_id == sample_achievement.id,
            UserAchievement.completed == True
        ).first()
        
        assert completed is not None


class TestGamificationIntegration:
    """Test gamification integration with other features"""

    def test_food_log_integration(self, authenticated_client, authenticated_user, db):
        """Test gamification integration with food logging"""
        # Create a food log entry (this should trigger gamification)
        meal_data = {
            "meal_id": 1,
            "food_name": "Test Food",
            "calories": 100,
            "proteins": 10,
            "carbs": 15,
            "fats": 5,
            "fiber": 2,
            "sugar": 5,
            "saturated_fat": 1,
            "polyunsaturated_fat": 1,
            "monounsaturated_fat": 1,
            "trans_fat": 0,
            "cholesterol": 0,
            "sodium": 50,
            "potassium": 100,
            "vitamin_a": 0,
            "vitamin_c": 0,
            "calcium": 0,
            "iron": 0,
            "image_url": "test.png",
            "meal_type": "breakfast"
        }
        
        response = authenticated_client.post("/meal_entries/create", json=meal_data)
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check gamification was updated
        gamification = GamificationService.get_or_create_gamification(db, authenticated_user.id)
        assert gamification.xp > 0

    def test_exercise_integration(self, authenticated_client, authenticated_user, db):
        """Test gamification integration with exercise logging"""
        # Create an exercise entry
        exercise_data = {
            "exercise_name": "Running",
            "calories_burned": 200,
            "duration": 30,
            "notes": "Morning run"
        }
        
        response = authenticated_client.post("/exercises/", json=exercise_data)
        assert response.status_code == status.HTTP_200_OK
        
        # Check gamification was updated
        gamification = GamificationService.get_or_create_gamification(db, authenticated_user.id)
        assert gamification.xp > 0


class TestGamificationPerformance:
    """Test gamification performance"""

    def test_bulk_xp_awards(self, authenticated_user, db):
        """Test performance of multiple XP awards"""
        for i in range(10):
            result = GamificationService.award_xp(db, authenticated_user.id, 'food_log')
            assert result["success"] == True

    def test_achievement_check_performance(self, authenticated_user, db):
        """Test achievement checking performance"""
        # Initialize achievements
        try:
            GamificationService.initialize_default_achievements(db)
        except:
            pass
        
        # Check achievements multiple times
        for i in range(5):
            achievements = GamificationService.check_achievements(db, authenticated_user.id)
            assert isinstance(achievements, list)

    def test_leaderboard_performance(self, db):
        """Test leaderboard generation performance"""
        # Create multiple users
        for i in range(20):
            test_user = User(
                firebase_uid=f"perf_test_{i}",
                email=f"perf{i}@example.com",
                first_name=f"User{i}",
                last_name="Test"
            )
            db.add(test_user)
            db.commit()
            
            gamification = UserGamification(
                user_id=test_user.id,
                level=1 + (i % 5),
                xp=i * 50,
                rank=GamificationService.RANKS.get(1 + (i % 5), "Beginner"),
                streak_days=i % 10
            )
            db.add(gamification)
        
        db.commit()
        
        # Generate leaderboard
        leaderboard = GamificationService.get_leaderboard(db, limit=10)
        assert len(leaderboard) == 10 
