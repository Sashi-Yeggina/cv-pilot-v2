"""Database service for Supabase integration"""
from supabase import create_client, Client
from config import settings
from typing import Optional, List, Dict, Any
import json
import hashlib
from datetime import datetime

# Initialize Supabase client
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)

# ════════════════════════════════════════════════════════════════
# USERS
# ════════════════════════════════════════════════════════════════

def get_user(user_id: str) -> Optional[Dict]:
    """Get user by ID"""
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

def get_user_model(user_id: str, default: str = "claude-haiku-4-5-20251001") -> str:
    """
    Return the Claude model assigned to this user by the admin.
    Falls back to the default (Haiku) if no model is set.
    """
    try:
        response = (
            supabase.table("users")
            .select("allowed_model")
            .eq("id", user_id)
            .execute()
        )
        if response.data:
            return response.data[0].get("allowed_model") or default
        return default
    except Exception as e:
        print(f"Error getting user model: {e}")
        return default

def update_user_model(
    user_id: str,
    new_model: str,
    admin_email: str,
    reason: Optional[str] = None,
) -> bool:
    """
    Set the Claude model for a user (admin only).
    Also writes an audit row to model_change_log.
    """
    VALID_MODELS = {
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
    }
    MODEL_LABELS = {
        "claude-haiku-4-5-20251001": "Haiku (Fast · Low Cost)",
        "claude-sonnet-4-6":         "Sonnet (Balanced)",
        "claude-opus-4-6":           "Opus (Highest Quality)",
    }

    if new_model not in VALID_MODELS:
        print(f"[update_user_model] invalid model: {new_model}")
        return False

    try:
        # Fetch current model for audit log
        current = get_user(user_id)
        previous_model = (current or {}).get("allowed_model")

        # Update users table
        supabase.table("users").update({
            "allowed_model":    new_model,
            "model_label":      MODEL_LABELS[new_model],
            "model_updated_at": datetime.utcnow().isoformat(),
            "model_updated_by": admin_email,
        }).eq("id", user_id).execute()

        # Write audit row
        supabase.table("model_change_log").insert({
            "user_id":        user_id,
            "changed_by":     admin_email,
            "previous_model": previous_model,
            "new_model":      new_model,
            "reason":         reason,
            "created_at":     datetime.utcnow().isoformat(),
        }).execute()

        return True
    except Exception as e:
        print(f"Error updating user model: {e}")
        return False

