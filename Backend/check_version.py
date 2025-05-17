from DB import engine
from sqlalchemy import text

def check_version():
    try:
        with engine.connect() as conn:
            result = conn.execute(text('SELECT version_num FROM alembic_version'))
            versions = result.all()
            print(f"Current migrations in alembic_version table: {versions}")
            return versions
    except Exception as e:
        print(f"Error checking version: {e}")
        return None

if __name__ == "__main__":
    check_version() 