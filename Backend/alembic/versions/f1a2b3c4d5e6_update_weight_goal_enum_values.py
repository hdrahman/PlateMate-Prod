"""update_weight_goal_enum_values

Revision ID: f1a2b3c4d5e6
Revises: ad7e7be5ab20
Create Date: 2025-05-27 08:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'simplified_user_schema'
branch_labels = None
depends_on = None


def upgrade():
    # First, update existing data to map old values to new values
    connection = op.get_bind()
    
    # Mapping from old weight goal values to new ones
    weight_goal_mapping = {
        'lose_extreme': 'lose_1',
        'lose_heavy': 'lose_0_75', 
        'lose_moderate': 'lose_0_5',
        'lose_light': 'lose_0_25',
        'lose': 'lose_0_5',  # Default lose to moderate loss
        'maintain': 'maintain',
        'gain': 'gain_0_25',  # Default gain to light gain
        'gain_light': 'gain_0_25',
        'gain_moderate': 'gain_0_5'
    }
    
    # Update users table
    for old_value, new_value in weight_goal_mapping.items():
        connection.execute(
            sa.text("UPDATE users SET weight_goal = :new_value WHERE weight_goal = :old_value"),
            {"old_value": old_value, "new_value": new_value}
        )
    
    # Update nutrition_goals table
    for old_value, new_value in weight_goal_mapping.items():
        connection.execute(
            sa.text("UPDATE nutrition_goals SET weight_goal = :new_value WHERE weight_goal = :old_value"),
            {"old_value": old_value, "new_value": new_value}
        )


def downgrade():
    # Reverse mapping for downgrade
    connection = op.get_bind()
    
    # Mapping from new weight goal values back to old ones
    reverse_weight_goal_mapping = {
        'lose_1': 'lose_extreme',
        'lose_0_75': 'lose_heavy',
        'lose_0_5': 'lose_moderate', 
        'lose_0_25': 'lose_light',
        'maintain': 'maintain',
        'gain_0_25': 'gain_light',
        'gain_0_5': 'gain_moderate'
    }
    
    # Update users table
    for new_value, old_value in reverse_weight_goal_mapping.items():
        connection.execute(
            sa.text("UPDATE users SET weight_goal = :old_value WHERE weight_goal = :new_value"),
            {"new_value": new_value, "old_value": old_value}
        )
    
    # Update nutrition_goals table  
    for new_value, old_value in reverse_weight_goal_mapping.items():
        connection.execute(
            sa.text("UPDATE nutrition_goals SET weight_goal = :old_value WHERE weight_goal = :new_value"),
            {"new_value": new_value, "old_value": old_value}
        ) 