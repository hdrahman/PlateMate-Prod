from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from pydantic import BaseModel

from DB import get_db
from auth.firebase_auth import get_current_user
from models import User, Achievement, UserAchievement
from services.gamification_service import GamificationService

router = APIRouter()

class XPAwardRequest(BaseModel):
    action: str
    amount: Optional[int] = None

class AchievementResponse(BaseModel):
    id: int
    name: str
    description: str
    icon: Optional[str] = None
    xp_reward: int
    completed: bool = False
    completed_at: Optional[str] = None

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    name: str
    level: int
    xp: int
    rank_title: str
    streak_days: int

class GamificationStatus(BaseModel):
    level: int
    xp: int
    xp_to_next_level: int
    rank: str
    streak_days: int
    total_achievements: int
    completed_achievements: int

@router.post("/award-xp")
async def award_xp(
    request: XPAwardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Award XP to the current user for completing an action."""
    try:
        result = GamificationService.award_xp(db, current_user.id, request.action, request.amount)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error awarding XP: {str(e)}"
        )

@router.post("/update-streak")
async def update_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's activity streak."""
    try:
        result = GamificationService.update_streak(db, current_user.id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating streak: {str(e)}"
        )

@router.get("/status", response_model=GamificationStatus)
async def get_gamification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current gamification status for the user."""
    try:
        gamification = GamificationService.get_or_create_gamification(db, current_user.id)
        
        # Get achievement counts
        total_achievements = db.query(Achievement).count()
        completed_achievements = db.query(UserAchievement).filter(
            UserAchievement.user_id == current_user.id,
            UserAchievement.completed == True
        ).count()
        
        return GamificationStatus(
            level=gamification.level,
            xp=gamification.xp,
            xp_to_next_level=gamification.xp_to_next_level,
            rank=gamification.rank,
            streak_days=gamification.streak_days,
            total_achievements=total_achievements,
            completed_achievements=completed_achievements
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching gamification status: {str(e)}"
        )

@router.get("/achievements", response_model=List[AchievementResponse])
async def get_user_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all achievements and their completion status for the current user."""
    try:
        from sqlalchemy import and_
        
        achievement_rows = db.query(
            Achievement, UserAchievement
        ).outerjoin(
            UserAchievement, 
            and_(
                Achievement.id == UserAchievement.achievement_id,
                UserAchievement.user_id == current_user.id
            )
        ).all()
        
        achievements = []
        for achievement, user_achievement in achievement_rows:
            achievements.append(AchievementResponse(
                id=achievement.id,
                name=achievement.name,
                description=achievement.description,
                icon=achievement.icon,
                xp_reward=achievement.xp_reward,
                completed=bool(user_achievement.completed if user_achievement else False),
                completed_at=user_achievement.completed_at.isoformat() if user_achievement and user_achievement.completed_at else None
            ))
        
        return achievements
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching achievements: {str(e)}"
        )

@router.post("/check-achievements")
async def check_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually check for any new achievements the user might have earned."""
    try:
        new_achievements = GamificationService.check_achievements(db, current_user.id)
        return {"new_achievements": new_achievements}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking achievements: {str(e)}"
        )

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get the leaderboard of top users by level and XP."""
    try:
        leaderboard = GamificationService.get_leaderboard(db, limit)
        return [LeaderboardEntry(**entry) for entry in leaderboard]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching leaderboard: {str(e)}"
        )

@router.post("/initialize-achievements")
async def initialize_achievements(
    db: Session = Depends(get_db)
):
    """Initialize default achievements in the database. (Admin use only)"""
    try:
        GamificationService.initialize_default_achievements(db)
        return {"message": "Default achievements initialized successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initializing achievements: {str(e)}"
        )

@router.get("/xp-rewards")
async def get_xp_rewards():
    """Get the XP reward values for different actions."""
    return {
        "xp_rewards": GamificationService.XP_REWARDS,
        "level_thresholds": GamificationService.LEVEL_THRESHOLDS,
        "ranks": GamificationService.RANKS
    } 