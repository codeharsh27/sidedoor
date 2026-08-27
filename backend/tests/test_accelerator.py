import uuid
from datetime import datetime, date, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.db.models import User, AcceleratorProgress, AcceleratorBlockLog, PMCompanyFeed
from app.services.accelerator_service import (
    generate_rubric_feedback,
    get_next_allowed_block,
    validate_block_order,
    BLOCK_ORDER
)


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


@pytest.fixture
def client(mock_db_session):
    """FastAPI test client with mock db session."""
    from app.db.session import get_db_session
    from app.main import app

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db_session] = override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestAcceleratorServiceUnit:
    """Unit tests for PM Accelerator service functions."""

    def test_rubric_feedback_empty_answer(self):
        """Should return default warning if answer is too short or empty."""
        res = generate_rubric_feedback("", ["metrics"], ["tradeoffs"])
        assert res == "No substantive answer submitted."
        
        res = generate_rubric_feedback("too short", ["metrics"], ["tradeoffs"])
        assert res == "No substantive answer submitted."

    def test_rubric_feedback_missing_keywords(self):
        """Should checklist the missing vs covered keywords properly."""
        answer = "We will measure success by looking at user signups and retention over 30 days."
        must_have = ["signups", "retention", "payouts"]
        good_have = ["A/B testing"]
        
        res = generate_rubric_feedback(answer, must_have, good_have)
        assert "✅ Covered: signups, retention" in res
        assert "⚠️ Missing: payouts" in res
        assert "💡 Tip: Make sure to elaborate on 'payouts'" in res

    def test_block_order_validation(self):
        """Should enforce sequential order of blocks."""
        # Starting with empty done list -> learn is first allowed
        assert get_next_allowed_block([]) == "learn"
        validate_block_order("learn", [])  # OK
        
        with pytest.raises(ValueError):
            validate_block_order("voice", [])  # Not OK (learn not done)

        # learn done -> voice is next
        assert get_next_allowed_block(["learn"]) == "voice"
        validate_block_order("voice", ["learn"])  # OK
        
        with pytest.raises(ValueError):
            validate_block_order("practice", ["learn"])  # Not OK

        # all done
        assert get_next_allowed_block(BLOCK_ORDER) is None


