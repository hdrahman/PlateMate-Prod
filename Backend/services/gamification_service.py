from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import logging

from models import User, UserGamification, Achievement, UserAchievement, FoodLog, Exercise, UserWeight
from DB import get_db

logger = logging.getLogger(__name__)

class GamificationService:
    """Service to handle all gamification logic including XP, levels, achievements, and streaks."""
    
    # XP rewards for different actions
    XP_REWARDS = {
        'food_log': 10,
        'exercise_log': 15,
        'weight_log': 5,
        'daily_goal_met': 25,
        'weekly_goal_met': 50,
        'profile_complete': 30,
        'first_time_bonus': 20,
        'streak_bonus': 5,  # per day of streak
        'perfect_day': 100,  # all goals met in one day
    }
    
    # Level progression system
    LEVEL_THRESHOLDS = {
        1: 0,     # Beginner
        2: 100,   # Novice
        3: 250,   # Amateur
        4: 450,   # Intermediate
        5: 700,   # Advanced
        6: 1000,  # Expert
        7: 1350,  # Master
        8: 1750,  # Elite
        9: 2200,  # Champion
        10: 2700, # Legend
        11: 3250, # Mythic
        12: 3850, # Immortal
        13: 4500, # Divine
        14: 5200, # Transcendent
        15: 6000, # Omnipotent
    }
    
    RANKS = {
        1: "Beginner",
        2: "Novice", 
        3: "Amateur",
        4: "Intermediate",
        5: "Advanced",
        6: "Expert",
        7: "Master",
        8: "Elite",
        9: "Champion",
        10: "Legend",
        11: "Mythic",
        12: "Immortal",
        13: "Divine",
        14: "Transcendent",
        15: "Omnipotent"
    }

    @staticmethod
    def get_or_create_gamification(db: Session, user_id: int) -> UserGamification:
        """Get or create gamification record for user."""
        gamification = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        if not gamification:
            gamification = UserGamification(
                user_id=user_id,
                level=1,
                xp=0,
                xp_to_next_level=100,
                rank="Beginner",
                streak_days=0,
                last_activity_date=datetime.now()
            )
            db.add(gamification)
            db.commit()
            db.refresh(gamification)
        return gamification

    @staticmethod
    def award_xp(db: Session, user_id: int, action: str, amount: Optional[int] = None) -> Dict:
        """Award XP to user for completing an action."""
        if amount is None:
            amount = GamificationService.XP_REWARDS.get(action, 0)
        
        if amount <= 0:
            return {"success": False, "message": "Invalid XP amount"}
        
        gamification = GamificationService.get_or_create_gamification(db, user_id)
        old_level = gamification.level
        
        # Award XP
        gamification.xp += amount
        
        # Check for level up
        level_up_result = GamificationService._check_level_up(db, gamification)
        
        # Update last activity
        gamification.last_activity_date = datetime.now()
        
        db.commit()
        db.refresh(gamification)
        
        logger.info(f"Awarded {amount} XP to user {user_id} for action: {action}")
        
        result = {
            "success": True,
            "xp_awarded": amount,
            "total_xp": gamification.xp,
            "level": gamification.level,
            "level_up": level_up_result["leveled_up"],
            "new_achievements": []
        }
        
        if level_up_result["leveled_up"]:
            result["levels_gained"] = gamification.level - old_level
            result["new_rank"] = gamification.rank
        
        # Check for achievements
        new_achievements = GamificationService.check_achievements(db, user_id, action)
        result["new_achievements"] = new_achievements
        
        return result

    @staticmethod
    def _check_level_up(db: Session, gamification: UserGamification) -> Dict:
        """Check if user should level up and update accordingly."""
        current_level = gamification.level
        current_xp = gamification.xp
        leveled_up = False
        
        # Find the highest level the user should be at
        for level, threshold in sorted(GamificationService.LEVEL_THRESHOLDS.items()):
            if current_xp >= threshold and level > current_level:
                gamification.level = level
                gamification.rank = GamificationService.RANKS[level]
                leveled_up = True
        
        # Calculate XP needed for next level
        next_level = gamification.level + 1
        if next_level in GamificationService.LEVEL_THRESHOLDS:
            next_threshold = GamificationService.LEVEL_THRESHOLDS[next_level]
            gamification.xp_to_next_level = next_threshold - current_xp
        else:
            # Max level reached
            gamification.xp_to_next_level = 0
        
        return {"leveled_up": leveled_up, "new_level": gamification.level}

    @staticmethod
    def update_streak(db: Session, user_id: int) -> Dict:
        """Update user's activity streak."""
        gamification = GamificationService.get_or_create_gamification(db, user_id)
        today = datetime.now().date()
        last_activity = gamification.last_activity_date.date() if gamification.last_activity_date else None
        
        if last_activity is None:
            # First activity
            gamification.streak_days = 1
        elif last_activity == today:
            # Already logged today, no change
            pass
        elif last_activity == today - timedelta(days=1):
            # Consecutive day
            gamification.streak_days += 1
        else:
            # Streak broken
            gamification.streak_days = 1
        
        gamification.last_activity_date = datetime.now()
        db.commit()
        
        # Award streak bonus XP
        if gamification.streak_days > 1:
            streak_bonus = GamificationService.XP_REWARDS['streak_bonus'] * gamification.streak_days
            return GamificationService.award_xp(db, user_id, 'streak_bonus', streak_bonus)
        
        return {"streak_days": gamification.streak_days}

    @staticmethod
    def check_achievements(db: Session, user_id: int, trigger_action: str = None) -> List[Dict]:
        """Check and unlock achievements for user."""
        new_achievements = []
        
        # Get all achievements
        achievements = db.query(Achievement).all()
        
        for achievement in achievements:
            # Check if user already has this achievement
            user_achievement = db.query(UserAchievement).filter(
                and_(
                    UserAchievement.user_id == user_id,
                    UserAchievement.achievement_id == achievement.id,
                    UserAchievement.completed == True
                )
            ).first()
            
            if user_achievement:
                continue  # Already unlocked
            
            # Check if user meets criteria for this achievement
            if GamificationService._check_achievement_criteria(db, user_id, achievement):
                # Unlock achievement
                user_achievement = db.query(UserAchievement).filter(
                    and_(
                        UserAchievement.user_id == user_id,
                        UserAchievement.achievement_id == achievement.id
                    )
                ).first()
                
                if not user_achievement:
                    user_achievement = UserAchievement(
                        user_id=user_id,
                        achievement_id=achievement.id,
                        completed=True,
                        completed_at=datetime.now()
                    )
                    db.add(user_achievement)
                else:
                    user_achievement.completed = True
                    user_achievement.completed_at = datetime.now()
                
                # Award XP for achievement
                GamificationService.award_xp(db, user_id, 'achievement', achievement.xp_reward)
                
                new_achievements.append({
                    "id": achievement.id,
                    "name": achievement.name,
                    "description": achievement.description,
                    "icon": achievement.icon,
                    "xp_reward": achievement.xp_reward
                })
                
                logger.info(f"User {user_id} unlocked achievement: {achievement.name}")
        
        db.commit()
        return new_achievements

    @staticmethod
    def _check_achievement_criteria(db: Session, user_id: int, achievement: Achievement) -> bool:
        """Check if user meets criteria for specific achievement."""
        achievement_checks = {
            "First Steps": lambda: GamificationService._check_first_food_log(db, user_id),
            "Getting Started": lambda: GamificationService._check_food_logs_count(db, user_id, 5),
            "Dedicated Logger": lambda: GamificationService._check_food_logs_count(db, user_id, 50),
            "Nutrition Master": lambda: GamificationService._check_food_logs_count(db, user_id, 200),
            "Workout Warrior": lambda: GamificationService._check_exercise_logs_count(db, user_id, 10),
            "Fitness Fanatic": lambda: GamificationService._check_exercise_logs_count(db, user_id, 50),
            "Weight Tracker": lambda: GamificationService._check_weight_logs_count(db, user_id, 5),
            "Consistency King": lambda: GamificationService._check_streak_days(db, user_id, 7),
            "Streak Master": lambda: GamificationService._check_streak_days(db, user_id, 30),
            "Level Up": lambda: GamificationService._check_level(db, user_id, 2),
            "Rising Star": lambda: GamificationService._check_level(db, user_id, 5),
            "Elite Status": lambda: GamificationService._check_level(db, user_id, 10),
            "Profile Complete": lambda: GamificationService._check_profile_complete(db, user_id),
            "Goal Setter": lambda: GamificationService._check_goals_set(db, user_id),
            "Perfect Week": lambda: GamificationService._check_perfect_week(db, user_id),
        }
        
        check_function = achievement_checks.get(achievement.name)
        if check_function:
            try:
                return check_function()
            except Exception as e:
                logger.error(f"Error checking achievement {achievement.name}: {str(e)}")
                return False
        
        return False

    @staticmethod
    def _check_first_food_log(db: Session, user_id: int) -> bool:
        """Check if user has logged their first food."""
        return db.query(FoodLog).filter(FoodLog.user_id == user_id).count() >= 1

    @staticmethod
    def _check_food_logs_count(db: Session, user_id: int, count: int) -> bool:
        """Check if user has logged specified number of foods."""
        return db.query(FoodLog).filter(FoodLog.user_id == user_id).count() >= count

    @staticmethod
    def _check_exercise_logs_count(db: Session, user_id: int, count: int) -> bool:
        """Check if user has logged specified number of exercises."""
        return db.query(Exercise).filter(Exercise.user_id == user_id).count() >= count

    @staticmethod
    def _check_weight_logs_count(db: Session, user_id: int, count: int) -> bool:
        """Check if user has logged weight specified number of times."""
        return db.query(UserWeight).filter(UserWeight.user_id == user_id).count() >= count

    @staticmethod
    def _check_streak_days(db: Session, user_id: int, days: int) -> bool:
        """Check if user has streak of specified days."""
        gamification = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        return gamification and gamification.streak_days >= days

    @staticmethod
    def _check_level(db: Session, user_id: int, level: int) -> bool:
        """Check if user has reached specified level."""
        gamification = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        return gamification and gamification.level >= level

    @staticmethod
    def _check_profile_complete(db: Session, user_id: int) -> bool:
        """Check if user has completed their profile."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        
        required_fields = [user.height, user.weight, user.gender, user.activity_level]
        return all(field is not None for field in required_fields)

    @staticmethod
    def _check_goals_set(db: Session, user_id: int) -> bool:
        """Check if user has set their nutrition and fitness goals."""
        from models import NutritionGoals, FitnessGoals
        
        nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user_id).first()
        fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == user_id).first()
        
        return bool(nutrition_goals and fitness_goals)

    @staticmethod
    def _check_perfect_week(db: Session, user_id: int) -> bool:
        """Check if user has had a perfect week (7 consecutive days of logging)."""
        week_ago = datetime.now() - timedelta(days=7)
        
        # Check if user has food logs for each of the last 7 days
        for i in range(7):
            day = datetime.now() - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            daily_logs = db.query(FoodLog).filter(
                and_(
                    FoodLog.user_id == user_id,
                    FoodLog.date >= day_start,
                    FoodLog.date <= day_end
                )
            ).count()
            
            if daily_logs == 0:
                return False
        
        return True

    @staticmethod
    def initialize_default_achievements(db: Session):
        """Initialize default achievements in the database."""
        default_achievements = [
            {
                "name": "First Steps",
                "description": "Log your first meal",
                "icon": "restaurant",
                "xp_reward": 50
            },
            {
                "name": "Getting Started", 
                "description": "Log 5 meals",
                "icon": "checkmark-circle",
                "xp_reward": 100
            },
            {
                "name": "Dedicated Logger",
                "description": "Log 50 meals",
                "icon": "trophy",
                "xp_reward": 250
            },
            {
                "name": "Nutrition Master",
                "description": "Log 200 meals",
                "icon": "star",
                "xp_reward": 500
            },
            {
                "name": "Workout Warrior",
                "description": "Log 10 workouts",
                "icon": "fitness",
                "xp_reward": 200
            },
            {
                "name": "Fitness Fanatic",
                "description": "Log 50 workouts", 
                "icon": "barbell",
                "xp_reward": 400
            },
            {
                "name": "Weight Tracker",
                "description": "Log your weight 5 times",
                "icon": "analytics",
                "xp_reward": 150
            },
            {
                "name": "Consistency King",
                "description": "Maintain a 7-day streak",
                "icon": "flame",
                "xp_reward": 300
            },
            {
                "name": "Streak Master",
                "description": "Maintain a 30-day streak",
                "icon": "trending-up",
                "xp_reward": 750
            },
            {
                "name": "Level Up",
                "description": "Reach level 2",
                "icon": "arrow-up-circle",
                "xp_reward": 100
            },
            {
                "name": "Rising Star",
                "description": "Reach level 5",
                "icon": "rocket",
                "xp_reward": 300
            },
            {
                "name": "Elite Status",
                "description": "Reach level 10",
                "icon": "diamond",
                "xp_reward": 1000
            },
            {
                "name": "Profile Complete",
                "description": "Complete your profile information",
                "icon": "person-circle",
                "xp_reward": 100
            },
            {
                "name": "Goal Setter",
                "description": "Set your nutrition and fitness goals",
                "icon": "target",
                "xp_reward": 150
            },
            {
                "name": "Perfect Week",
                "description": "Log meals for 7 consecutive days",
                "icon": "calendar",
                "xp_reward": 500
            }
        ]
        
        for achievement_data in default_achievements:
            # Check if achievement already exists
            existing = db.query(Achievement).filter(Achievement.name == achievement_data["name"]).first()
            if not existing:
                achievement = Achievement(**achievement_data)
                db.add(achievement)
        
        db.commit()
        logger.info("Default achievements initialized")

    @staticmethod
    def get_leaderboard(db: Session, limit: int = 10) -> List[Dict]:
        """Get top users by level and XP."""
        from sqlalchemy import desc
        
        top_users = db.query(User, UserGamification).join(
            UserGamification, User.id == UserGamification.user_id
        ).order_by(
            desc(UserGamification.level),
            desc(UserGamification.xp)
        ).limit(limit).all()
        
        leaderboard = []
        for rank, (user, gamification) in enumerate(top_users, 1):
            leaderboard.append({
                "rank": rank,
                "user_id": user.id,
                "name": f"{user.first_name} {user.last_name or ''}".strip(),
                "level": gamification.level,
                "xp": gamification.xp,
                "rank_title": gamification.rank,
                "streak_days": gamification.streak_days
            })
        
        return leaderboard 