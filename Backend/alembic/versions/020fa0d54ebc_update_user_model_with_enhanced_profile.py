"""update_user_model_with_enhanced_profile

Revision ID: 020fa0d54ebc
Revises: 793352ee185c
Create Date: 2025-05-18 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, ENUM

# revision identifiers, used by Alembic.
revision: str = '020fa0d54ebc'
down_revision: Union[str, None] = '793352ee185c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types first
    op.execute("CREATE TYPE gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say')")
    op.execute("CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'extreme')")
    op.execute("CREATE TYPE weight_goal AS ENUM ('lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'maintain', 'gain_light', 'gain_moderate')")
    
    # Rename nutrient_focus to nutrient_targets
    op.alter_column('users', 'nutrient_focus', new_column_name='nutrient_targets')

    # Add new columns to users table
    op.add_column('users', sa.Column('waist_circumference', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('hip_circumference', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('body_fat_percentage', sa.Float(), nullable=True))
    
    op.add_column('users', sa.Column('preferred_exercise_types', JSON, nullable=True))
    op.add_column('users', sa.Column('workout_frequency', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('workout_duration', sa.Integer(), nullable=True))
    
    op.add_column('users', sa.Column('daily_water_target', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('sleep_goal', sa.Integer(), nullable=True))
    
    # Alter existing columns to use enum types
    # First backup the current values
    op.execute("ALTER TABLE users ADD COLUMN gender_backup TEXT")
    op.execute("UPDATE users SET gender_backup = gender")
    op.execute("ALTER TABLE users ADD COLUMN activity_level_backup TEXT")
    op.execute("UPDATE users SET activity_level_backup = activity_level")
    op.execute("ALTER TABLE users ADD COLUMN weight_goal_backup TEXT")
    op.execute("UPDATE users SET weight_goal_backup = weight_goal")
    
    # Drop existing columns
    op.drop_column('users', 'gender')
    op.drop_column('users', 'activity_level')
    op.drop_column('users', 'weight_goal')
    
    # Re-create columns with enum types
    op.add_column('users', sa.Column('gender', sa.Enum('male', 'female', 'other', 'prefer_not_to_say', name='gender'), nullable=True))
    op.add_column('users', sa.Column('activity_level', sa.Enum('sedentary', 'light', 'moderate', 'active', 'extreme', name='activity_level'), nullable=True))
    op.add_column('users', sa.Column('weight_goal', sa.Enum('lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'maintain', 'gain_light', 'gain_moderate', name='weight_goal'), nullable=True))
    
    # Restore values where possible
    op.execute("UPDATE users SET gender = gender_backup::gender WHERE gender_backup IS NOT NULL")
    op.execute("UPDATE users SET activity_level = activity_level_backup::activity_level WHERE activity_level_backup IS NOT NULL")
    op.execute("UPDATE users SET weight_goal = 'maintain'::weight_goal WHERE weight_goal_backup = 'maintain'")
    op.execute("UPDATE users SET weight_goal = 'lose_moderate'::weight_goal WHERE weight_goal_backup = 'lose'")
    op.execute("UPDATE users SET weight_goal = 'gain_light'::weight_goal WHERE weight_goal_backup = 'gain'")
    
    # Drop backup columns
    op.drop_column('users', 'gender_backup')
    op.drop_column('users', 'activity_level_backup')
    op.drop_column('users', 'weight_goal_backup')


def downgrade() -> None:
    # Convert enum columns back to strings
    op.execute("ALTER TABLE users ADD COLUMN gender_backup TEXT")
    op.execute("UPDATE users SET gender_backup = gender::TEXT")
    op.execute("ALTER TABLE users ADD COLUMN activity_level_backup TEXT")
    op.execute("UPDATE users SET activity_level_backup = activity_level::TEXT")
    op.execute("ALTER TABLE users ADD COLUMN weight_goal_backup TEXT")
    op.execute("UPDATE users SET weight_goal_backup = weight_goal::TEXT")
    
    # Drop enum typed columns
    op.drop_column('users', 'gender')
    op.drop_column('users', 'activity_level')
    op.drop_column('users', 'weight_goal')
    
    # Recreate as string columns
    op.add_column('users', sa.Column('gender', sa.String(), nullable=True))
    op.add_column('users', sa.Column('activity_level', sa.String(), nullable=True))
    op.add_column('users', sa.Column('weight_goal', sa.String(), nullable=True))
    
    # Restore data
    op.execute("UPDATE users SET gender = gender_backup")
    op.execute("UPDATE users SET activity_level = activity_level_backup")
    op.execute("UPDATE users SET weight_goal = weight_goal_backup")
    
    # Drop backup columns
    op.drop_column('users', 'gender_backup')
    op.drop_column('users', 'activity_level_backup')
    op.drop_column('users', 'weight_goal_backup')
    
    # Rename nutrient_targets back to nutrient_focus
    op.alter_column('users', 'nutrient_targets', new_column_name='nutrient_focus')
    
    # Drop added columns
    op.drop_column('users', 'waist_circumference')
    op.drop_column('users', 'hip_circumference')
    op.drop_column('users', 'body_fat_percentage')
    op.drop_column('users', 'preferred_exercise_types')
    op.drop_column('users', 'workout_frequency')
    op.drop_column('users', 'workout_duration')
    op.drop_column('users', 'daily_water_target')
    op.drop_column('users', 'sleep_goal')
    
    # Drop enum types
    op.execute("DROP TYPE gender")
    op.execute("DROP TYPE activity_level")
    op.execute("DROP TYPE weight_goal") 