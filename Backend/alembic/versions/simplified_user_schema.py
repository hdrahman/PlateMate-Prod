"""Simplify user schema to basic fitness tracking

Revision ID: simplified_user_schema
Revises: 020fa0d54ebc
Create Date: 2023-05-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, ENUM

# revision identifiers, used by Alembic.
revision: str = 'simplified_user_schema'
down_revision: Union[str, None] = '020fa0d54ebc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing enums and create new simplified ones
    op.execute("ALTER TABLE users ALTER COLUMN gender TYPE VARCHAR USING gender::VARCHAR")
    op.execute("ALTER TABLE users ALTER COLUMN activity_level TYPE VARCHAR USING activity_level::VARCHAR")
    op.execute("ALTER TABLE users ALTER COLUMN weight_goal TYPE VARCHAR USING weight_goal::VARCHAR")
    
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS activity_level")
    op.execute("DROP TYPE IF EXISTS weight_goal")
    
    op.execute("CREATE TYPE gender AS ENUM ('male', 'female')")
    op.execute("CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active')")
    op.execute("CREATE TYPE weight_goal AS ENUM ('lose', 'maintain', 'gain')")
    
    # Convert columns to new enum types
    op.execute("ALTER TABLE users ALTER COLUMN gender TYPE gender USING CASE WHEN gender = 'male' THEN 'male'::gender WHEN gender = 'female' THEN 'female'::gender ELSE NULL END")
    op.execute("ALTER TABLE users ALTER COLUMN activity_level TYPE activity_level USING CASE WHEN activity_level = 'sedentary' THEN 'sedentary'::activity_level WHEN activity_level = 'light' THEN 'light'::activity_level WHEN activity_level = 'moderate' THEN 'moderate'::activity_level WHEN activity_level = 'active' THEN 'active'::activity_level WHEN activity_level = 'extreme' THEN 'very_active'::activity_level ELSE NULL END")
    op.execute("ALTER TABLE users ALTER COLUMN weight_goal TYPE weight_goal USING CASE WHEN weight_goal = 'maintain' THEN 'maintain'::weight_goal WHEN weight_goal IN ('lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light') THEN 'lose'::weight_goal WHEN weight_goal IN ('gain_light', 'gain_moderate') THEN 'gain'::weight_goal ELSE NULL END")
    
    # Add target_weight column if it doesn't exist
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS target_weight FLOAT")
    
    # Drop unnecessary columns
    columns_to_drop = [
        'phone_number',
        'waist_circumference',
        'hip_circumference',
        'body_fat_percentage',
        'dietary_restrictions',
        'food_allergies',
        'cuisine_preferences',
        'spice_tolerance',
        'health_conditions',
        'daily_calorie_target',
        'nutrient_targets',
        'preferred_exercise_types',
        'workout_frequency',
        'workout_duration',
        'daily_water_target',
        'sleep_goal',
        'default_address',
        'preferred_delivery_times',
        'delivery_instructions',
        'push_notifications_enabled',
        'email_notifications_enabled',
        'sms_notifications_enabled',
        'marketing_emails_enabled',
        'payment_methods',
        'billing_address',
        'default_payment_method_id',
        'preferred_language',
        'timezone',
        'unit_preference',
        'dark_mode',
        'sync_data_offline',
        'subscription_status',
        'subscription_expiry'
    ]
    
    for column in columns_to_drop:
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {column}")


def downgrade() -> None:
    # This is a destructive migration, so downgrade is not fully implemented
    # We'll just recreate the basic columns but data will be lost
    op.execute("ALTER TABLE users ALTER COLUMN gender TYPE VARCHAR USING gender::VARCHAR")
    op.execute("ALTER TABLE users ALTER COLUMN activity_level TYPE VARCHAR USING activity_level::VARCHAR")
    op.execute("ALTER TABLE users ALTER COLUMN weight_goal TYPE VARCHAR USING weight_goal::VARCHAR")
    
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS activity_level")
    op.execute("DROP TYPE IF EXISTS weight_goal")
    
    op.execute("CREATE TYPE gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say')")
    op.execute("CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'extreme')")
    op.execute("CREATE TYPE weight_goal AS ENUM ('lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'maintain', 'gain_light', 'gain_moderate')")
    
    op.execute("ALTER TABLE users ALTER COLUMN gender TYPE gender USING CASE WHEN gender = 'male' THEN 'male'::gender WHEN gender = 'female' THEN 'female'::gender ELSE NULL END")
    op.execute("ALTER TABLE users ALTER COLUMN activity_level TYPE activity_level USING CASE WHEN activity_level = 'sedentary' THEN 'sedentary'::activity_level WHEN activity_level = 'light' THEN 'light'::activity_level WHEN activity_level = 'moderate' THEN 'moderate'::activity_level WHEN activity_level = 'active' THEN 'active'::activity_level WHEN activity_level = 'very_active' THEN 'extreme'::activity_level ELSE NULL END")
    op.execute("ALTER TABLE users ALTER COLUMN weight_goal TYPE weight_goal USING CASE WHEN weight_goal = 'maintain' THEN 'maintain'::weight_goal WHEN weight_goal = 'lose' THEN 'lose_moderate'::weight_goal WHEN weight_goal = 'gain' THEN 'gain_light'::weight_goal ELSE NULL END")
    
    # Add back basic additional columns
    op.add_column('users', sa.Column('phone_number', sa.String(), nullable=True))
    op.add_column('users', sa.Column('subscription_status', sa.String(), nullable=True, server_default='free_trial'))
    op.add_column('users', sa.Column('subscription_expiry', sa.DateTime(), nullable=True)) 