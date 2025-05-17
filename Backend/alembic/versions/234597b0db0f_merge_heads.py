"""merge_heads

Revision ID: 234597b0db0f
Revises: 4ea480ed56f7, 8e735f334172
Create Date: 2025-05-17 17:08:06.079823

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '234597b0db0f'
down_revision: Union[str, None] = ('4ea480ed56f7', '8e735f334172')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
