"""Pydantic models for CV Pilot API"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# ════════════════════════════════════════════════════════════════
# AUTH MODELS
# ════════════════════════════════════════════════════════════════

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    user_id: str
    email: str
    role: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

# ════════════════════════════════════════════════════════════════
# CV MODELS
# ════════════════════════════════════════════════════════════════

class CVMetadata(BaseModel):
    role_title: Optional[str] = None
    seniority: Optional[str] = None
    industry: Optional[str] = None

class CVResponse(BaseModel):
    id: str
    filename: str
    file_path: Optional[str] = None
    cv_type: str  # 'base', 'template', 'generated'
    created_at: datetime
    role_title: Optional[str] = None
    seniority: Optional[str] = None
    industry: Optional[str] = None

class CVListResponse(BaseModel):
    cvs: List[CVResponse]
    count: int

# ════════════════════════════════════════════════════════════════
# JOB DESCRIPTION MODELS
# ════════════════════════════════════════════════════════════════

class JDRequest(BaseModel):
    full_text: str
    role_title: Optional[str]   = None
    company_name: Optional[str] = None
    industry: Optional[str]     = None
    # Recruiter / client metadata (v5)
    vendor_name: Optional[str]  = None
    client_name: Optional[str]  = None
    client_email: Optional[str] = None
    notes: Optional[str]        = None

class JDResponse(BaseModel):
    id: str
    role_title: Optional[str]   = None
    company_name: Optional[str] = None
    industry: Optional[str]     = None
    vendor_name: Optional[str]  = None
    client_name: Optional[str]  = None
    client_email: Optional[str] = None
    created_at: datetime

class JDListResponse(BaseModel):
    jds: List[JDResponse]
    count: int

class JDDuplicateWarning(BaseModel):
    """Returned when the same JD + client was already processed by another user."""
    is_duplicate: bool
    original_user_email: Optional[str]   = None   # anonymised or full for admin
    original_created_at: Optional[datetime] = None
    original_jd_id: Optional[str]        = None
    cv_already_generated: bool           = False
    message: str                         = ""

# ════════════════════════════════════════════════════════════════
# GENERATION MODELS
# ════════════════════════════════════════════════════════════════

class GenerationRequest(BaseModel):
    jd_id: str
    base_cv_ids: List[str] = Field(..., min_items=1, max_items=3)
    template_cv_id: Optional[str] = None

class GenerationResponse(BaseModel):
    id: str
    status: str  # 'pending', 'processing', 'success', 'failed'
    jd_id: str
    base_cv_ids: List[str]
    generated_cv_id: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None

class GenerationListResponse(BaseModel):
    generations: List[GenerationResponse]
    count: int

# ════════════════════════════════════════════════════════════════
# BULK GENERATION MODELS
# ════════════════════════════════════════════════════════════════

class BulkJDItem(BaseModel):
    """One JD in a bulk generation batch."""
    jd_text: str
    role_title: Optional[str]   = None
    vendor_name: Optional[str]  = None
    client_name: Optional[str]  = None
    client_email: Optional[str] = None
    notes: Optional[str]        = None

class BulkGenerationRequest(BaseModel):
    """One candidate (1-3 CVs) against many JDs."""
    base_cv_ids: List[str]  = Field(..., min_items=1, max_items=3)
    template_cv_id: Optional[str] = None
    items: List[BulkJDItem] = Field(..., min_items=1, max_items=20)

class BulkGenerationResponse(BaseModel):
    bulk_job_id: str
    status: str
    total_count: int
    message: str

# ════════════════════════════════════════════════════════════════
# SUBMISSION TRACKER MODELS
# ════════════════════════════════════════════════════════════════

SUBMISSION_STATUSES = [
    "to_submit", "submitted", "reviewing", "interview", "offer", "hired", "rejected"
]

class SubmissionCreateRequest(BaseModel):
    generation_id: Optional[str]  = None
    cv_id: Optional[str]          = None
    jd_id: Optional[str]          = None
    candidate_name: Optional[str] = None
    vendor_name: Optional[str]    = None
    client_name: Optional[str]    = None
    client_email: Optional[str]   = None
    role_title: Optional[str]     = None
    notes: Optional[str]          = None

class SubmissionUpdateRequest(BaseModel):
    status: Optional[str]          = None
    notes: Optional[str]           = None
    submitted_at: Optional[datetime] = None
    follow_up_at: Optional[datetime] = None
    interview_at: Optional[datetime] = None

class SubmissionResponse(BaseModel):
    id: str
    user_id: str
    generation_id: Optional[str] = None
    cv_id: Optional[str]         = None
    jd_id: Optional[str]         = None
    candidate_name: Optional[str] = None
    vendor_name: Optional[str]   = None
    client_name: Optional[str]   = None
    client_email: Optional[str]  = None
    role_title: Optional[str]    = None
    status: str
    notes: Optional[str]         = None
    submitted_at: Optional[datetime] = None
    follow_up_at: Optional[datetime] = None
    interview_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class SubmissionListResponse(BaseModel):
    submissions: List[SubmissionResponse]
    count: int
    pipeline: Optional[dict] = None  # status → count summary

# ════════════════════════════════════════════════════════════════
# ACTIVITY LOG MODELS
# ════════════════════════════════════════════════════════════════

class ActivityLogResponse(BaseModel):
    id: str
    action_type: str
    description: str
    created_at: datetime
    success: bool
    metadata: Optional[dict] = None

class ActivityStreamResponse(BaseModel):
    logs: List[ActivityLogResponse]
    count: int

# ════════════════════════════════════════════════════════════════
# ADMIN MODELS
# ════════════════════════════════════════════════════════════════

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool

class UserListResponse(BaseModel):
    users: List[UserResponse]
    count: int

class AdminStatsResponse(BaseModel):
    total_users: int
    active_users_today: int
    total_generations: int
    avg_generation_time_ms: float
    total_cvs: int
    generations_today: int
    errors_today: int

class AdminAlertResponse(BaseModel):
    id: str
    alert_type: str
    user_id: Optional[str] = None
    title: str
    message: str
    severity: str  # 'info', 'warning', 'error', 'critical'
    is_read: bool
    created_at: datetime

# ════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
