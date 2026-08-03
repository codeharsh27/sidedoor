import pytest
import uuid
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from app.db.models import User, UserProfile

@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    return session

def test_login_wrong_password(mock_db_session):
    from app.main import app
    from app.db.session import get_db_session

    user_id = uuid.uuid4()
    mock_user = User(
        id=user_id,
        email="test@example.com",
        name="Test User",
        password_hash="correctpassword"
    )

    res_user = MagicMock()
    res_user.scalar_one_or_none.return_value = mock_user
    mock_db_session.execute.return_value = res_user

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db_session] = override_db
    client = TestClient(app)

    payload = {
        "email": "test@example.com",
        "password": "wrongpassword"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect password"
    app.dependency_overrides.clear()


def test_login_success_with_profile(mock_db_session):
    from app.main import app
    from app.db.session import get_db_session

    user_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    mock_user = User(
        id=user_id,
        email="test@example.com",
        name="Test User",
        password_hash="correctpassword"
    )
    mock_profile = UserProfile(
        id=profile_id,
        user_id=user_id,
        raw_resume_text="My resume text",
        parsed_skills=["Python"],
        parsed_domains=["Backend"],
        parsed_project_summary="Summary"
    )

    # 1. User query result
    res_user = MagicMock()
    res_user.scalar_one_or_none.return_value = mock_user

    # 2. Profile query result
    res_profile = MagicMock()
    res_profile.scalar_one_or_none.return_value = mock_profile

    mock_db_session.execute.side_effect = [res_user, res_profile]

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db_session] = override_db
    client = TestClient(app)

    payload = {
        "email": "test@example.com",
        "password": "correctpassword"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(user_id)
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert data["has_profile"] is True
    assert data["profile"]["id"] == str(profile_id)
    app.dependency_overrides.clear()


def test_register_auto_signup(mock_db_session):
    from app.main import app
    from app.db.session import get_db_session

    # 1. User lookup returns None
    res_user = MagicMock()
    res_user.scalar_one_or_none.return_value = None

    # 2. Profile lookup returns None
    res_profile = MagicMock()
    res_profile.scalar_one_or_none.return_value = None

    mock_db_session.execute.side_effect = [res_user, res_profile]

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db_session] = override_db
    client = TestClient(app)

    payload = {
        "name": "New User",
        "email": "new@example.com",
        "password": "newpassword"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "new@example.com"
    assert data["name"] == "New User"
    assert data["has_profile"] is False
    assert data["profile"] is None
    app.dependency_overrides.clear()
