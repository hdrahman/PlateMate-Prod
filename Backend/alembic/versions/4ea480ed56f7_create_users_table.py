"""create_users_table

Revision ID: 4ea480ed56f7
Revises: 8e735f334172
Create Date: 2025-05-17 03:04:44.756108

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = '4ea480ed56f7'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('firebase_uid', sa.String(), unique=True, index=True, nullable=False),
        sa.Column('email', sa.String(), unique=True, index=True, nullable=False),
        sa.Column('first_name', sa.String(), nullable=False),
        sa.Column('last_name', sa.String(), nullable=True),
        sa.Column('phone_number', sa.String(), nullable=True),
        
        # Physical attributes
        sa.Column('height', sa.Float(), nullable=True),
        sa.Column('weight', sa.Float(), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('activity_level', sa.String(), nullable=True),
        
        # Dietary preferences
        sa.Column('dietary_restrictions', JSON, nullable=True),
        sa.Column('food_allergies', JSON, nullable=True),
        sa.Column('cuisine_preferences', JSON, nullable=True),
        sa.Column('spice_tolerance', sa.String(), nullable=True),
        
        # Health & fitness goals
        sa.Column('weight_goal', sa.String(), nullable=True),
        sa.Column('health_conditions', JSON, nullable=True),
        sa.Column('daily_calorie_target', sa.Integer(), nullable=True),
        sa.Column('nutrient_focus', JSON, nullable=True),
        
        # Delivery preferences
        sa.Column('default_address', sa.String(), nullable=True),
        sa.Column('preferred_delivery_times', JSON, nullable=True),
        sa.Column('delivery_instructions', sa.String(), nullable=True),
        
        # Notification Preferences
        sa.Column('push_notifications_enabled', sa.Boolean(), default=True),
        sa.Column('email_notifications_enabled', sa.Boolean(), default=True),
        sa.Column('sms_notifications_enabled', sa.Boolean(), default=False),
        sa.Column('marketing_emails_enabled', sa.Boolean(), default=True),
        
        # Payment Information
        sa.Column('payment_methods', JSON, nullable=True),
        sa.Column('billing_address', sa.String(), nullable=True),
        sa.Column('default_payment_method_id', sa.String(), nullable=True),
        
        # App Settings
        sa.Column('preferred_language', sa.String(), default="en"),
        sa.Column('timezone', sa.String(), default="UTC"),
        sa.Column('unit_preference', sa.String(), default="metric"),
        sa.Column('dark_mode', sa.Boolean(), default=False),
        sa.Column('sync_data_offline', sa.Boolean(), default=True),
        
        # Subscription info
        sa.Column('subscription_status', sa.String(), default="free_trial"),
        sa.Column('subscription_expiry', sa.DateTime(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('users')
