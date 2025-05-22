"""add_user_weight_history

Revision ID: ad7e7be5ab20
Revises: 234597b0db0f
Create Date: 2024-06-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'ad7e7be5ab20'
down_revision = '234597b0db0f'  # ID of the previous migration
branch_labels = None
depends_on = None


def upgrade():
    # Add starting_weight column to users table
    op.add_column('users', sa.Column('starting_weight', sa.Float(), nullable=True))
    
    # Create new user_weights table
    op.create_table('user_weights',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_weights_id'), 'user_weights', ['id'], unique=False)


def downgrade():
    # Drop user_weights table
    op.drop_index(op.f('ix_user_weights_id'), table_name='user_weights')
    op.drop_table('user_weights')
    
    # Remove starting_weight column from users table
    op.drop_column('users', 'starting_weight') 