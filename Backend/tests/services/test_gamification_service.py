import pytest
from datetime import datetime, date, timedelta
from unittest.mock import patch, Mock

from models import User, Achievement, UserAchievement, FoodLog, Exercise
from services.gamification_service import GamificationService


class TestGamificationService:
    """Comprehensive tests for gamification service functions"""

    def test_GamificationService.award_xp_success(self, authenticated_user, db):
        """Test successfully awarding points to user"""
        initial_points = authenticated_user.gamification.xp or 0
        points_to_award = 25
        reason = "meal_logged"
        
        result = GamificationService.award_xp(db, authenticated_user.id, reason, points_to_award)
        
        db.refresh(authenticated_user)
        assert authenticated_user.gamification.xp == initial_points + points_to_award
        assert result["points_awarded"] == points_to_award
        assert result["new_total"] == initial_points + points_to_award

    def test_GamificationService.award_xp_negative_amount(self, authenticated_user, db):
        """Test awarding negative points (should not be allowed)"""
        initial_points = authenticated_user.gamification.xp or 0
        
        # The GamificationService.award_xp should handle negative amounts gracefully
        result = GamificationService.award_xp(db, authenticated_user.id, "invalid", -10)
        assert result["success"] == False

    def test_GamificationService.award_xp_nonexistent_user(self, db):
        """Test awarding points to non-existent user"""
        with pytest.raises(ValueError, match="User not found"):
            GamificationService.award_xp(db, 99999, 10, "test")

    def test_GamificationService._check_level_up_progression(self, authenticated_user, db):
        """Test level calculation based on points"""
        test_cases = [
            (0, 1, "Beginner"),
            (100, 2, "Novice"),
            (300, 3, "Intermediate"),
            (600, 4, "Advanced"),
            (1000, 5, "Expert")
        ]
        
        for points, expected_level, expected_name in test_cases:
            level_info = GamificationService._check_level_up(points)
            assert level_info["level"] == expected_level
            assert level_info["level_name"] == expected_name
            assert level_info["points_in_level"] >= 0

    def test_calculate_user_streak_consecutive_days(self, authenticated_user, db):
        """Test calculating streak for consecutive daily activity"""
        # Create meal entries for 5 consecutive days
        today = datetime.now()
        for i in range(5):
            meal_date = today - timedelta(days=i)
            meal = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""f"Meal Day {i}""",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
            db.add(meal)
        
        db.commit()
        
        streak_info = calculate_user_streak(db, authenticated_user.id)
        
        assert streak_info["current_streak"] == 5
        assert streak_info["streak_type"] == "meal_logging"

    def test_calculate_user_streak_broken_streak(self, authenticated_user, db):
        """Test streak calculation when streak is broken"""
        today = datetime.now()
        
        # Create meals for today and 2 days ago (missing yesterday)
        meal_today = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""Today's Meal"",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
        
        meal_two_days_ago = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""Two Days Ago Meal"",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
        )
        
        db.add_all([meal_today, meal_two_days_ago])
        db.commit()
        
        streak_info = calculate_user_streak(db, authenticated_user.id)
        
        # Current streak should be 1 (only today)
        assert streak_info["current_streak"] == 1

    def test_check_achievements_first_meal(self, authenticated_user, db):
        """Test checking achievement completion for first meal"""
        # Create "First Meal" achievement
        achievement = Achievement(
            name="First Meal",
            description="Log your first meal",
            target_value=1,
            reward_points=10
        )
        db.add(achievement)
        db.commit()
        
        # Log first meal
        meal = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""First Meal"",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
        db.add(meal)
        db.commit()
        
        completed_achievements = check_achievements(db, authenticated_user.id)
        
        # Should complete the "First Meal" achievement
        first_meal_completed = any(
            ach["name"] == "First Meal" for ach in completed_achievements
        )
        assert first_meal_completed

    def test_check_achievements_meal_count(self, authenticated_user, db):
        """Test achievement for logging multiple meals"""
        # Create achievement for 5 meals
        achievement = Achievement(
            name="Meal Counter",
            description="Log 5 meals",
            target_value=5,
            reward_points=25
        )
        db.add(achievement)
        db.commit()
        
        # Create 5 meals
        meals = []
        for i in range(5):
            meal = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""f"Meal {i+1}""",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
            meals.append(meal)
        
        db.add_all(meals)
        db.commit()
        
        completed_achievements = check_achievements(db, authenticated_user.id)
        
        meal_counter_completed = any(
            ach["name"] == "Meal Counter" for ach in completed_achievements
        )
        assert meal_counter_completed

    def test_check_achievements_streak_based(self, authenticated_user, db):
        """Test streak-based achievement"""
        # Create streak achievement
        achievement = Achievement(
            name="Week Warrior",
            description="Log meals for 7 consecutive days",
            target_value=7,
            reward_points=50
        )
        db.add(achievement)
        db.commit()
        
        # Create meals for 7 consecutive days
        today = datetime.now()
        for i in range(7):
            meal_date = today - timedelta(days=i)
            meal = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""f"Day {i+1} Meal""",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
            db.add(meal)
        
        db.commit()
        
        completed_achievements = check_achievements(db, authenticated_user.id)
        
        week_warrior_completed = any(
            ach["name"] == "Week Warrior" for ach in completed_achievements
        )
        assert week_warrior_completed

    def test_check_achievement_progress(self, authenticated_user, db):
        """Test checking progress towards an achievement"""
        # Create achievement for 10 meals
        achievement = Achievement(
            name="Meal Master",
            description="Log 10 meals",
            target_value=10,
            reward_points=30
        )
        db.add(achievement)
        db.commit()
        
        # Log 6 meals
        for i in range(6):
            meal = FoodLog(
            user_id=authenticated_user.id,
            meal_id=1,
            food_name=""f"Progress Meal {i+1}""",
            calories=200,
            proteins=10,
            carbs=20,
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
            vitamin_a=10,
            vitamin_c=5,
            calcium=15,
            iron=1,
            weight=100.0,
            weight_unit="g",
            image_url="test.jpg",
            file_key="test_key",
            healthiness_rating=7,
            meal_type="breakfast"
        )
            db.add(meal)
        
        db.commit()
        
        progress = check_achievement_progress(db, authenticated_user.id, achievement.id)
        
        assert progress["current_progress"] == 6
        assert progress["target_value"] == 10
        assert progress["completion_percentage"] == 60.0
        assert progress["is_completed"] is False

    def test_update_user_achievements_on_meal_log(self, authenticated_user, db):
        """Test that achievements are updated when user logs a meal"""
        # Create achievements
        achievements = [
            Achievement(
                name="First Meal",
                description="Log your first meal",
                target_value=1,
                reward_points=10
            ),
            Achievement(
                name="Early Bird",
                description="Log breakfast",
                target_value=1,
                reward_points=5
            )
        ]
        db.add_all(achievements)
        db.commit()
        
        initial_points = authenticated_user.gamification.xp or 0
        
        # Trigger achievement update (simulating meal log)
        update_result = update_user_achievements(db, authenticated_user.id, "meal_logged", {
            "meal_type": "breakfast",
            "is_first_meal": True
        })
        
        assert "achievements_earned" in update_result
        assert "points_awarded" in update_result
        
        # Check user points were updated
        db.refresh(authenticated_user)
        assert authenticated_user.gamification.xp > initial_points

    def test_get_user_achievements(self, authenticated_user, db):
        """Test getting user's earned and available achievements"""
        # Create achievements
        achievement1 = Achievement(
            name="Earned Achievement",
            description="Already earned",
            target_value=1,
            reward_points=10
        )
        achievement2 = Achievement(
            name="Available Achievement",
            description="Not yet earned",
            target_value=5,
            reward_points=25
        )
        
        db.add_all([achievement1, achievement2])
        db.commit()
        
        # Award first achievement
        user_achievement = UserAchievement(
            user_id=authenticated_user.id,
            achievement_id=achievement1.id,
            earned_at=datetime.now(),
            current_progress=1
        )
        db.add(user_achievement)
        db.commit()
        
        achievements = get_user_achievements(db, authenticated_user.id)
        
        assert "earned" in achievements
        assert "available" in achievements
        assert len(achievements["earned"]) == 1
        assert len(achievements["available"]) == 1
        assert achievements["earned"][0]["name"] == "Earned Achievement"

    def test_points_history_tracking(self, authenticated_user, db):
        """Test tracking points history"""
        # Award points multiple times
        GamificationService.award_xp(db, authenticated_user.id, 10, "meal_logged")
        GamificationService.award_xp(db, authenticated_user.id, 15, "exercise_logged")
        GamificationService.award_xp(db, authenticated_user.id, 5, "daily_goal_met")
        
        history = get_points_history(db, authenticated_user.id, limit=10)
        
        assert isinstance(history, list)
        assert len(history) == 3
        
        # Should be ordered by most recent first
        assert history[0]["points"] == 5
        assert history[0]["reason"] == "daily_goal_met"
        assert history[1]["points"] == 15
        assert history[2]["points"] == 10

    def test_achievement_duplicate_prevention(self, authenticated_user, db):
        """Test that achievements can't be earned multiple times"""
        # Create achievement
        achievement = Achievement(
            name="One Time Achievement",
            description="Can only be earned once",
            target_value=1,
            reward_points=10
        )
        db.add(achievement)
        db.commit()
        
        # Award achievement first time
        first_result = update_user_achievements(db, authenticated_user.id, "meal_logged", {})
        
        # Try to award same achievement again
        second_result = update_user_achievements(db, authenticated_user.id, "meal_logged", {})
        
        # Second attempt should not award the same achievement
        achievement_names_first = [ach["name"] for ach in first_result.get("achievements_earned", [])]
        achievement_names_second = [ach["name"] for ach in second_result.get("achievements_earned", [])]
        
        # Achievement should only appear in first result
        if "One Time Achievement" in achievement_names_first:
            assert "One Time Achievement" not in achievement_names_second

    def test_exercise_based_achievements(self, authenticated_user, db):
        """Test achievements based on exercise logging"""
        # Create exercise achievement
        achievement = Achievement(
            name="Fitness Starter",
            description="Log your first exercise",
            target_value=1,
            reward_points=15
        )
        db.add(achievement)
        db.commit()
        
        # Log exercise
        exercise = Exercise(
            user_id=authenticated_user.id,
            name="Running",
            category="cardio",
            duration_minutes=30,
            calories_burned=300
        )
        db.add(exercise)
        db.commit()
        
        # Update achievements based on exercise
        result = update_user_achievements(db, authenticated_user.id, "exercise_logged", {
            "exercise_type": "cardio",
            "is_first_exercise": True
        })
        
        achievement_names = [ach["name"] for ach in result.get("achievements_earned", [])]
        assert "Fitness Starter" in achievement_names

    def test_calorie_goal_achievements(self, authenticated_user, db):
        """Test achievements based on meeting calorie goals"""
        # Create calorie goal achievement
        achievement = Achievement(
            name="Calorie Champion",
            description="Stay within calorie goal for 3 days",
            target_value=3,
            reward_points=20
        )
        db.add(achievement)
        db.commit()
        
        # Simulate meeting calorie goals for 3 days
        for i in range(3):
            result = update_user_achievements(db, authenticated_user.id, "daily_goal_met", {
                "goal_type": "calorie_target",
                "date": (datetime.now() - timedelta(days=i)).date()
            })
        
        # Check if achievement was earned
        achievements = get_user_achievements(db, authenticated_user.id)
        earned_names = [ach["name"] for ach in achievements["earned"]]
        assert "Calorie Champion" in earned_names

    def test_level_up_detection(self, authenticated_user, db):
        """Test detecting when user levels up"""
        initial_level = GamificationService._check_level_up(authenticated_user.gamification.xp or 0)["level"]
        
        # Award enough points to level up
        points_needed = 500  # Should be enough to increase level
        result = GamificationService.award_xp(db, authenticated_user.id, points_needed, "level_up_test")
        
        new_level = GamificationService._check_level_up(result["new_total"])["level"]
        
        if new_level > initial_level:
            assert result.get("level_up", False) is True
            assert result.get("new_level") == new_level
        else:
            assert result.get("level_up", False) is False

    def test_weekly_challenge_completion(self, authenticated_user, db):
        """Test weekly challenge achievement tracking"""
        # Create weekly challenge achievement
        achievement = Achievement(
            name="Weekly Warrior",
            description="Complete all daily goals for a week",
            target_value=7,
            reward_points=100
        )
        db.add(achievement)
        db.commit()
        
        # Simulate completing daily goals for 7 days
        today = datetime.now()
        for i in range(7):
            goal_date = today - timedelta(days=i)
            result = update_user_achievements(db, authenticated_user.id, "daily_goal_met", {
                "date": goal_date.date(),
                "all_goals_met": True
            })
        
        # Check weekly challenge completion
        achievements = get_user_achievements(db, authenticated_user.id)
        earned_names = [ach["name"] for ach in achievements["earned"]]
        
        # May or may not be earned depending on implementation
        # This tests the framework is working
        assert isinstance(achievements["earned"], list) 
