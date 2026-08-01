"""
Profile parsing endpoints — POST /api/v1/profile/parse, /parse-text, /parse-url

Three input paths, one pipeline:
  1. File upload (PDF or DOCX) → extract text → LLM parse → embed → upsert
  2. Raw text paste → validate → LLM parse → embed → upsert
  3. Portfolio URL → fetch + extract → LLM parse → embed → upsert

Security:
  - File size validation (10MB cap)
  - File type whitelisting (PDF/DOCX only)
  - URL SSRF prevention (private IP blocking, DNS pre-resolution)
  - Text length bounds (50 char minimum, 100K char maximum)
  - Input sanitization at every entry point
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import User, UserProfile
from app.db.session import get_db_session
from app.services.document_extractor import (
    DocumentExtractionError,
    ExtractionResult,
    extract_from_file,
    extract_from_text,
    extract_from_url,
)
from app.services.embedder import get_embedder
from app.services.resume_parser import (
    GeminiResumeParser,
    NotableProject,
    ProfileData,
    ResumeParseError,
    ResumeParserProtocol,
)
from app.services.security import (
    InvalidURLError,
    SSRFBlockedError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------- Response models ----------


class NotableProjectResponse(BaseModel):
    """A notable project in the API response."""

    title: str
    description: str
    tech_used: list[str]


class ProfileParseResponse(BaseModel):
    """Response from any profile parse endpoint."""

    user_id: str
    skills: list[str]
    domains: list[str]
    project_summary: str
    notable_projects: list[NotableProjectResponse]
    source_type: str = Field(
        description="How the profile was ingested: 'pdf', 'docx', 'url', or 'text'"
    )


class UserProfileContract(BaseModel):
    """UserProfile schema expected by the frontend."""
    id: str
    user_id: str
    raw_resume_text: str
    parsed_skills: list[str]
    parsed_domains: list[str]
    parsed_project_summary: str
    updated_at: str


class ProfileUploadResponse(BaseModel):
    """Response returned by the resume upload endpoint."""
    user_id: str
    profile: UserProfileContract


class ProfileParseTextRequest(BaseModel):
    """Request body for parsing raw text (non-file path)."""

    user_id: str
    raw_text: str


class ProfileParseURLRequest(BaseModel):
    """Request body for parsing a portfolio URL."""

    user_id: str
    portfolio_url: str


# ---------- Parser dependency ----------


def get_resume_parser() -> ResumeParserProtocol:
    """
    FastAPI dependency that provides the appropriate resume parser:
    - OpenRouter (if OPENROUTER_API_KEY is configured)
    - Gemini (if GEMINI_API_KEY is configured)
    - Fallback heuristic parser (if no LLM keys are configured)
    """
    from app.services.resume_parser import OpenRouterResumeParser, FallbackResumeParser

    if settings.openrouter_api_key:
        return OpenRouterResumeParser(
            api_key=settings.openrouter_api_key,
            model_name=settings.openrouter_model or "google/gemini-2.0-flash-001"
        )

    if settings.gemini_api_key:
        return GeminiResumeParser(api_key=settings.gemini_api_key)

    # Fall back to heuristic rule-based parser so upload never fails
    return FallbackResumeParser()


# ---------- Shared pipeline logic ----------


def _validate_user_id(user_id_str: str) -> uuid.UUID:
    """
    Validate and parse a user_id string into a UUID.

    Args:
        user_id_str: Raw user_id from the request.

    Returns:
        Parsed UUID.

    Raises:
        HTTPException: If the format is invalid.
    """
    try:
        return uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid user_id format (expected UUID).",
        )


async def _run_parse_pipeline(
    extraction: ExtractionResult,
    user_id: uuid.UUID,
    session: AsyncSession,
    parser: ResumeParserProtocol,
) -> ProfileParseResponse:
    """
    Core pipeline: extracted text → LLM parse → embed → upsert profile.

    Shared across all three endpoints (file upload, raw text, URL).
    The extraction step is done before this function is called —
    this function only handles the post-extraction pipeline.

    Args:
        extraction: Result from any extraction path (file, URL, text).
        user_id: Validated user UUID.
        session: Async DB session.
        parser: Resume parser (LLM client).

    Returns:
        ProfileParseResponse with parsed data.
    """
    raw_text = extraction.raw_text
    source_type = extraction.source_type

    # Step 1: LLM resume parsing (the one deliberate LLM call)
    try:
        parsed: ProfileData = await parser.parse_resume(raw_text)
    except ResumeParseError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Resume parsing failed: {e}",
        )

    # Step 2: Local embedding (no API cost)
    embedder = get_embedder(settings.embedding_model)
    embedding = embedder.embed_profile(parsed)

    # Step 3: Verify user exists
    user_result = await session.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found.")

    # Step 4: Upsert user_profiles row
    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    existing_profile = profile_result.scalar_one_or_none()

    notable_projects_data = [p.model_dump() for p in parsed.notable_projects]

    if existing_profile:
        # Update existing profile
        existing_profile.raw_resume_text = raw_text
        existing_profile.parsed_skills = parsed.skills
        existing_profile.parsed_domains = parsed.domains
        existing_profile.parsed_project_summary = parsed.project_summary
        existing_profile.notable_projects = notable_projects_data
        existing_profile.source_type = source_type
        existing_profile.embedding_vector = embedding
        logger.info("Updated profile for user %s (source: %s)", user_id, source_type)
    else:
        # Create new profile
        new_profile = UserProfile(
            user_id=user_id,
            raw_resume_text=raw_text,
            parsed_skills=parsed.skills,
            parsed_domains=parsed.domains,
            parsed_project_summary=parsed.project_summary,
            notable_projects=notable_projects_data,
            source_type=source_type,
            embedding_vector=embedding,
        )
        session.add(new_profile)
        logger.info("Created new profile for user %s (source: %s)", user_id, source_type)

    return ProfileParseResponse(
        user_id=str(user_id),
        skills=parsed.skills,
        domains=parsed.domains,
        project_summary=parsed.project_summary,
        notable_projects=[
            NotableProjectResponse(**p) for p in notable_projects_data
        ],
        source_type=source_type,
    )


# ---------- Endpoints ----------


@router.post("/parse", response_model=ProfileParseResponse)
async def parse_resume_file(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    parser: ResumeParserProtocol = Depends(get_resume_parser),
) -> ProfileParseResponse:
    """
    Parse a resume file upload (PDF or DOCX).

    Extracts text from the file, then runs the full parsing pipeline:
    LLM extraction → local embedding → profile upsert.

    Security: validates file size (10MB), content type (PDF/DOCX only),
    and minimum extractable text.
    """
    uid = _validate_user_id(user_id)

    # Extract text from uploaded file (handles PDF + DOCX routing, size/type validation)
    file_bytes = await file.read()
    try:
        extraction = extract_from_file(
            file_bytes=file_bytes,
            content_type=file.content_type,
            filename=file.filename,
        )
    except DocumentExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return await _run_parse_pipeline(extraction, uid, session, parser)


@router.post("/parse-text", response_model=ProfileParseResponse)
async def parse_resume_text(
    request: ProfileParseTextRequest,
    session: AsyncSession = Depends(get_db_session),
    parser: ResumeParserProtocol = Depends(get_resume_parser),
) -> ProfileParseResponse:
    """
    Parse raw resume text (pasted directly).

    Validates text bounds (50 char minimum, 100K char maximum),
    then runs the full parsing pipeline.
    """
    uid = _validate_user_id(request.user_id)

    try:
        extraction = extract_from_text(request.raw_text)
    except DocumentExtractionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await _run_parse_pipeline(extraction, uid, session, parser)


@router.post("/parse-url", response_model=ProfileParseResponse)
async def parse_portfolio_url(
    request: ProfileParseURLRequest,
    session: AsyncSession = Depends(get_db_session),
    parser: ResumeParserProtocol = Depends(get_resume_parser),
) -> ProfileParseResponse:
    """
    Parse a portfolio URL (GitHub profile, personal site, etc.).

    Fetches the URL with full SSRF protection, extracts readable text,
    then runs the full parsing pipeline.

    Security: validates URL scheme (http/https), checks DNS resolution
    against private IP ranges, enforces timeouts and response size limits.
    """
    uid = _validate_user_id(request.user_id)

    try:
        extraction = await extract_from_url(request.portfolio_url)
    except DocumentExtractionError as e:
        error_msg = str(e)
        # Map security errors to appropriate HTTP status codes
        if "blocked" in error_msg.lower() or "private" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail=error_msg)
        else:
            raise HTTPException(status_code=422, detail=error_msg)

    return await _run_parse_pipeline(extraction, uid, session, parser)


@router.post("/upload", response_model=ProfileUploadResponse)
async def upload_profile(
    user_id: str | None = Form(None),
    file: UploadFile | None = File(None),
    raw_text: str | None = Form(None),
    session: AsyncSession = Depends(get_db_session),
    parser: ResumeParserProtocol = Depends(get_resume_parser),
) -> ProfileUploadResponse:
    """
    Ingest a user profile by file upload or raw text.
    Creates a new user if user_id is not provided or not found.
    """
    uid = None
    if user_id:
        try:
            uid = uuid.UUID(user_id)
        except ValueError:
            pass

    # Ensure User exists, or create new one
    user = None
    if uid:
        user_result = await session.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()

    if not user:
        user = User(email=f"anonymous_{uuid.uuid4().hex[:8]}@sidedoor.app")
        session.add(user)
        await session.flush()
        uid = user.id

    # Extraction step
    if file:
        file_bytes = await file.read()
        try:
            extraction = extract_from_file(
                file_bytes=file_bytes,
                content_type=file.content_type,
                filename=file.filename,
            )
        except DocumentExtractionError as e:
            raise HTTPException(status_code=422, detail=str(e))
    elif raw_text:
        try:
            extraction = extract_from_text(raw_text)
        except DocumentExtractionError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'raw_text' must be provided.",
        )

    # Core pipeline: parser, embedding, persistence
    raw_txt = extraction.raw_text
    source_type = extraction.source_type

    try:
        parsed: ProfileData = await parser.parse_resume(raw_txt)
    except ResumeParseError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Resume parsing failed: {e}",
        )

    embedder = get_embedder(settings.embedding_model)
    embedding = embedder.embed_profile(parsed)

    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == uid)
    )
    existing_profile = profile_result.scalar_one_or_none()

    notable_projects_data = [p.model_dump() for p in parsed.notable_projects]

    if existing_profile:
        existing_profile.raw_resume_text = raw_txt
        existing_profile.parsed_skills = parsed.skills
        existing_profile.parsed_domains = parsed.domains
        existing_profile.parsed_project_summary = parsed.project_summary
        existing_profile.notable_projects = notable_projects_data
        existing_profile.source_type = source_type
        existing_profile.embedding_vector = embedding
        profile = existing_profile
        logger.info("Updated profile for user %s via upload (source: %s)", uid, source_type)
    else:
        new_profile = UserProfile(
            user_id=uid,
            raw_resume_text=raw_txt,
            parsed_skills=parsed.skills,
            parsed_domains=parsed.domains,
            parsed_project_summary=parsed.project_summary,
            notable_projects=notable_projects_data,
            source_type=source_type,
            embedding_vector=embedding,
        )
        session.add(new_profile)
        profile = new_profile
        logger.info("Created profile for user %s via upload (source: %s)", uid, source_type)

    await session.commit()
    await session.refresh(profile)

    return ProfileUploadResponse(
        user_id=str(uid),
        profile=UserProfileContract(
            id=str(profile.id),
            user_id=str(profile.user_id),
            raw_resume_text=profile.raw_resume_text,
            parsed_skills=profile.parsed_skills,
            parsed_domains=profile.parsed_domains,
            parsed_project_summary=profile.parsed_project_summary,
            updated_at=profile.updated_at.isoformat() if profile.updated_at else datetime.now(timezone.utc).isoformat(),
        ),
    )


# ---------- New Normalized Onboarding & Parsing Endpoints ----------

class OnboardingSkillRequest(BaseModel):
    skill: str
    source: str = "resume"
    confidence: float = 1.0


class OnboardingProjectRequest(BaseModel):
    name: str
    description: str | None = None
    stack: list[str] = Field(default_factory=list)
    status: str = "built"
    is_production: bool = False


class OnboardingPreferencesRequest(BaseModel):
    target_roles: list[str] = Field(default_factory=list)
    company_stage: list[str] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    location_pref: list[str] | str = Field(default_factory=lambda: ["remote"])
    comp_floor: str | None = None


class OnboardingRequest(BaseModel):
    user_id: str
    email: str | None = None
    name: str | None = None
    location: str | None = None
    years_experience: str | None = None
    current_role: str | None = None
    skills: list[OnboardingSkillRequest] = Field(default_factory=list)
    projects: list[OnboardingProjectRequest] = Field(default_factory=list)
    preferences: OnboardingPreferencesRequest


@router.post("/parse-resume")
async def parse_resume_preview(
    file: UploadFile | None = File(None),
    raw_text: str | None = Form(None),
    parser: ResumeParserProtocol = Depends(get_resume_parser),
):
    """
    Parse uploaded resume file (PDF/DOCX) or text and return JSON preview.
    Does NOT force a database write — allows user verification step in UI.
    """
    if file and file.filename:
        file_bytes = await file.read()
        try:
            extraction = extract_from_file(file_bytes, file.content_type, file.filename)
        except DocumentExtractionError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif raw_text and raw_text.strip():
        try:
            extraction = extract_from_text(raw_text)
        except DocumentExtractionError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Provide a file or raw_text to parse.")

    try:
        parsed: ProfileData = await parser.parse_resume(extraction.raw_text)
    except ResumeParseError as e:
        raise HTTPException(status_code=422, detail=f"Resume parsing failed: {e}")

    # Build fallback projects list from notable_projects if empty
    projects_list = [p.model_dump() for p in parsed.projects]
    if not projects_list and parsed.notable_projects:
        projects_list = [
            {
                "name": np.title,
                "description": np.description,
                "stack": np.tech_used,
                "status": "built",
                "is_production": False,
            }
            for np in parsed.notable_projects
        ]

    return {
        "name": parsed.name,
        "skills": parsed.skills,
        "domains": parsed.domains,
        "projects": projects_list,
        "experience": [e.model_dump() for e in parsed.experience],
    }


@router.post("/onboarding")
async def submit_user_onboarding(
    payload: OnboardingRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Save complete user onboarding data to normalized tables:
    users, user_skills, user_projects, user_preferences.
    """
    uid = _validate_user_id(payload.user_id)

    # 1. Upsert User
    user_res = await session.execute(select(User).where(User.id == uid))
    user = user_res.scalar_one_or_none()

    if user is None:
        user = User(
            id=uid,
            email=payload.email or f"{uid}@sidedoor.internal",
            name=payload.name,
            location=payload.location,
            years_experience=payload.years_experience,
            current_role=payload.current_role,
        )
        session.add(user)
    else:
        if payload.name:
            user.name = payload.name
        if payload.location:
            user.location = payload.location
        if payload.years_experience:
            user.years_experience = payload.years_experience
        if payload.current_role:
            user.current_role = payload.current_role

    # 2. Replace UserSkills
    from app.db.models import UserSkill, UserProject, UserPreference
    from sqlalchemy import delete

    await session.execute(delete(UserSkill).where(UserSkill.user_id == uid))
    for s in payload.skills:
        if s.skill and s.skill.strip():
            session.add(
                UserSkill(
                    user_id=uid,
                    skill=s.skill.strip(),
                    source=s.source,
                    confidence=s.confidence,
                )
            )

    # 3. Replace UserProjects
    await session.execute(delete(UserProject).where(UserProject.user_id == uid))
    for p in payload.projects:
        if p.name and p.name.strip():
            session.add(
                UserProject(
                    user_id=uid,
                    name=p.name.strip(),
                    description=p.description,
                    stack=p.stack,
                    status=p.status,
                    is_production=p.is_production,
                )
            )

    # 4. Upsert UserPreferences
    pref_res = await session.execute(
        select(UserPreference).where(UserPreference.user_id == uid)
    )
    pref = pref_res.scalar_one_or_none()

    loc_pref = payload.preferences.location_pref
    if isinstance(loc_pref, str):
        loc_pref = [loc_pref]

    if pref is None:
        session.add(
            UserPreference(
                user_id=uid,
                target_roles=payload.preferences.target_roles,
                company_stage=payload.preferences.company_stage,
                industries=payload.preferences.industries,
                location_pref=loc_pref,
                comp_floor=payload.preferences.comp_floor,
            )
        )
    else:
        pref.target_roles = payload.preferences.target_roles
        pref.company_stage = payload.preferences.company_stage
        pref.industries = payload.preferences.industries
        pref.location_pref = loc_pref
        pref.comp_floor = payload.preferences.comp_floor

    await session.commit()
    logger.info("Successfully completed normalized onboarding for user %s", uid)

    return {"status": "success", "user_id": str(uid)}


