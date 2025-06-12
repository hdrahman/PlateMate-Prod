import pytest
import os
import tempfile
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import firebase_admin
from firebase_admin import credentials, auth

# Import your app and dependencies
from main import app
from DB import get_db, Base
from models import User, UserWeight, FoodLog, Exercise, Achievement, UserAchievement, UserGamification
from auth.firebase_auth import get_current_user

# Test database URL - using in-memory SQLite for speed
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={
        "check_same_thread": False,
    },
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session")
def setup_test_database():
    """Create the test database schema before any tests run"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Drop tables after tests
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db(setup_test_database):
    """Provide a clean database session for each test"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db):
    """Provide a test client with database override"""
    app.dependency_overrides[get_db] = lambda: db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()

@pytest.fixture
def mock_firebase_user():
    """Mock Firebase user for authentication tests"""
    mock_user = Mock()
    mock_user.uid = "test_firebase_uid_123"
    mock_user.email = "test@example.com"
    mock_user.email_verified = True
    return mock_user

@pytest.fixture
def mock_firebase_token():
    """Mock Firebase ID token"""
    return {
        "uid": "test_firebase_uid_123",
        "email": "test@example.com",
        "email_verified": True,
        "exp": 9999999999,  # Far future expiry
        "iat": 1234567890,
        "aud": "test-project",
        "iss": "https://securetoken.google.com/test-project"
    }

@pytest.fixture
def authenticated_user(db):
    """Create a test user in the database"""
    from models import Gender, ActivityLevel
    user = User(
        firebase_uid="test_firebase_uid_123",
        email="test@example.com",
        first_name="Test",
        last_name="User",
        height=175.0,
        weight=70.0,
        age=25,
        gender=Gender.male,
        activity_level=ActivityLevel.moderate,
        onboarding_complete=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def authenticated_client(client, authenticated_user, mock_firebase_token):
    """Provide a test client with authentication"""
    def mock_get_current_user():
        return authenticated_user
    
    def mock_verify_firebase_token():
        return mock_firebase_token
    
    # Override authentication dependencies
    from auth.firebase_auth import verify_firebase_token
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[verify_firebase_token] = mock_verify_firebase_token
    
    yield client
    
    # Clean up overrides
    app.dependency_overrides.clear()

@pytest.fixture
def sample_food_data():
    """Sample food data for testing"""
    return {
        "meal_id": 1,
        "food_name": "Apple",
        "brand_name": "Fresh Produce",
        "calories": 95,
        "proteins": 1,  # Changed from 0.5 to integer
        "carbs": 25,
        "fats": 0,  # Changed from 0.3 to integer
        "fiber": 4,  # Changed from 4.4 to integer
        "sugar": 19,
        "saturated_fat": 0,
        "polyunsaturated_fat": 0,
        "monounsaturated_fat": 0,
        "trans_fat": 0,
        "cholesterol": 0,
        "sodium": 2,
        "potassium": 195,
        "vitamin_a": 54,
        "vitamin_c": 8,
        "calcium": 6,
        "iron": 0,
        "image_url": "apple.png",
        "file_key": "apple_file_key",
        "healthiness_rating": 8
    }

@pytest.fixture
def sample_food_log(authenticated_user, db):
    """Create a sample food log entry for testing"""
    food_log = FoodLog(
        user_id=authenticated_user.id,
        meal_id=1,
        food_name="Test Food",
        calories=100,
        proteins=10,
        carbs=15,
        fats=5,
        fiber=2,
        sugar=5,
        saturated_fat=1,
        polyunsaturated_fat=1,
        monounsaturated_fat=1,
        trans_fat=0,
        cholesterol=0,
        sodium=50,
        potassium=100,
        vitamin_a=0,
        vitamin_c=0,
        calcium=0,
        iron=0,
        image_url="test_image.jpg",
        meal_type="breakfast"
    )
    db.add(food_log)
    db.commit()
    db.refresh(food_log)
    return food_log

@pytest.fixture
def sample_meal_entry(authenticated_user, db):
    """Create a sample meal entry for testing - alias for sample_food_log"""
    food_log = FoodLog(
        user_id=authenticated_user.id,
        meal_id=1,
        food_name="Sample Meal",
        calories=150,
        proteins=12,
        carbs=20,
        fats=6,
        fiber=3,
        sugar=8,
        saturated_fat=2,
        polyunsaturated_fat=1,
        monounsaturated_fat=2,
        trans_fat=0,
        cholesterol=5,
        sodium=75,
        potassium=120,
        vitamin_a=10,
        vitamin_c=5,
        calcium=15,
        iron=1,
        image_url="sample_meal.jpg",
        meal_type="lunch"
    )
    db.add(food_log)
    db.commit()
    db.refresh(food_log)
    return food_log

@pytest.fixture
def sample_weight_entries(authenticated_user, db):
    """Create sample weight entries for testing"""
    from datetime import datetime, timedelta
    
    weights = []
    base_date = datetime.now() - timedelta(days=30)
    
    for i in range(10):
        weight_entry = UserWeight(
            user_id=authenticated_user.id,
            weight=70.0 + (i * 0.1),  # Gradual weight change
            recorded_at=base_date + timedelta(days=i*3)
        )
        db.add(weight_entry)
        weights.append(weight_entry)
    
    db.commit()
    return weights

@pytest.fixture(autouse=True)
def mock_external_services():
    """Mock external services like OpenAI, DeepSeek, etc."""
    with patch('httpx.AsyncClient') as mock_httpx, \
         patch('requests.get') as mock_requests, \
         patch('requests.post') as mock_requests_post:
        
        # Mock httpx AsyncClient for OpenAI API calls
        mock_client_instance = Mock()
        mock_httpx.return_value.__aenter__.return_value = mock_client_instance
        
        # Mock response for AI services
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": "Mocked AI response"
                }
            }]
        }
        mock_client_instance.post.return_value = mock_response
        
        # Mock HTTP requests
        mock_requests.return_value = Mock(
            status_code=200,
            json=lambda: {"status": "success", "data": {}}
        )
        mock_requests_post.return_value = Mock(
            status_code=200,
            json=lambda: {"status": "success", "data": {}}
        )
        
        yield {
            'httpx': mock_httpx,
            'requests_get': mock_requests,
            'requests_post': mock_requests_post
        }

