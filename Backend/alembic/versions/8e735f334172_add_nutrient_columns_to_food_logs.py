"""add nutrient columns to food logs

Revision ID: 8e735f334172
Revises: d273ea403993
Create Date: 2024-03-21 13:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e735f334172'
down_revision: Union[str, None] = 'd273ea403993'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new nutrient columns
    op.add_column('food_logs', sa.Column('fiber', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('sugar', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('saturated_fat', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('polyunsaturated_fat', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('monounsaturated_fat', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('trans_fat', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('cholesterol', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('sodium', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('potassium', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('vitamin_a', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('vitamin_c', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('calcium', sa.Integer(), nullable=True))
    op.add_column('food_logs', sa.Column('iron', sa.Integer(), nullable=True))

    # Update existing rows to have default values
    op.execute("UPDATE food_logs SET fiber = 0 WHERE fiber IS NULL")
    op.execute("UPDATE food_logs SET sugar = 0 WHERE sugar IS NULL")
    op.execute("UPDATE food_logs SET saturated_fat = 0 WHERE saturated_fat IS NULL")
    op.execute("UPDATE food_logs SET polyunsaturated_fat = 0 WHERE polyunsaturated_fat IS NULL")
    op.execute("UPDATE food_logs SET monounsaturated_fat = 0 WHERE monounsaturated_fat IS NULL")
    op.execute("UPDATE food_logs SET trans_fat = 0 WHERE trans_fat IS NULL")
    op.execute("UPDATE food_logs SET cholesterol = 0 WHERE cholesterol IS NULL")
    op.execute("UPDATE food_logs SET sodium = 0 WHERE sodium IS NULL")
    op.execute("UPDATE food_logs SET potassium = 0 WHERE potassium IS NULL")
    op.execute("UPDATE food_logs SET vitamin_a = 0 WHERE vitamin_a IS NULL")
    op.execute("UPDATE food_logs SET vitamin_c = 0 WHERE vitamin_c IS NULL")
    op.execute("UPDATE food_logs SET calcium = 0 WHERE calcium IS NULL")
    op.execute("UPDATE food_logs SET iron = 0 WHERE iron IS NULL")

    # Make columns not nullable after setting default values
    op.alter_column('food_logs', 'fiber', nullable=False)
    op.alter_column('food_logs', 'sugar', nullable=False)
    op.alter_column('food_logs', 'saturated_fat', nullable=False)
    op.alter_column('food_logs', 'polyunsaturated_fat', nullable=False)
    op.alter_column('food_logs', 'monounsaturated_fat', nullable=False)
    op.alter_column('food_logs', 'trans_fat', nullable=False)
    op.alter_column('food_logs', 'cholesterol', nullable=False)
    op.alter_column('food_logs', 'sodium', nullable=False)
    op.alter_column('food_logs', 'potassium', nullable=False)
    op.alter_column('food_logs', 'vitamin_a', nullable=False)
    op.alter_column('food_logs', 'vitamin_c', nullable=False)
    op.alter_column('food_logs', 'calcium', nullable=False)
    op.alter_column('food_logs', 'iron', nullable=False)


def downgrade() -> None:
    # Drop all new nutrient columns
    op.drop_column('food_logs', 'iron')
    op.drop_column('food_logs', 'calcium')
    op.drop_column('food_logs', 'vitamin_c')
    op.drop_column('food_logs', 'vitamin_a')
    op.drop_column('food_logs', 'potassium')
    op.drop_column('food_logs', 'sodium')
    op.drop_column('food_logs', 'cholesterol')
    op.drop_column('food_logs', 'trans_fat')
    op.drop_column('food_logs', 'monounsaturated_fat')
    op.drop_column('food_logs', 'polyunsaturated_fat')
    op.drop_column('food_logs', 'saturated_fat')
    op.drop_column('food_logs', 'sugar')
    op.drop_column('food_logs', 'fiber')