class TestAcceleratorEndpoints:
    """Integration tests for accelerator router endpoints using mocked database."""

    def test_get_today_brief_success(self, client, mock_db_session):
        """Should retrieve today's brief for a valid user."""
        user_id = str(uuid.uuid4())
        
        # Mock User query
        res_user = MagicMock()
        res_user.scalar_one_or_none.return_value = User(id=uuid.UUID(user_id))
        
        # Mock first date query (User has no progress -> Day 1 start today)
        res_dates = MagicMock()
        res_dates.scalars.return_value.all.return_value = []
        
        # Mock today's progress check (None -> creates new)
        res_today = MagicMock()
        res_today.scalar_one_or_none.return_value = None
        
        # Mock existing day query
        res_existing_day = MagicMock()
        res_existing_day.scalar_one_or_none.return_value = None

        mock_db_session.execute.side_effect = [res_user, res_dates, res_today, res_existing_day]

        response = client.get(f"/api/v1/accelerator/today?user_id={user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["day_number"] == 1
        assert data["phase"] == "foundation"
        assert len(data["blocks_required"]) == 6
        assert "learn" in data

    def test_start_block_success(self, client, mock_db_session):
        """Should record the start of a block in order."""
        user_id = str(uuid.uuid4())
        
        # Mock progress query
        progress = AcceleratorProgress(
            user_id=uuid.UUID(user_id),
            day_number=1,
            phase="foundation",
            blocks_required=BLOCK_ORDER,
            blocks_done=[]
        )
        res_progress = MagicMock()
        res_progress.scalar_one_or_none.return_value = progress
        
        # Mock check log (None -> creates new log)
        res_log = MagicMock()
        res_log.scalar_one_or_none.return_value = None
        
        mock_db_session.execute.side_effect = [res_progress, res_log]

        payload = {
            "user_id": user_id,
            "day_number": 1,
            "block_type": "learn"
        }
        
        response = client.post("/api/v1/accelerator/block/start", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "block_log_id" in data
        assert "started_at" in data
        assert data["time_limit_sec"] == 5400  # Learn block = 90 min

    def test_start_block_out_of_order(self, client, mock_db_session):
        """Should return 422 if starting a block out of sequence."""
        user_id = str(uuid.uuid4())
        
        # Mock progress query (no blocks done)
        progress = AcceleratorProgress(
            user_id=uuid.UUID(user_id),
            day_number=1,
            phase="foundation",
            blocks_required=BLOCK_ORDER,
            blocks_done=[]
        )
        res_progress = MagicMock()
        res_progress.scalar_one_or_none.return_value = progress
        
        mock_db_session.execute.side_effect = [res_progress]

        payload = {
            "user_id": user_id,
            "day_number": 1,
            "block_type": "voice"  # Out of order (learn is first)
        }
        
        response = client.post("/api/v1/accelerator/block/start", json=payload)
        assert response.status_code == 422
        assert "Block out of order" in response.json()["detail"]

    def test_complete_block_success(self, client, mock_db_session):
        """Should complete active block, log answer, and generate feedback."""
        user_id = str(uuid.uuid4())
        log_id = str(uuid.uuid4())
        
        # Mock block log query
        log = AcceleratorBlockLog(
            id=uuid.UUID(log_id),
            user_id=uuid.UUID(user_id),
            day_number=1,
            block_type="learn",
            started_at=datetime.now(timezone.utc)
        )
        res_log = MagicMock()
        res_log.scalar_one_or_none.return_value = log
        
        # Mock progress query
        progress = AcceleratorProgress(
            user_id=uuid.UUID(user_id),
            day_number=1,
            phase="foundation",
            blocks_required=BLOCK_ORDER,
            blocks_done=[]
        )
        res_progress = MagicMock()
        res_progress.scalar_one_or_none.return_value = progress

        mock_db_session.execute.side_effect = [res_log, res_progress]

        payload = {
            "user_id": user_id,
            "block_log_id": log_id,
            "day_number": 1,
            "block_type": "learn",
            "answer_text": "This is a detailed learn answer about CRED and Swiggy prioritization features."
        }
        
        response = client.post("/api/v1/accelerator/block/complete", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "Checklist" in data["rubric_feedback"]
        assert data["next_block_unlocked"] == "voice"
        assert data["all_blocks_done"] is False

    def test_complete_block_already_done(self, client, mock_db_session):
        """Should reject completion attempts for already completed block logs."""
        user_id = str(uuid.uuid4())
        log_id = str(uuid.uuid4())
        
        # Mock block log query (already submitted)
        log = AcceleratorBlockLog(
            id=uuid.UUID(log_id),
            user_id=uuid.UUID(user_id),
            day_number=1,
            block_type="learn",
            started_at=datetime.now(timezone.utc),
            submitted_at=datetime.now(timezone.utc)
        )
        res_log = MagicMock()
        res_log.scalar_one_or_none.return_value = log

        mock_db_session.execute.side_effect = [res_log]

        payload = {
            "user_id": user_id,
            "block_log_id": log_id,
            "day_number": 1,
            "block_type": "learn",
            "answer_text": "Resubmitting some text here."
        }
        
        response = client.post("/api/v1/accelerator/block/complete", json=payload)
        assert response.status_code == 409
        assert "already completed" in response.json()["detail"]

    def test_get_companies_feed(self, client, mock_db_session):
        """Should return deterministic 5 company cards matching the mixed criteria."""
        user_id = str(uuid.uuid4())
        
        # Seed companies query
        companies = [
            PMCompanyFeed(id=uuid.uuid4(), company_name="C1", company_url="H1", role_title="APM", feed_type="active_listing", source="source1", vc_backed=True, india_remote="india", is_active=True),
            PMCompanyFeed(id=uuid.uuid4(), company_name="C2", company_url="H2", role_title="APM", feed_type="active_listing", source="source1", vc_backed=True, india_remote="india", is_active=True),
            PMCompanyFeed(id=uuid.uuid4(), company_name="C3", company_url="H3", role_title="APM", feed_type="cold_target", source="source1", vc_backed=True, india_remote="india", is_active=True),
            PMCompanyFeed(id=uuid.uuid4(), company_name="C4", company_url="H4", role_title="APM", feed_type="community_lead", source="source1", vc_backed=True, india_remote="india", is_active=True),
            PMCompanyFeed(id=uuid.uuid4(), company_name="C5", company_url="H5", role_title="APM", feed_type="stretch", source="source1", vc_backed=True, india_remote="remote", is_active=True)
        ]
        
        res_comp = MagicMock()
        res_comp.scalars.return_value.all.return_value = companies
        mock_db_session.execute.side_effect = [res_comp]

        response = client.get(f"/api/v1/accelerator/companies/today?user_id={user_id}")
        assert response.status_code == 200
        data = response.json()
        assert "companies" in data
        assert len(data["companies"]) == 5
        types = [c["feed_type"] for c in data["companies"]]
        assert "active_listing" in types
        assert "cold_target" in types
        assert "community_lead" in types
        assert "stretch" in types
