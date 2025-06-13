from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging

from models import User, FoodLog, Exercise, NutritionGoals, FitnessGoals, UserGamification, UserWeight, UserAchievement, Achievement

logger = logging.getLogger(__name__)

class UserContextService:
    """Service to aggregate comprehensive user data for AI coaching context"""
    
    @staticmethod
    def get_comprehensive_context(db: Session, user_id: int, days_back: int = 30) -> Dict[str, Any]:
        """Get comprehensive user context for Coach Max"""
        try:
            context = {
                "profile": UserContextService._get_user_profile_summary(db, user_id),
                "nutrition": UserContextService._get_nutrition_summary(db, user_id, days_back),
                "exercise": UserContextService._get_exercise_summary(db, user_id, days_back),
                "progress": UserContextService._get_progress_summary(db, user_id),
                "goals": UserContextService._get_goals_summary(db, user_id),
                "achievements": UserContextService._get_recent_achievements(db, user_id),
                "patterns": UserContextService._analyze_user_patterns(db, user_id, days_back)
            }
            
            return UserContextService._format_context_for_ai(context)
        except Exception as e:
            logger.error(f"Error getting comprehensive context for user {user_id}: {str(e)}")
            return {"error": "Unable to load user context"}

    @staticmethod
    def _get_user_profile_summary(db: Session, user_id: int) -> Dict[str, Any]:
        """Get user profile summary"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}
        
        return {
            "name": user.first_name,
            "age": user.age,
            "gender": user.gender.value if user.gender else None,
            "height": user.height,
            "current_weight": user.weight,
            "activity_level": user.activity_level.value if user.activity_level else None,
            "target_weight": user.target_weight,
            "starting_weight": user.starting_weight,
            "units": "imperial" if user.is_imperial_units else "metric"
        }

    @staticmethod
    def _get_nutrition_summary(db: Session, user_id: int, days_back: int) -> Dict[str, Any]:
        """Get nutrition patterns and recent intake"""
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        # Get recent food logs
        food_logs = db.query(FoodLog).filter(
            FoodLog.user_id == user_id,
            FoodLog.date >= cutoff_date
        ).order_by(desc(FoodLog.date)).all()
        
        if not food_logs:
            return {"message": "No recent food logs found"}
        
        # Calculate averages
        total_days = len(set(log.date.date() for log in food_logs))
        total_calories = sum(log.calories for log in food_logs)
        total_protein = sum(log.proteins for log in food_logs)
        total_carbs = sum(log.carbs for log in food_logs)
        total_fats = sum(log.fats for log in food_logs)
        total_fiber = sum(log.fiber for log in food_logs)
        
        # Most frequent foods
        food_frequency = {}
        meal_patterns = {"breakfast": 0, "lunch": 0, "dinner": 0, "snack": 0}
        
        for log in food_logs:
            food_frequency[log.food_name] = food_frequency.get(log.food_name, 0) + 1
            if log.meal_type:
                meal_patterns[log.meal_type.lower()] = meal_patterns.get(log.meal_type.lower(), 0) + 1
        
        top_foods = sorted(food_frequency.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "days_tracked": total_days,
            "avg_daily_calories": total_calories / max(total_days, 1),
            "avg_daily_protein": total_protein / max(total_days, 1),
            "avg_daily_carbs": total_carbs / max(total_days, 1),
            "avg_daily_fats": total_fats / max(total_days, 1),
            "avg_daily_fiber": total_fiber / max(total_days, 1),
            "top_foods": top_foods,
            "meal_frequency": meal_patterns,
            "last_logged": food_logs[0].date.strftime("%Y-%m-%d") if food_logs else None
        }

    @staticmethod
    def _get_exercise_summary(db: Session, user_id: int, days_back: int) -> Dict[str, Any]:
        """Get exercise patterns and recent activity"""
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        exercises = db.query(Exercise).filter(
            Exercise.user_id == user_id,
            Exercise.date >= cutoff_date
        ).order_by(desc(Exercise.date)).all()
        
        if not exercises:
            return {"message": "No recent exercise logs found"}
        
        # Calculate totals and patterns
        total_sessions = len(exercises)
        total_calories_burned = sum(ex.calories_burned for ex in exercises)
        total_duration = sum(ex.duration for ex in exercises)
        
        # Exercise type frequency
        exercise_types = {}
        for ex in exercises:
            exercise_types[ex.exercise_name] = exercise_types.get(ex.exercise_name, 0) + 1
        
        top_exercises = sorted(exercise_types.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # Weekly frequency
        weeks_in_period = max(days_back // 7, 1)
        weekly_frequency = total_sessions / weeks_in_period
        
        return {
            "total_sessions": total_sessions,
            "weekly_frequency": round(weekly_frequency, 1),
            "total_calories_burned": total_calories_burned,
            "avg_calories_per_session": total_calories_burned / max(total_sessions, 1),
            "total_duration_hours": round(total_duration / 60, 1),
            "avg_duration_minutes": total_duration / max(total_sessions, 1),
            "top_exercises": top_exercises,
            "last_workout": exercises[0].date.strftime("%Y-%m-%d") if exercises else None
        }

    @staticmethod
    def _get_progress_summary(db: Session, user_id: int) -> Dict[str, Any]:
        """Get weight progress and trends"""
        # Get recent weight entries
        weight_entries = db.query(UserWeight).filter(
            UserWeight.user_id == user_id
        ).order_by(desc(UserWeight.recorded_at)).limit(10).all()
        
        if len(weight_entries) < 2:
            return {"message": "Insufficient weight data for trend analysis"}
        
        latest_weight = weight_entries[0].weight
        previous_weight = weight_entries[-1].weight
        weight_change = latest_weight - previous_weight
        
        # Get user for target comparison
        user = db.query(User).filter(User.id == user_id).first()
        target_weight = user.target_weight if user else None
        
        progress_data = {
            "current_weight": latest_weight,
            "weight_change": round(weight_change, 1),
            "entries_count": len(weight_entries),
            "trend": "losing" if weight_change < -0.5 else "gaining" if weight_change > 0.5 else "stable"
        }
        
        if target_weight:
            progress_data.update({
                "target_weight": target_weight,
                "weight_to_goal": round(latest_weight - target_weight, 1),
                "progress_percentage": round((abs(previous_weight - latest_weight) / abs(previous_weight - target_weight)) * 100, 1) if previous_weight != target_weight else 0
            })
        
        return progress_data

    @staticmethod
    def _get_goals_summary(db: Session, user_id: int) -> Dict[str, Any]:
        """Get user goals and adherence"""
        nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user_id).first()
        fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == user_id).first()
        
        goals = {}
        
        if nutrition_goals:
            goals["nutrition"] = {
                "daily_calories": nutrition_goals.daily_calorie_goal,
                "protein_goal": nutrition_goals.protein_goal,
                "carb_goal": nutrition_goals.carb_goal,
                "fat_goal": nutrition_goals.fat_goal,
                "weight_goal": nutrition_goals.weight_goal.value if nutrition_goals.weight_goal else None
            }
        
        if fitness_goals:
            goals["fitness"] = {
                "weekly_workouts": fitness_goals.weekly_workouts,
                "daily_step_goal": fitness_goals.daily_step_goal,
                "water_intake_goal": fitness_goals.water_intake_goal
            }
        
        return goals

    @staticmethod
    def _get_recent_achievements(db: Session, user_id: int) -> Dict[str, Any]:
        """Get gamification status and recent achievements"""
        gamification = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        
        # Get recent achievements (completed in last 30 days)
        cutoff_date = datetime.now() - timedelta(days=30)
        recent_achievements = db.query(Achievement, UserAchievement).join(
            UserAchievement, Achievement.id == UserAchievement.achievement_id
        ).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.completed == True,
            UserAchievement.completed_at >= cutoff_date
        ).all()
        
        achievement_data = {
            "level": gamification.level if gamification else 1,
            "xp": gamification.xp if gamification else 0,
            "current_streak": gamification.streak_days if gamification else 0,
            "rank": gamification.rank if gamification else "Beginner"
        }
        
        if recent_achievements:
            achievement_data["recent_achievements"] = [
                {
                    "name": achievement.name,
                    "description": achievement.description,
                    "completed_at": user_achievement.completed_at.strftime("%Y-%m-%d")
                }
                for achievement, user_achievement in recent_achievements
            ]
        
        return achievement_data

    @staticmethod
    def _analyze_user_patterns(db: Session, user_id: int, days_back: int) -> Dict[str, Any]:
        """Analyze user patterns and behaviors"""
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        # Food logging consistency
        food_log_dates = db.query(func.date(FoodLog.date)).filter(
            FoodLog.user_id == user_id,
            FoodLog.date >= cutoff_date
        ).distinct().all()
        
        # Exercise consistency
        exercise_dates = db.query(func.date(Exercise.date)).filter(
            Exercise.user_id == user_id,
            Exercise.date >= cutoff_date
        ).distinct().all()
        
        total_possible_days = days_back
        food_logging_days = len(food_log_dates)
        exercise_days = len(exercise_dates)
        
        return {
            "food_logging_consistency": round((food_logging_days / total_possible_days) * 100, 1),
            "exercise_consistency": round((exercise_days / total_possible_days) * 100, 1),
            "days_with_food_logs": food_logging_days,
            "days_with_exercise": exercise_days,
            "analysis_period_days": days_back
        }

    @staticmethod
    def _format_context_for_ai(context: Dict[str, Any]) -> str:
        """Format the context data into a readable string for the AI"""
        formatted_sections = []
        
        # Profile section
        if context.get("profile"):
            profile = context["profile"]
            profile_text = f"USER PROFILE:\n"
            profile_text += f"- Name: {profile.get('name', 'N/A')}\n"
            if profile.get('age'):
                profile_text += f"- Age: {profile['age']} years\n"
            if profile.get('gender'):
                profile_text += f"- Gender: {profile['gender']}\n"
            if profile.get('current_weight') and profile.get('height'):
                weight_unit = "lbs" if profile.get('units') == 'imperial' else "kg"
                height_unit = "ft" if profile.get('units') == 'imperial' else "cm"
                profile_text += f"- Current weight: {profile['current_weight']}{weight_unit}\n"
                profile_text += f"- Height: {profile['height']}{height_unit}\n"
            if profile.get('target_weight'):
                weight_unit = "lbs" if profile.get('units') == 'imperial' else "kg"
                profile_text += f"- Target weight: {profile['target_weight']}{weight_unit}\n"
            if profile.get('activity_level'):
                profile_text += f"- Activity level: {profile['activity_level']}\n"
            formatted_sections.append(profile_text)
        
        # Goals section
        if context.get("goals"):
            goals = context["goals"]
            goals_text = "CURRENT GOALS:\n"
            if goals.get("nutrition"):
                nutrition = goals["nutrition"]
                goals_text += f"- Daily calories: {nutrition.get('daily_calories', 'Not set')}\n"
                goals_text += f"- Protein: {nutrition.get('protein_goal', 'Not set')}g\n"
                goals_text += f"- Carbs: {nutrition.get('carb_goal', 'Not set')}g\n"
                goals_text += f"- Fat: {nutrition.get('fat_goal', 'Not set')}g\n"
                if nutrition.get('weight_goal'):
                    goals_text += f"- Weight goal: {nutrition['weight_goal']}\n"
            if goals.get("fitness"):
                fitness = goals["fitness"]
                goals_text += f"- Weekly workouts: {fitness.get('weekly_workouts', 'Not set')}\n"
            formatted_sections.append(goals_text)
        
        # Recent nutrition patterns
        if context.get("nutrition") and not context["nutrition"].get("message"):
            nutrition = context["nutrition"]
            nutrition_text = f"RECENT NUTRITION ({nutrition.get('days_tracked', 0)} days tracked):\n"
            nutrition_text += f"- Avg daily calories: {nutrition.get('avg_daily_calories', 0):.0f}\n"
            nutrition_text += f"- Avg daily protein: {nutrition.get('avg_daily_protein', 0):.0f}g\n"
            nutrition_text += f"- Avg daily carbs: {nutrition.get('avg_daily_carbs', 0):.0f}g\n"
            nutrition_text += f"- Avg daily fat: {nutrition.get('avg_daily_fats', 0):.0f}g\n"
            if nutrition.get('top_foods'):
                nutrition_text += f"- Most frequent foods: {', '.join([food[0] for food in nutrition['top_foods'][:3]])}\n"
            if nutrition.get('last_logged'):
                nutrition_text += f"- Last food logged: {nutrition['last_logged']}\n"
            formatted_sections.append(nutrition_text)
        
        # Exercise patterns
        if context.get("exercise") and not context["exercise"].get("message"):
            exercise = context["exercise"]
            exercise_text = "RECENT EXERCISE ACTIVITY:\n"
            exercise_text += f"- Total sessions: {exercise.get('total_sessions', 0)}\n"
            exercise_text += f"- Weekly frequency: {exercise.get('weekly_frequency', 0)} sessions/week\n"
            exercise_text += f"- Total calories burned: {exercise.get('total_calories_burned', 0)}\n"
            exercise_text += f"- Avg session duration: {exercise.get('avg_duration_minutes', 0):.0f} minutes\n"
            if exercise.get('top_exercises'):
                exercise_text += f"- Favorite exercises: {', '.join([ex[0] for ex in exercise['top_exercises']])}\n"
            if exercise.get('last_workout'):
                exercise_text += f"- Last workout: {exercise['last_workout']}\n"
            formatted_sections.append(exercise_text)
        
        # Progress tracking
        if context.get("progress") and not context["progress"].get("message"):
            progress = context["progress"]
            progress_text = "WEIGHT PROGRESS:\n"
            progress_text += f"- Current weight trend: {progress.get('trend', 'unknown')}\n"
            if progress.get('weight_change'):
                direction = "lost" if progress['weight_change'] < 0 else "gained"
                progress_text += f"- Recent change: {direction} {abs(progress['weight_change']):.1f} units\n"
            if progress.get('weight_to_goal'):
                distance = abs(progress['weight_to_goal'])
                direction = "below" if progress['weight_to_goal'] < 0 else "above"
                progress_text += f"- Distance to goal: {distance:.1f} units {direction} target\n"
            formatted_sections.append(progress_text)
        
        # Consistency patterns
        if context.get("patterns"):
            patterns = context["patterns"]
            patterns_text = "CONSISTENCY PATTERNS:\n"
            patterns_text += f"- Food logging: {patterns.get('food_logging_consistency', 0):.0f}% of days\n"
            patterns_text += f"- Exercise frequency: {patterns.get('exercise_consistency', 0):.0f}% of days\n"
            formatted_sections.append(patterns_text)
        
        # Achievements and motivation
        if context.get("achievements"):
            achievements = context["achievements"]
            achievement_text = "GAMIFICATION STATUS:\n"
            achievement_text += f"- Current level: {achievements.get('level', 1)}\n"
            achievement_text += f"- Current streak: {achievements.get('current_streak', 0)} days\n"
            achievement_text += f"- Rank: {achievements.get('rank', 'Beginner')}\n"
            if achievements.get('recent_achievements'):
                achievement_text += f"- Recent achievements: {len(achievements['recent_achievements'])} unlocked this month\n"
            formatted_sections.append(achievement_text)
        
        # Combine all sections
        if formatted_sections:
            context_summary = "\n".join(formatted_sections)
            context_summary += "\nUse this data to provide personalized, specific advice. Reference actual numbers and patterns when relevant. Be encouraging about progress and constructive about improvement areas."
            return context_summary
        else:
            return "Limited user data available. Provide general health and fitness guidance." 