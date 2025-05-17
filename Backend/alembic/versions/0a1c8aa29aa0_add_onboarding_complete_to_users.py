"""add_onboarding_complete_to_users

Revision ID: 0a1c8aa29aa0
Revises: 234597b0db0f
Create Date: 2025-05-17 17:08:09.868983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a1c8aa29aa0'
down_revision: Union[str, None] = '234597b0db0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add onboarding_complete column to users table
    op.add_column('users', sa.Column('onboarding_complete', sa.Boolean(), 
                                      nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove onboarding_complete column from users table
    op.drop_column('users', 'onboarding_complete')
