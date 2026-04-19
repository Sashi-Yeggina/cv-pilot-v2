"""Authentication service for Supabase"""
from config import settings
from supabase import create_client
import os

# Lazy load Supabase client to avoid import-time errors if credentials are missing
_supabase = None

def get_supabase():
    """Get or create Supabase client (lazy loading)"""
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise RuntimeError(
                "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY in .env"
            )
        try:
            _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception as e:
            raise RuntimeError(
                f"Failed to create Supabase client. Check your SUPABASE_URL and SUPABASE_KEY are valid.\n"
                f"Error: {str(e)}"
            )
    return _supabase

async def register_user(email: str, password: str, full_name: str):
    """Register new user via Supabase Auth"""
    try:
        sb = get_supabase()
        # Create auth user
        auth_response = sb.auth.sign_up({
            "email": email,
            "password": password
        })

        if not auth_response.user:
            return {"error": "Failed to create user"}

        user_id = auth_response.user.id

        # Upsert user profile — safe even if the row already exists
        # (e.g. re-registering after a DB wipe where auth.users still had the account)
        sb.table("users").upsert({
            "id":        user_id,
            "email":     email,
            "full_name": full_name,
            "role":      "user",
            "is_active": True
        }, on_conflict="id").execute()

        return {
            "success": True,
            "user_id": user_id,
            "email": email,
            "access_token": auth_response.session.access_token if auth_response.session else None
        }
    except Exception as e:
        print(f"Registration error: {e}")
        return {"error": str(e)}

async def resolve_email(identifier: str) -> str:
    """Return the email for a given identifier.

    If the identifier looks like an email address (contains @) it is returned
    as-is.  Otherwise it is treated as a full_name and looked up in the users
    table so that users can log in with their display name.
    """
    if "@" in identifier:
        return identifier

    sb = get_supabase()
    result = (
        sb.table("users")
        .select("email")
        .ilike("full_name", identifier)   # case-insensitive match
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["email"]

    # Fall back to the original string so Supabase returns a clear auth error
    return identifier


async def login_user(email: str, password: str):
    """Login user via Supabase Auth.

    ``email`` may be an email address or a full name — resolve_email() handles
    the lookup before passing to Supabase.
    """
    try:
        sb = get_supabase()
        resolved_email = await resolve_email(email)
        auth_response = sb.auth.sign_in_with_password({
            "email": resolved_email,
            "password": password
        })

        if not auth_response.user or not auth_response.session:
            return {"error": "Invalid credentials"}

        user_id    = auth_response.user.id
        user_email = auth_response.user.email

        # ── Ensure a public.users row exists ──────────────────────────────────
        # After a DB wipe + re-migration the trigger only fires for NEW signups,
        # so existing Supabase Auth accounts won't have a row yet.  Upsert here
        # so every login is guaranteed to have a profile row.
        user_data = sb.table("users").select("role").eq("id", user_id).execute()

        if not user_data.data:
            # Row missing — upsert it now so FK constraints never blow up
            try:
                sb.table("users").upsert({
                    "id":        user_id,
                    "email":     user_email,
                    "full_name": auth_response.user.user_metadata.get("full_name", user_email.split("@")[0]),
                    "role":      "user",
                    "is_active": True,
                }, on_conflict="id").execute()
            except Exception as upsert_err:
                print(f"Warning: could not upsert users row: {upsert_err}")
            role = "user"
        else:
            role = user_data.data[0]["role"]

        return {
            "success": True,
            "user_id": user_id,
            "email":   user_email,
            "access_token": auth_response.session.access_token,
            "role": role
        }
    except Exception as e:
        print(f"Login error: {e}")
        return {"error": str(e)}

def verify_token(token: str):
    """Verify JWT token and get user"""
    try:
        sb = get_supabase()
        user = sb.auth.get_user(token)
        return user
    except Exception as e:
        print(f"Token verification error: {e}")
        return None

def logout_user(token: str):
    """Logout user"""
    try:
        sb = get_supabase()
        sb.auth.sign_out()
        return {"success": True}
    except Exception as e:
        print(f"Logout error: {e}")
        return {"error": str(e)}