def get_model_change_history(user_id: str, limit: int = 20) -> List[Dict]:
    """Return the model change audit trail for a specific user."""
    try:
        response = (
            supabase.table("model_change_log")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Error getting model history: {e}")
        return []

def create_activity_log(
    user_id: str,
    action_type: str,
    description: str,
    metadata: Optional[Dict] = None,
    success: bool = True,
    error_message: Optional[str] = None
) -> bool:
    """Log user activity"""
    try:
        supabase.table("activity_logs").insert({
            "user_id": user_id,
            "action_type": action_type,
            "description": description,
            "metadata": metadata or {},
            "success": success,
            "error_message": error_message,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
        return True
    except Exception as e:
        print(f"Error logging activity: {e}")
        return False

# ════════════════════════════════════════════════════════════════
# CVS
# ════════════════════════════════════════════════════════════════

def create_cv(
    user_id: str,
    filename: str,
    file_path: str,
    file_size_bytes: int,
    cv_type: str = "base",
    role_title: Optional[str] = None,
    seniority: Optional[str] = None,
    industry: Optional[str] = None
) -> Optional[Dict]:
    """Create CV record in database"""
    try:
        response = supabase.table("cvs").insert({
            "user_id": user_id,
            "filename": filename,
            "file_path": file_path,
            "file_size_bytes": file_size_bytes,
            "cv_type": cv_type,
            "role_title": role_title,
            "seniority": seniority,
            "industry": industry,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating CV: {e}")
        return None

def get_user_cvs(user_id: str, cv_type: Optional[str] = None) -> List[Dict]:
    """Get all CVs for a user"""
    try:
        query = supabase.table("cvs").select("*").eq("user_id", user_id)
        if cv_type:
            query = query.eq("cv_type", cv_type)
        response = query.order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting CVs: {e}")
        return []

def get_cv(cv_id: str, user_id: str) -> Optional[Dict]:
    """Get specific CV"""
    try:
        response = supabase.table("cvs").select("*").eq("id", cv_id).eq("user_id", user_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error getting CV: {e}")
        return None

def delete_cv(cv_id: str, user_id: str) -> bool:
    """Delete CV (soft delete)"""
    try:
        supabase.table("cvs").update({
            "deleted_at": datetime.utcnow().isoformat()
        }).eq("id", cv_id).eq("user_id", user_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting CV: {e}")
        return False

# ════════════════════════════════════════════════════════════════
# JOB DESCRIPTIONS
# ════════════════════════════════════════════════════════════════

def _hash_jd(text: str) -> str:
    """SHA-256 of normalised JD text — used for duplicate detection."""
    normalised = " ".join(text.lower().split())
    return hashlib.sha256(normalised.encode()).hexdigest()


def create_jd(
    user_id: str,
    full_text: str,
    role_title: Optional[str] = None,
    company_name: Optional[str] = None,
    industry: Optional[str] = None,
    vendor_name: Optional[str] = None,
    client_name: Optional[str] = None,
    client_email: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[Dict]:
    """Create job description record (v5: includes recruiter metadata + hash)."""
    try:
        response = supabase.table("job_descriptions").insert({
            "user_id":      user_id,
            "full_text":    full_text,
            "role_title":   role_title,
            "company_name": company_name,
            "industry":     industry,
            "vendor_name":  vendor_name,
            "client_name":  client_name,
            "client_email": client_email,
            "notes":        notes,
            "jd_hash":      _hash_jd(full_text),
            "created_at":   datetime.utcnow().isoformat()
        }).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating JD: {e}")
        return None


def check_jd_duplicate(jd_text: str, client_email: Optional[str] = None) -> Dict:
    """
    Check if this JD (or JD+client_email pair) was already processed by any user.
    Returns a dict compatible with JDDuplicateWarning.
    """
    try:
        jd_hash = _hash_jd(jd_text)
        query   = supabase.table("job_descriptions").select(
            "id, user_id, role_title, client_name, client_email, created_at"
        ).eq("jd_hash", jd_hash)

        if client_email:
            query = query.eq("client_email", client_email.lower().strip())

        response = query.order("created_at").limit(1).execute()
        if not response.data:
            return {"is_duplicate": False, "cv_already_generated": False, "message": ""}

        match = response.data[0]

        # Check if a successful generation was made for that JD
        gen_check = (
            supabase.table("cv_generations")
            .select("id")
            .eq("jd_id", match["id"])
            .eq("status", "success")
            .limit(1)
            .execute()
        )
        cv_already_generated = bool(gen_check.data)

        # Fetch the original user's email (anonymised — show domain only)
        original_user_email = "another user"
        try:
            user_res = supabase.table("users").select("email").eq("id", match["user_id"]).single().execute()
            email    = (user_res.data or {}).get("email", "")
            parts    = email.split("@")
            original_user_email = f"***@{parts[1]}" if len(parts) == 2 else "another user"
        except Exception:
            pass

        msg = "This job description has already been submitted"
        if cv_already_generated:
            msg += " and a CV was generated for it"
        if client_email:
            msg += f" for {client_email}"
        msg += ". Please verify before proceeding."

        return {
            "is_duplicate":          True,
            "original_jd_id":        match["id"],
            "original_user_email":   original_user_email,
            "original_created_at":   match.get("created_at"),
            "cv_already_generated":  cv_already_generated,
            "message":               msg,
        }
    except Exception as e:
        print(f"Error checking JD duplicate: {e}")
        return {"is_duplicate": False, "cv_already_generated": False, "message": ""}

def get_user_jds(user_id: str) -> List[Dict]:
    """Get all JDs for a user"""
    try:
        response = supabase.table("job_descriptions").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting JDs: {e}")
        return []

def get_jd(jd_id: str, user_id: str) -> Optional[Dict]:
    """Get specific JD"""
    try:
        response = supabase.table("job_descriptions").select("*").eq("id", jd_id).eq("user_id", user_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error getting JD: {e}")
        return None

# ════════════════════════════════════════════════════════════════
# GENERATIONS
# ════════════════════════════════════════════════════════════════

def create_generation(
    user_id: str,
    jd_id: str,
    base_cv_ids: List[str],
    template_cv_id: Optional[str] = None,
    status: str = "pending",
    bulk_job_id: Optional[str] = None,
) -> Optional[Dict]:
    """Create generation record"""
    try:
        payload = {
            "user_id": user_id,
            "jd_id": jd_id,
            "base_cv_ids": base_cv_ids,
            "template_cv_id": template_cv_id,
            "status": status,
            "created_at": datetime.utcnow().isoformat()
        }
        if bulk_job_id:
            payload["bulk_job_id"] = bulk_job_id
        response = supabase.table("cv_generations").insert(payload).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating generation: {e}")
        return None

def update_generation(
    generation_id: str,
    status: str,
    generated_cv_id: Optional[str] = None,
    generated_cv_file_path: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
    error_message: Optional[str] = None
) -> bool:
    """Update generation record"""
    try:
        update_data = {
            "status": status,
            "completed_at": datetime.utcnow().isoformat()
        }
        if generated_cv_id:
            update_data["generated_cv_id"] = generated_cv_id
        if generated_cv_file_path:
            update_data["generated_cv_file_path"] = generated_cv_file_path
        if processing_time_ms:
            update_data["processing_time_ms"] = processing_time_ms
        if error_message:
            update_data["error_message"] = error_message

        supabase.table("cv_generations").update(update_data).eq("id", generation_id).execute()
        return True
    except Exception as e:
        print(f"Error updating generation: {e}")
        return False

def get_generation(generation_id: str, user_id: str) -> Optional[Dict]:
    """Get specific generation"""
    try:
        response = supabase.table("cv_generations").select("*").eq("id", generation_id).eq("user_id", user_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error getting generation: {e}")
        return None

def get_user_generations(user_id: str, limit: int = 50) -> List[Dict]:
    """Get all generations for a user"""
    try:
        response = supabase.table("cv_generations").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting generations: {e}")
        return []

def get_all_generations(limit: int = 100) -> List[Dict]:
    """Get all generations (admin)"""
    try:
        response = supabase.table("cv_generations").select("*").order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting all generations: {e}")
        return []

# ════════════════════════════════════════════════════════════════
# ADMIN
# ════════════════════════════════════════════════════════════════

def get_all_users(limit: int = 100) -> List[Dict]:
    """Get all users (admin)"""
    try:
        response = supabase.table("users").select("*").limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting users: {e}")
        return []

def get_user_activity(user_id: str, limit: int = 100) -> List[Dict]:
    """Get activity logs for specific user"""
    try:
        response = supabase.table("activity_logs").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting user activity: {e}")
        return []

def get_all_activity(limit: int = 500) -> List[Dict]:
    """Get all activity logs (admin)"""
    try:
        response = supabase.table("activity_logs").select("*").order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting all activity: {e}")
        return []

def get_admin_stats() -> Dict:
    """Get admin dashboard statistics"""
    try:
        users_response = supabase.table("users").select("id", count="exact").execute()
        total_users = users_response.count or 0

        gens_response = supabase.table("cv_generations").select("id", count="exact").execute()
        total_generations = gens_response.count or 0

        cvs_response = supabase.table("cvs").select("id", count="exact").execute()
        total_cvs = cvs_response.count or 0

        # Library stats
        bullets_response = supabase.table("cv_bullet_library").select("id", count="exact").execute()
        total_bullets = bullets_response.count or 0

        logs_response = supabase.table("cv_assembly_log").select("api_calls_saved").execute()
        total_api_saved = sum(r.get("api_calls_saved", 0) for r in (logs_response.data or []))

        return {
            "total_users": total_users,
            "total_generations": total_generations,
            "total_cvs": total_cvs,
            "total_library_bullets": total_bullets,
            "total_api_calls_saved": total_api_saved,
        }
    except Exception as e:
        print(f"Error getting admin stats: {e}")
        return {
            "total_users": 0,
            "total_generations": 0,
            "total_cvs": 0,
            "total_library_bullets": 0,
            "total_api_calls_saved": 0,
        }


# ════════════════════════════════════════════════════════════════
# BULLET LIBRARY
# ════════════════════════════════════════════════════════════════

def save_bullets_for_cv(bullets: List[Dict]) -> int:
    """
    Bulk-insert bullet dicts into cv_bullet_library.
    Returns the number of rows inserted.
    """
    if not bullets:
        return 0
    try:
        supabase.table("cv_bullet_library").insert(bullets).execute()
        return len(bullets)
    except Exception as e:
        print(f"Error saving bullets: {e}")
        return 0


def get_user_library_bullets(user_id: str) -> List[Dict]:
    """
    Fetch ALL bullets for a user from cv_bullet_library.
    This is the corpus we search before calling Claude.
    """
    try:
        response = (
            supabase.table("cv_bullet_library")
            .select("*")
            .eq("user_id", user_id)
            .order("quality_score", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Error getting library bullets: {e}")
        return []


def increment_bullet_usage(bullet_ids: List[str]) -> None:
    """
    Increment usage_count for the bullets that were selected in a generation.
    This lets us surface the most-used bullets first over time.
    """
    if not bullet_ids:
        return
    try:
        for bid in bullet_ids:
            supabase.rpc(
                "increment_bullet_usage",    # Postgres function — see migration
                {"p_bullet_id": bid}
            ).execute()
    except Exception as e:
        print(f"Error incrementing bullet usage: {e}")


def save_assembly_log(
    generation_id: str,
    user_id: str,
    strategy: str,
    jd_skills_required: int,
    skills_from_library: int,
    skills_from_api: int,
    coverage_pct: float,
    api_calls_made: int,
    api_calls_saved: int,
    tokens_used: int,
    bullet_ids_used: List[str],
    # v4 additions — token breakdown + cost
    model_used: str = "claude-haiku-4-5-20251001",
    input_tokens: int = 0,
    output_tokens: int = 0,
    estimated_cost_usd: float = 0.0,
) -> Optional[Dict]:
    """Record how a CV was assembled — used for admin reporting and cost tracking."""
    try:
        response = supabase.table("cv_assembly_log").insert({
            "generation_id":       generation_id,
            "user_id":             user_id,
            "strategy":            strategy,
            "jd_skills_required":  jd_skills_required,
            "skills_from_library": skills_from_library,
            "skills_from_api":     skills_from_api,
            "coverage_pct":        coverage_pct,
            "api_calls_made":      api_calls_made,
            "api_calls_saved":     api_calls_saved,
            "tokens_used":         tokens_used,
            "bullet_ids_used":     bullet_ids_used,
            # v4 cost tracking
            "model_used":          model_used,
            "input_tokens":        input_tokens,
            "output_tokens":       output_tokens,
            "estimated_cost_usd":  round(estimated_cost_usd, 6),
            "created_at":          datetime.utcnow().isoformat(),
        }).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error saving assembly log: {e}")
        return None


def get_user_usage_stats(user_id: str) -> Dict:
    """
    Per-user cost & usage summary for admin dashboard.
    Reads from cv_assembly_log (source of truth for cost data).
    """
    try:
        logs_res = (
            supabase.table("cv_assembly_log")
            .select(
                "strategy, api_calls_made, api_calls_saved, "
                "input_tokens, output_tokens, estimated_cost_usd, "
                "coverage_pct, model_used, created_at"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        logs = logs_res.data or []

        if not logs:
            return _empty_usage_stats()

        total_input  = sum(r.get("input_tokens",  0) for r in logs)
        total_output = sum(r.get("output_tokens", 0) for r in logs)
        total_cost   = sum(r.get("estimated_cost_usd", 0.0) for r in logs)
        saved_calls  = sum(r.get("api_calls_saved", 0) for r in logs)
        strategies   = [r.get("strategy") for r in logs]

        # Cost by model
        cost_by_model: Dict[str, float] = {}
        for r in logs:
            m = r.get("model_used", "claude-haiku-4-5-20251001")
            cost_by_model[m] = cost_by_model.get(m, 0.0) + r.get("estimated_cost_usd", 0.0)

        avg_coverage = (
            sum(r.get("coverage_pct", 0) for r in logs) / len(logs)
            if logs else 0.0
        )

        return {
            "total_generations":      len(logs),
            "total_input_tokens":     total_input,
            "total_output_tokens":    total_output,
            "total_tokens":           total_input + total_output,
            "total_cost_usd":         round(total_cost, 4),
            "api_calls_saved":        saved_calls,
            "avg_coverage_pct":       round(avg_coverage * 100, 1),
            "gens_library_only":      strategies.count("library_only"),
            "gens_library_plus_api":  strategies.count("library_plus_api"),
            "gens_full_api":          strategies.count("full_api"),
            "cost_by_model":          {k: round(v, 4) for k, v in cost_by_model.items()},
            "last_generation_at":     logs[0].get("created_at") if logs else None,
        }
    except Exception as e:
        print(f"Error getting user usage stats: {e}")
        return _empty_usage_stats()


def get_all_users_usage_stats(limit: int = 200) -> List[Dict]:
    """
    Aggregate cost & usage stats for every user — used in admin Usage tab.
    Joins users table with cv_assembly_log aggregates.
    """
    try:
        # Get all users first
        users_res = supabase.table("users").select(
            "id, email, full_name, allowed_model, model_label, role"
        ).limit(limit).execute()
        users = users_res.data or []

        # Get assembly log aggregates per user
        logs_res = supabase.table("cv_assembly_log").select(
            "user_id, input_tokens, output_tokens, estimated_cost_usd, "
            "api_calls_saved, coverage_pct, strategy, model_used"
        ).execute()
        logs = logs_res.data or []

        # Build per-user aggregate
        from collections import defaultdict
        agg: Dict[str, Dict] = defaultdict(lambda: {
            "total_input_tokens":    0,
            "total_output_tokens":   0,
            "total_cost_usd":        0.0,
            "api_calls_saved":       0,
            "coverage_sum":          0.0,
            "gen_count":             0,
            "gens_library_only":     0,
            "gens_library_plus_api": 0,
            "gens_full_api":         0,
        })
        for r in logs:
            uid = r["user_id"]
            agg[uid]["total_input_tokens"]  += r.get("input_tokens",  0)
            agg[uid]["total_output_tokens"] += r.get("output_tokens", 0)
            agg[uid]["total_cost_usd"]      += r.get("estimated_cost_usd", 0.0)
            agg[uid]["api_calls_saved"]     += r.get("api_calls_saved", 0)
            agg[uid]["coverage_sum"]        += r.get("coverage_pct", 0.0)
            agg[uid]["gen_count"]           += 1
            s = r.get("strategy", "full_api")
            if s == "library_only":     agg[uid]["gens_library_only"]     += 1
            elif s == "library_plus_api": agg[uid]["gens_library_plus_api"] += 1
            else:                         agg[uid]["gens_full_api"]         += 1

        result = []
        for u in users:
            uid  = u["id"]
            a    = agg[uid]
            gc   = a["gen_count"]
            result.append({
                "user_id":               uid,
                "email":                 u["email"],
                "full_name":             u.get("full_name"),
                "role":                  u.get("role", "user"),
                "allowed_model":         u.get("allowed_model", "claude-haiku-4-5-20251001"),
                "model_label":           u.get("model_label", "Haiku (Fast · Low Cost)"),
                "total_generations":     gc,
                "total_input_tokens":    a["total_input_tokens"],
                "total_output_tokens":   a["total_output_tokens"],
                "total_tokens":          a["total_input_tokens"] + a["total_output_tokens"],
                "total_cost_usd":        round(a["total_cost_usd"], 4),
                "api_calls_saved":       a["api_calls_saved"],
                "avg_coverage_pct":      round(a["coverage_sum"] / gc * 100, 1) if gc else 0.0,
                "gens_library_only":     a["gens_library_only"],
                "gens_library_plus_api": a["gens_library_plus_api"],
                "gens_full_api":         a["gens_full_api"],
            })

        # Sort by cost descending so highest-spend users are at top
        result.sort(key=lambda x: x["total_cost_usd"], reverse=True)
        return result

    except Exception as e:
        print(f"Error getting all users usage stats: {e}")
        return []


def _empty_usage_stats() -> Dict:
    return {
        "total_generations": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_tokens": 0,
        "total_cost_usd": 0.0,
        "api_calls_saved": 0,
        "avg_coverage_pct": 0.0,
        "gens_library_only": 0,
        "gens_library_plus_api": 0,
        "gens_full_api": 0,
        "cost_by_model": {},
        "last_generation_at": None,
    }


def get_user_library_stats(user_id: str) -> Dict:
    """Summary stats for the user's bullet library — shown on dashboard."""
    try:
        bullets_res = (
            supabase.table("cv_bullet_library")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        logs_res = (
            supabase.table("cv_assembly_log")
            .select("strategy, api_calls_saved, coverage_pct")
            .eq("user_id", user_id)
            .execute()
        )
        logs = logs_res.data or []
        total_saved   = sum(r.get("api_calls_saved", 0) for r in logs)
        avg_coverage  = (
            sum(r.get("coverage_pct", 0) for r in logs) / len(logs)
            if logs else 0.0
        )
        strategies    = [r.get("strategy") for r in logs]
        library_hits  = strategies.count("library_only") + strategies.count("library_plus_api")

        return {
            "total_bullets":       bullets_res.count or 0,
            "api_calls_saved":     total_saved,
            "avg_coverage_pct":    round(avg_coverage * 100, 1),
            "library_hit_count":   library_hits,
            "total_generations":   len(logs),
        }
    except Exception as e:
        print(f"Error getting library stats: {e}")
        return {
            "total_bullets": 0,
            "api_calls_saved": 0,
            "avg_coverage_pct": 0.0,
            "library_hit_count": 0,
            "total_generations": 0,
        }


# ════════════════════════════════════════════════════════════════
# BULK GENERATION JOBS
# ════════════════════════════════════════════════════════════════

def create_bulk_job(
    user_id: str,
    base_cv_ids: List[str],
    total_count: int,
    template_cv_id: Optional[str] = None,
) -> Optional[Dict]:
    """Create a bulk generation job record."""
    try:
        response = supabase.table("bulk_generation_jobs").insert({
            "user_id":        user_id,
            "base_cv_ids":    base_cv_ids,
            "template_cv_id": template_cv_id,
            "total_count":    total_count,
            "completed_count": 0,
            "failed_count":   0,
            "status":         "pending",
            "created_at":     datetime.utcnow().isoformat(),
        }).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating bulk job: {e}")
        return None


def update_bulk_job_progress(
    bulk_job_id: str,
    success: bool = True,
    completed_delta: int = 0,
    failed_delta: int = 0,
) -> None:
    """Increment completed / failed counters. Marks job done when all items finish.
    Pass success=True/False for convenience, or use completed_delta/failed_delta directly."""
    if success is True and completed_delta == 0 and failed_delta == 0:
        completed_delta = 1
    elif success is False and completed_delta == 0 and failed_delta == 0:
        failed_delta = 1
    try:
        # Fetch current counts
        res = supabase.table("bulk_generation_jobs").select(
            "total_count, completed_count, failed_count"
        ).eq("id", bulk_job_id).single().execute()
        if not res.data:
            return
        total     = res.data["total_count"]
        completed = res.data["completed_count"] + completed_delta
        failed    = res.data["failed_count"]    + failed_delta
        done      = completed + failed

        new_status = "processing"
        completed_at = None
        if done >= total:
            new_status   = "completed" if failed == 0 else "partial_failure"
            completed_at = datetime.utcnow().isoformat()

        update = {
            "completed_count": completed,
            "failed_count":    failed,
            "status":          new_status,
        }
        if completed_at:
            update["completed_at"] = completed_at

        supabase.table("bulk_generation_jobs").update(update).eq("id", bulk_job_id).execute()
    except Exception as e:
        print(f"Error updating bulk job progress: {e}")


def get_user_bulk_jobs(user_id: str, limit: int = 20) -> List[Dict]:
    """Get recent bulk jobs for a user."""
    try:
        response = (
            supabase.table("bulk_generation_jobs")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Error getting bulk jobs: {e}")
        return []


# ════════════════════════════════════════════════════════════════
# SUBMISSIONS TRACKER
# ════════════════════════════════════════════════════════════════

def create_submission(
    user_id: str,
    generation_id: Optional[str] = None,
    cv_id: Optional[str] = None,
    jd_id: Optional[str] = None,
    candidate_name: Optional[str] = None,
    vendor_name: Optional[str] = None,
    client_name: Optional[str] = None,
    client_email: Optional[str] = None,
    role_title: Optional[str] = None,
    notes: Optional[str] = None,
    status: str = "to_submit",
) -> Optional[Dict]:
    """Create a submission tracking record."""
    try:
        response = supabase.table("submissions").insert({
            "user_id":        user_id,
            "generation_id":  generation_id,
            "cv_id":          cv_id,
            "jd_id":          jd_id,
            "candidate_name": candidate_name,
            "vendor_name":    vendor_name,
            "client_name":    client_name,
            "client_email":   client_email,
            "role_title":     role_title,
            "notes":          notes,
            "status":         status,
            "created_at":     datetime.utcnow().isoformat(),
            "updated_at":     datetime.utcnow().isoformat(),
        }).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating submission: {e}")
        return None


def get_user_submissions(user_id: str, status_filter: Optional[str] = None, status: Optional[str] = None) -> List[Dict]:
    """Get all submissions for a user, optionally filtered by status."""
    try:
        query = (
            supabase.table("submissions")
            .select("*")
            .eq("user_id", user_id)
        )
        effective_status = status_filter or status
        if effective_status:
            query = query.eq("status", effective_status)
        response = query.order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting submissions: {e}")
        return []


def update_submission(
    submission_id: str,
    user_id: str,
    **fields,
) -> Optional[Dict]:
    """Update a submission record (status, notes, dates, etc.)."""
    try:
        fields["updated_at"] = datetime.utcnow().isoformat()
        # Handle status-triggered timestamps
        if fields.get("status") == "submitted" and "submitted_at" not in fields:
            fields["submitted_at"] = datetime.utcnow().isoformat()
        response = (
            supabase.table("submissions")
            .update(fields)
            .eq("id", submission_id)
            .eq("user_id", user_id)
            .execute()
        )
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error updating submission: {e}")
        return None


def get_submission(submission_id: str, user_id: str) -> Optional[Dict]:
    """Fetch a single submission."""
    try:
        response = (
            supabase.table("submissions")
            .select("*")
            .eq("id", submission_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"Error getting submission: {e}")
        return None


def get_submission_pipeline(user_id: str) -> Dict:
    """Count submissions per status for the Kanban column headers."""
    try:
        subs = get_user_submissions(user_id)
        pipeline = {s: 0 for s in [
            "to_submit", "submitted", "reviewing", "interview", "offer", "hired", "rejected"
        ]}
        for s in subs:
            key = s.get("status", "to_submit")
            if key in pipeline:
                pipeline[key] += 1
        pipeline["total"] = len(subs)
        return pipeline
    except Exception as e:
        print(f"Error getting pipeline: {e}")
        return {}


def delete_submission(submission_id: str, user_id: str) -> bool:
    """Delete a submission (scoped to owner)."""
    try:
        supabase.table("submissions").delete().eq("id", submission_id).eq("user_id", user_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting submission: {e}")
        return False