@pytest.fixture
def temp_image_file():
    """Create a temporary image file for testing file uploads"""
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
        # Write minimal JPEG header
        temp_file.write(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00')
        temp_file.write(b'\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f')
        temp_file.flush()
        yield temp_file.name
    
    # Cleanup
    try:
        os.unlink(temp_file.name)
    except OSError:
        pass

@pytest.fixture
def sample_exercise(authenticated_user, db):
    """Create a sample exercise for testing"""
    exercise = Exercise(
        user_id=authenticated_user.id,
        exercise_name="Sample Exercise",
        duration=30,
        calories_burned=250,
        notes="Test exercise"
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise

@pytest.fixture
def sample_achievement(db):
    """Create a sample achievement for testing"""
    achievement = Achievement(
        name="Test Achievement",
        description="A test achievement",
        icon="trophy",
        xp_reward=50
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)
    return achievement

@pytest.fixture
def sample_user_achievement(authenticated_user, sample_achievement, db):
    """Create a sample user achievement for testing"""
    from datetime import datetime
    user_achievement = UserAchievement(
        user_id=authenticated_user.id,
        achievement_id=sample_achievement.id,
        completed=True,
        completed_at=datetime.now()
    )
    db.add(user_achievement)
    db.commit()
    db.refresh(user_achievement)
    return user_achievement

@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client for testing"""
    with patch('openai.ChatCompletion.create') as mock:
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message = Mock()
        mock_response.choices[0].message.content = "Mock AI response"
        mock.return_value = mock_response
        yield mock

@pytest.fixture
def mock_deepseek_client():
    """Mock DeepSeek client for testing"""
    with patch('requests.post') as mock:
        mock_response = Mock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": "Mock DeepSeek response"
                }
            }]
        }
        mock_response.status_code = 200
        mock.return_value = mock_response
        yield mock

@pytest.fixture
def mock_image_processing():
    """Mock image processing functions"""
    with patch('routes.image.process_food_image') as mock:
        mock.return_value = {
            "recognized_foods": [
                {
                    "name": "Test Food",
                    "confidence": 0.95,
                    "nutrition": {
                        "calories": 100,
                        "proteins": 5,
                        "carbs": 15,
                        "fats": 2
                    }
                }
            ]
        }
        yield mock

@pytest.fixture
def sample_user_gamification(authenticated_user, db):
    """Create sample gamification data for testing"""
    gamification = UserGamification(
        user_id=authenticated_user.id,
        level=5,
        xp=1200,
        xp_to_next_level=800,
        rank="Intermediate",
        streak_days=7
    )
    db.add(gamification)
    db.commit()
    db.refresh(gamification)
    return gamification

@pytest.fixture
def sample_nutrition_data():
    """Sample nutrition data for testing"""
    return {
        "calories": 2000,
        "proteins": 150,
        "carbs": 250,
        "fats": 65,
        "fiber": 25,
        "sugar": 45,
        "sodium": 2300,
        "cholesterol": 200,
        "vitamin_c": 90,
        "calcium": 1000,
        "iron": 18
    }

@pytest.fixture
def sample_weekly_data():
    """Sample weekly data for testing charts and trends"""
    base_date = datetime.now() - timedelta(days=6)
    return [
        {
            "date": (base_date + timedelta(days=i)).strftime("%Y-%m-%d"),
            "calories": 1800 + (i * 50),
            "weight": 70.0 + (i * 0.1),
            "exercises": 1 if i % 2 == 0 else 0,
            "meals_logged": 3 + (i % 2)
        }
        for i in range(7)
    ]

@pytest.fixture
def mock_firebase_admin():
    """Mock Firebase Admin SDK"""
    with patch('firebase_admin.auth.verify_id_token') as mock_verify:
        mock_verify.return_value = {
            "uid": "test_firebase_uid",
            "email": "test@example.com",
            "email_verified": True
        }
        yield mock_verify

@pytest.fixture
def authenticated_client_with_permissions(client, authenticated_user, db):
    """Authenticated client with specific permissions"""
    # Add any role-based permissions here if needed
    db.commit()
    return client

@pytest.fixture
def admin_user(db):
    """Create an admin user for testing"""
    admin = User(
        firebase_uid="admin_firebase_uid",
        email="admin@platemate.com",
        first_name="Admin",
        last_name="User"
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin

@pytest.fixture
def mock_external_apis():
    """Mock all external API calls"""
    with patch('openai.ChatCompletion.create') as mock_openai, \
         patch('requests.post') as mock_requests, \
         patch('firebase_admin.auth.verify_id_token') as mock_firebase:
        
        # Configure mocks
        mock_openai.return_value = Mock(
            choices=[Mock(message=Mock(content="Mock AI response"))]
        )
        
        mock_requests.return_value = Mock(
            status_code=200,
            json=lambda: {"choices": [{"message": {"content": "Mock API response"}}]}
        )
        
        mock_firebase.return_value = {
            "uid": "test_firebase_uid",
            "email": "test@example.com"
        }
        
        yield {
            "openai": mock_openai,
            "requests": mock_requests,
            "firebase": mock_firebase
        }

@pytest.fixture(scope="session")
def test_config():
    """Test configuration settings"""
    return {
        "test_database_url": "sqlite:///:memory:",
        "secret_key": "test-secret-key",
        "firebase_project_id": "test-project",
        "openai_api_key": "test-openai-key",
        "deepseek_api_key": "test-deepseek-key",
        "test_user_email": "test@example.com",
        "test_user_password": "testpassword123",
        "max_file_size": 10 * 1024 * 1024,  # 10MB
        "allowed_file_types": ["image/jpeg", "image/png", "image/gif"],
        "cache_timeout": 300,  # 5 minutes
        "rate_limit": 100  # requests per minute
    }

# Configure pytest-asyncio for async tests
pytest_plugins = ["pytest_asyncio"]

# Add custom markers
def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", "api: marks tests as API tests"
    )
    config.addinivalue_line(
        "markers", "auth: marks tests as authentication tests"
    )
    config.addinivalue_line(
        "markers", "ai: marks tests as AI integration tests"
    )
    config.addinivalue_line(
        "markers", "gamification: marks tests as gamification tests"
    )
    config.addinivalue_line(
        "markers", "performance: marks tests as performance tests"
    )

@pytest.fixture(autouse=True)
def reset_database(db):
    """Reset database state after each test"""
    yield
    # Clean up any test data
    db.rollback()

@pytest.fixture
def performance_monitor():
    """Monitor test performance"""
    import time
    start_time = time.time()
    yield
    end_time = time.time()
    duration = end_time - start_time
    if duration > 5.0:  # Warn if test takes more than 5 seconds
        print(f"Warning: Test took {duration:.2f} seconds")

# Pytest configuration
def pytest_configure(config):
    """Configure pytest settings"""
    # Set environment variables for testing
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL
    
    # Disable Firebase initialization during tests
    os.environ["FIREBASE_CREDENTIALS_JSON"] = "" 
