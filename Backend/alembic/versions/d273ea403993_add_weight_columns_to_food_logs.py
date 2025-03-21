"""add_weight_columns_to_food_logs

Revision ID: d273ea403993
Revises: c6357aff324c
Create Date: 2025-03-21 14:30:56.166604

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd273ea403993'
down_revision: Union[str, None] = 'c6357aff324c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add weight and weight_unit columns to food_logs table
    op.add_column('food_logs', sa.Column('weight', sa.Float(), nullable=True))
    op.add_column('food_logs', sa.Column('weight_unit', sa.String(), nullable=True, server_default='g'))


def downgrade() -> None:
    # Remove weight and weight_unit columns from food_logs table
    op.drop_column('food_logs', 'weight_unit')
    op.drop_column('food_logs', 'weight')
